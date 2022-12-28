import express, { Application } from 'express'
import morgan from 'morgan'
import compression from 'compression'
import 'module-alias/register'
import cors from 'cors'
import helmet from 'helmet'
import proxy from 'express-http-proxy'
import ErrorMiddleware from './middlewares/error.middleware'
import IController from './utils/interfaces/controller.interface'


class App {
    public express: Application
    public port: number

    constructor(controllers: IController[], port: number) {
        this.express = express()
        this.port = port

        this.initialiseMiddlewares()
        this.initialiseControllers(controllers)
        this.initialiseErrorHandling()
        this.proxyHandler()
        this.listen()
    }

    private initialiseMiddlewares():void {
        this.express.use(helmet())
        this.express.use(cors())
        this.express.use(morgan('dev'))
        this.express.use(express.json())
        this.express.use(express.urlencoded({ extended: false }))
        this.express.use(compression())
    }

    private initialiseControllers(controllers: IController[]): void {
        controllers.forEach((controller) => {
            this.express.use('/', controller.router)
        })
    }

    private initialiseErrorHandling(): void {
        this.express.use(ErrorMiddleware)
    }

    public listen(): void {
        this.express.listen(this.port, () => {
            console.log(`Gateway running on port ${this.port}`)
        })
    }

    private proxyHandler() {
        const account_host = process.env.ACCOUNTS_HOST
        const banking_host = process.env.BANKING_HOST

        console.log(account_host, banking_host)

        this.express.use("/banking", proxy(banking_host != undefined ? banking_host : "http://localhost:4001", {
            proxyErrorHandler: function(err, res, next) {
                console.log(err, "error here")
                return res.status(503).send('Service Unavailable');
            }
        }))
        this.express.use("/account", proxy(account_host != undefined ? account_host : "http://localhost:4002", {
            proxyErrorHandler: function(err, res, next) {
                console.log(err, "error here")
                return res.status(503).send('Service Unavailable');
            }
        }))
    }
}

export default App
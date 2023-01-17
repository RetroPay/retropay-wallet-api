import express, { Application } from 'express'
import morgan from 'morgan'
import compression from 'compression'
import 'module-alias/register'
import cors from 'cors'
import helmet from 'helmet'
import proxy from 'express-http-proxy'
import ErrorMiddleware from './middlewares/error.middleware'
import IController from './utils/interfaces/controller.interface'
import rateLimit from 'express-rate-limit'


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
        this.express.use(express.urlencoded({ extended: true }))
        this.express.use(compression())
        //1000 requests in an hour
        this.express.use(rateLimit({
            windowMs: 60*60*1000,
            max: 1000,
            standardHeaders: false,
            legacyHeaders: false,
        }))
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
        const account_host = process.env.NODE_ENV == 'development' ? process.env.STAGING_ACCOUNTS_HOST : process.env.ACCOUNTS_HOST
        const banking_host = process.env.NODE_ENV == 'development' ? process.env.STAGING_BANKING_HOST : process.env.BANKING_HOST

        this.express.use("/banking", proxy(banking_host != undefined ? banking_host : "http://localhost:4001", {
            proxyErrorHandler: function(err, res, next) {
                return res.status(503).send('Service Unavailable');
            },
            https: process.env.NODE_ENV == 'development' ? true : false
        }))
        
        /* This particular proxy only exists because no optimal solution was found for parsing request body for image upload. 
            By default, express-proxy sets the parseReqBody property to true, this simply parses data from client and makes req.body accessible,
            but parseReqBody chunks this data forcing formiddable to close down with fully recieving the entire image file. 
            Hence the setting of parseReqBody to false here.
        */
        this.express.use("/uploads/account", proxy(account_host != undefined ? account_host : "http://localhost:4002", {
            proxyErrorHandler: function(err, res, next) {
                return res.status(503).send('Service Unavailable');
            },
            parseReqBody: false,
            https: process.env.NODE_ENV == 'development' ? true : false
        }))

        this.express.use("/account", proxy(account_host != undefined ? account_host : "http://localhost:4002", {
            proxyErrorHandler: function(err, res, next) {
                console.log(err)
                return res.status(503).send('Service Unavailable');
            },
            https: process.env.NODE_ENV == 'development' ? true : false
        }))

        
    }
}

export default App
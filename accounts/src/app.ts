import express, { Application } from 'express'
import mongoose from 'mongoose'
import morgan from 'morgan'
import compression from 'compression'
import 'module-alias/register'
import ErrorMiddleware from '@/middlewares/error.middleware'
import IController from '@/utils/interfaces/controller.interface'
import MailService from './services/sendEmails'
import corsOption from './utils/corsOption'
import cors from 'cors'
import helmet from 'helmet'
import process from 'process'
import ExpressMongoSanitize from 'express-mongo-sanitize'
import rateLimit from 'express-rate-limit'

class App {
    public express: Application
    public port: number

    constructor(controllers: IController[], port: number){
        this.express = express()
        this.port = port
        this.initialiseMiddlewares()
        this.initialiseControllers(controllers)
        this.initialiseErrorHandling()
    }

    private initialiseMiddlewares():void {
        this.express.use(helmet())
        this.express.use(corsOption)
        this.express.use(morgan('dev'))
        this.express.use(express.urlencoded({ extended: false }))
        this.express.use(express.json())
        this.express.use(compression())
        this.express.use(ExpressMongoSanitize())
        // this.express.use(rateLimit({
        //     windowMs: 10*60*1000,
        //     max: 500, //Accepts 500
        //     standardHeaders: false,
        //     legacyHeaders: false,
        // }))
    }

    private initialiseControllers(controllers: IController[]): void {
        controllers.forEach((controller) => {
            this.express.use('/', controller.router)
        })
    }

    private initialiseErrorHandling(): void {
        this.express.use(ErrorMiddleware)
    }

    private async initialiseDatabaseConnection(): Promise<void> {
        const { MONGODB_URI, MONGODB_URI_CLOUD, NODE_ENV } = process.env

        await mongoose.connect(`${MONGODB_URI_CLOUD}`)
        .then(() => {
            this.listen()
            this.connectSmtp()
            console.log('DB connected.')
        })
        .catch((error) => {
            console.log(`Error connecting to database /n ${error}`)
            throw new Error(error)
        })
    }

    private listen(): void {
        this.express.listen(this.port, () => {
            console.log(`Server running at ${this.port}`)
            
        })
    }

    private async connectSmtp(): Promise<void> {
        const mailService = MailService.getInstance();
        await mailService.createConnection();
        console.log('live smtp')
    }
    
    public createConnection(): void {
        this.initialiseDatabaseConnection()
    }
}

export default App
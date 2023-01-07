import { Router, Response, Request, NextFunction } from "express"
import IController from "@/utils/interfaces/controller.interface"
import UserService from "@/resources/user/user.service"
import webhookModel from "../metamap/hook.model"
import crypto from "crypto"

class metaMapWebhookController implements IController {
    public path = '/webhooks'
    public router = Router()
    private userService = new UserService()

    constructor() {
        this.initialiseRoutes()
    }

    private initialiseRoutes(): void {
        this.router.post(`${this.path}/metamap`, this.processEvent)
    }

    private processEvent = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
       try {
        console.log(req.body)

        res.sendStatus(200)
            console.log(req.body)
            const { event } = req.body

            if(!event) console.log("no event here")
        
       } catch (error) {
            console.log(error)
       } 
    }
}

export default metaMapWebhookController
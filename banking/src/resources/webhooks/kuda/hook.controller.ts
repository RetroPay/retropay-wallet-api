import { Router, Response, Request, NextFunction } from "express"
import IController from "@/utils/interfaces/controller.interface"
import webhookModel from "./hook.model"
import UserService from "@/resources/user/user.service"
import crypto from "crypto"

class WebhookController implements IController {
    public path = '/webhooks'
    public router = Router()
    private userService = new UserService()

    constructor() {
        this.initialiseRoutes()
    }

    private initialiseRoutes(): void {
        this.router.post(`${this.path}/kuda`, this.processWebhooks)
    }

    private processWebhooks = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
       try {
        console.log(req.body)
        await webhookModel.create(req.body)

        res.sendStatus(200)
            console.log(req.body)
            const { event } = req.body

            if(!event) console.log("no event here")
            
            if(event == 'Money.transfer') {
                // await this.userService.updateIdentityVerificationStatus(req.body.data, 'failed')
            }
            if(event == 'Recieve.money') {
                // await this.userService.updateIdentityVerificationStatus(req.body.data, 'success')
            }
        
       } catch (error) {
            console.log(error)
       } 
    }
}

export default WebhookController
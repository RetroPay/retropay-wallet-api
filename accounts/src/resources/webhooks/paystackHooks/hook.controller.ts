import { Router, Response, Request, NextFunction } from "express"
import IController from "@/utils/interfaces/controller.interface"
import UserService from "@/resources/user/user.service"
import crypto from "crypto"

class WebhookController implements IController {
    public path = '/webhook'
    public router = Router()
    private userService = new UserService

    constructor() {
        this.initialiseRoutes()
    }

    private initialiseRoutes(): void {
        this.router.post(`${this.path}/url`, this.processWebhooks)
    }

    private processWebhooks = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
       try {
        res.sendStatus(200)
        const hash = crypto.createHmac('sha512', `${process.env.GATEWAY_SECRET_KEY}`).update(JSON.stringify(req.body)).digest('hex');
        // if (hash == req.headers['x-paystack-signature']) {
            console.log(req.body)
            const { event } = req.body
            if(!event) return
            
            if(event == 'customeridentification.failed') {
                await this.userService.updateIdentityVerificationStatus(req.body.data, 'failed')
            }
            if(event == 'customeridentification.success') {
                await this.userService.updateIdentityVerificationStatus(req.body.data, 'success')
            }
        // }
        
       } catch (error) {
            console.log(error)
       } 
    }
}

export default WebhookController
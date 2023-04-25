import { Router, Response, Request, NextFunction } from "express"
import IController from "@/utils/interfaces/controller.interface"
import UserService from "@/resources/user/user.service"
import webhookModel from "../metamap/hook.model"
import crypto from "crypto"
import { logsnag } from "../../../server"
// import { subscribeMessage, publishMessage} from "@/utils/broker"

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

        const signature = req.headers['x-signature']
        const MERCHANT_SECRET = process.env.META_MAP_SECRET

        let hash = crypto.createHmac('sha256', `${MERCHANT_SECRET}`).update(JSON.stringify(req.body)).digest('hex')
        const isValidPayload = crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(`${signature}`));

        if(isValidPayload){
            const { eventName, metadata, identityStatus } = req.body
    
            switch (eventName) {
                case 'verification_updated':
                case 'verification_completed': 
                    this.userService.updateUserVerification(metadata.accountTag, identityStatus)
                    // await publishMessage(await brokerChannel, `${process.env.BANKING_BINDING_KEY}`, JSON.stringify({
                    //     event: 'UPDATE_USER_IDENTITY_STATUS',
                    //     data: {
                    //         username: metadata.accountTag,
                    //         identityStatus
                    //     }
                    // }));
                    break;
                case 'verification_started': this.userService.startUserVerification(metadata.accountTag)
                    break;
                default: 
                    break;
            }
        }

        res.sendStatus(200)
       } catch (error) {
            
       } 
    }
}

export default metaMapWebhookController
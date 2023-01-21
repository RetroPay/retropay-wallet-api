import { Router, Response, Request, NextFunction } from "express"
import IController from "@/utils/interfaces/controller.interface"
import webhookModel from "./hook.model"
import WalletService from "@/resources/wallet/wallet.service"
import crypto from "crypto"

class WebhookController implements IController {
    public path = '/webhook'
    public router = Router()
    private walletService = new WalletService()

    constructor() {
        this.initialiseRoutes()
    }

    private initialiseRoutes(): void {
        this.router.post(`${this.path}/kuda`, this.processWebhooks)
    }

    private processWebhooks = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
       try {
        console.log(req.body, req.headers)
        await webhookModel.create(req.body)

        res.sendStatus(200)
        console.log(req.body)
        const { transactionType  } = req.body
        const  {payingBank,  amount, transactionReference, narrations, accountName, accountNumber, senderName, recipientName, sessionId} = req.body

        switch (transactionType.toLowerCase() ) {
            case 'credit': this.walletService.recieveFunds(payingBank,  amount, transactionReference, narrations, accountName, accountNumber, transactionType, senderName, recipientName, sessionId)
                break;
            case 'debit': this.walletService.acknowledgeFundsTransfer(amount, transactionReference, sessionId)
                break;
            default:
                break;
        }
       } catch (error) {
            console.log(error)
       } 
    }
}

export default WebhookController
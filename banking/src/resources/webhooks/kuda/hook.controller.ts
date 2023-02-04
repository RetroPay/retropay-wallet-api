import { Router, Response, Request, NextFunction } from "express"
import IController from "@/utils/interfaces/controller.interface"
import webhookModel from "./hook.model"
import WalletService from "@/resources/wallet/wallet.service"
import crypto from "crypto"
import { brokerChannel } from "../../../server"
import { publishMessage } from "@/utils/broker"
import IWallet from "@/resources/wallet/wallet.interface"

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

    private processWebhooks = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
       try {
        // console.log(req.body, req.headers)
        await webhookModel.create(req.body)

        res.sendStatus(200)
        // console.log(req.body)
        const { transactionType  } = req.body
        const  {payingBank,  amount, transactionReference, narrations, accountName, accountNumber, senderName, recipientName, sessionId} = req.body

        switch (transactionType) {
            case 'credit' || 'Credit': {
                    const transaction: any = await this.walletService.recieveFunds(payingBank,  amount, transactionReference, narrations, accountName, accountNumber, transactionType, senderName, recipientName, sessionId)
                    
                    switch (transaction.transactionType) {
                        case 'Transfer': {
                                const payload = {
                                    id: transaction.id,
                                    trType: 'transfer-in',
                                    amount: transaction.amount as Number,
                                    senderTag: transaction.senderTag,
                                    timestamp: transaction.createdAt
                                }
                                await publishMessage(await brokerChannel, `${process.env.ACCOUNT_BINDING_KEY}`, JSON.stringify({
                                    event: 'QUEUE_NOTIFICATION',
                                    data: payload
                                }));
                            }
                            break;
                        case 'Funding': {
                                const payload = {
                                    id: transaction.id,
                                    trType: 'funding',
                                    amount: Number(transaction.amount),
                                    senderBankInfo: `${transaction.senderName}(${transaction.senderBank})`,
                                    timestamp: transaction.createdAt
                                }
                                await publishMessage(await brokerChannel, `${process.env.ACCOUNT_BINDING_KEY}`, JSON.stringify({
                                    event: 'QUEUE_NOTIFICATION',
                                    data: payload
                                }));
                            }
                            break;
                        default: 
                    }
                }   
                break;
            case 'debit' || 'Debit': this.walletService.acknowledgeFundsTransfer(amount, transactionReference, sessionId)
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
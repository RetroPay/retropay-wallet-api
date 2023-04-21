import { Router, Response, Request, NextFunction } from "express";
import IController from "@/utils/interfaces/controller.interface";
import webhookModel from "./hook.model";
import WalletService from "@/resources/wallet/wallet.service";
import { brokerChannel, logsnag } from "../../../server";
import { publishMessage } from "@/utils/broker";
import IWallet from "@/resources/wallet/wallet.interface";
import MailService from "@/services/sendEmails";
import transferInRecieptEmail from "@/templates/transferin-receipt.template";
import transferOutRecieptEmail from "@/templates/transferout.template";
import axios from "axios";

class WebhookController implements IController {
    public path = "/webhook";
    public router = Router();
    private walletService = new WalletService();

    constructor() {
        this.initialiseRoutes();
    }

    private initialiseRoutes(): void {
        this.router.post(`${this.path}/kuda`, this.processWebhooks);
    }

    private processWebhooks = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IWallet | void> => {
        try {
            await webhookModel.create(req.body);

            console.log(req.body, "kuda webhook")

            /**
             * {"_id":{"$oid":"6440b21a7af2f4a21cfe64ec"},
             * "payingBank":"United Bank for Africa",
             * "amount":"500",
             * "transactionReference":"230420138398",
             * "transactionDate":{"$date":{"$numberLong":"1681961497277"}},
             * "narrations":"KIP:UBA/ADEYEMI OLUWAMOSOP/MOB/ RetroPay  Adey/UTO",
             * "accountName":"ADEYEMI OLUWAMOSOPE AFOLABI",
             * "accountNumber":"2054644498",
             * "transactionType":"Credit",
             * "senderName":"ADEYEMI OLUWAMOSOPE AFOLABI",
             * "recipientName":"ADEYEMI OLUWAMOSOPE AFOLABI",
             * "instrumentNumber":"000004230420043044589401425679",
             * "createdAt":{"$date":{"$numberLong":"1681961498332"}},
             * "updatedAt":{"$date":{"$numberLong":"1681961498332"}},
             * "__v":{"$numberInt":"0"}}
             */

            res.sendStatus(200);
            const { transactionType } = req.body;
            const {
                payingBank,
                amount,
                transactionReference,
                narrations,
                accountName,
                accountNumber,
                senderName,
                recipientName,
                sessionId,
                instrumentNumber
            } = req.body;

            switch (transactionType) {
                case 'Credit':
                    {
                        const transaction: any = await this.walletService.recieveFunds(
                            payingBank,
                            amount,
                            transactionReference,
                            narrations,
                            accountName,
                            accountNumber,
                            transactionType,
                            senderName,
                            recipientName,
                            sessionId
                        );

                        switch (transaction.transactionType) {
                            case "Transfer" || "transfer":
                                {
                                    await publishMessage(
                                        await brokerChannel,
                                        `${process.env.ACCOUNT_BINDING_KEY}`,
                                        JSON.stringify({
                                            event: "QUEUE_NOTIFICATION",
                                            data: {
                                                id: transaction.id, //user reference ID
                                                trType: "transfer-in",
                                                amount: transaction.amount as Number,
                                                senderTag: transaction.senderTag,
                                                timestamp: transaction.createdAt,
                                            },
                                        })
                                    );


                                    const emailTemplate = transferInRecieptEmail(
                                        transaction.recipientTag,
                                        transaction.amount,
                                        transaction.senderTag,
                                        transaction.transactionId,
                                        transaction.createdAt
                                    );
                                    const mailService = MailService.getInstance()
                                    mailService.sendMail({
                                        to: transaction.recipientEmail,
                                        subject: `Cha-ching 🤑 @${transaction.recipientTag}, you just got credited!`,
                                        text: emailTemplate.text,
                                        html: emailTemplate.html,
                                    })

                                    // const termiiPayload = {
                                    //     api_key: process.env.TERMII_API_KEY,
                                    //     to: transaction.recipientPhoneNumber,
                                    //     from: process.env.TERMII_SENDER_ID,
                                    //     channel: "generic",
                                    //     type: "plain",
                                    //     sms: 
                                    //     `Retro Wallet - Credit Alert\nAmount: NGN${(transaction.amount/100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}\n Sender: ${transaction.senderTag}\nDate: ${new Date(transaction.createdAt).toLocaleDateString()}\n
                                    //     `
                                    // }
    
                                    // const response = await axios({
                                    //     method: 'POST',
                                    //     url: 'https://api.ng.termii.com/api/sms/send',
                                    //     data: termiiPayload,
                                    // })
                                }
                                break;
                            case "Funding" || "funding":
                                {
                                    const payload = {
                                        id: transaction.id,
                                        trType: "funding",
                                        amount: transaction.amount as Number,
                                        senderBankInfo: `${transaction.senderName}(${transaction.senderBank})`,
                                        timestamp: transaction.createdAt,
                                    };
                                    await publishMessage(
                                        await brokerChannel,
                                        `${process.env.ACCOUNT_BINDING_KEY}`,
                                        JSON.stringify({
                                            event: "QUEUE_NOTIFICATION",
                                            data: payload,
                                        })
                                    );

                                    // const termiiPayload = {
                                    //     api_key: process.env.TERMII_API_KEY,
                                    //     to: transaction.recipientPhoneNumber,
                                    //     from: process.env.TERMII_SENDER_ID,
                                    //     channel: "generic",
                                    //     type: "plain",
                                    //     sms: 
                                    //     `Retro Wallet - Credit Alert\n Amount: NGN${(transaction.amount/100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}\n Sender: ${transaction.senderName}(${transaction.senderBank})\n Date: ${new Date(transaction.createdAt).toLocaleDateString()}\n`
                                    // }
    
                                    // const response = await axios({
                                    //     method: 'POST',
                                    //     url: 'https://api.ng.termii.com/api/sms/send',
                                    //     data: termiiPayload,
                                    // })

                                    // console.log(response, "termii response")

                                    await logsnag.publish({
                                        channel: "user-actions",
                                        event: "Wallet Funded",
                                        description: "User's wallet has been successfully funded",
                                        icon: "🤑",
                                        notify: true,
                                    });
                                }
                                break;
                            default:
                        }
                    }
                    break;
                case "Debit":
                    /**
                     * When account is debited by kuda either for a transfer(sending money to another wallet user)
                     * or withdrawal (sending money to any NGN bank accounts). Acknowledge transaction debit and update stored
                     * transaction status to successful.
                     */
                    {
                        const transaction: any =
                            await this.walletService.acknowledgeFundsTransfer(
                                amount,
                                transactionReference,
                                sessionId,
                                instrumentNumber
                            );

                        console.log(transaction, "acknowledge webhook debit service response")

                        const { transactionType } = transaction;

                        switch (transactionType) {
                            case "Transfer" || 'transfer':
                                {
                                    // Update transaction notification
                                    await publishMessage(
                                        await brokerChannel,
                                        `${process.env.ACCOUNT_BINDING_KEY}`,
                                        JSON.stringify({
                                            event: "QUEUE_NOTIFICATION",
                                            data: {
                                                id: transaction.id,
                                                trType: "transfer-out",
                                                amount: transaction.amount,
                                                recipientTag: transaction.recipientTag,
                                                timestamp: transaction.createdAt,
                                            },
                                        })
                                    );

                                    // Send email notification
                                    const emailTemplate = transferOutRecieptEmail(
                                        transaction.senderTag,
                                        transaction.amount,
                                        transaction.recipientTag,
                                        transaction.transactionId,
                                        transaction.createdAt
                                    );
                                    const mailService = MailService.getInstance();
                                    mailService.sendMail({
                                        to: transaction.senderEmail,
                                        subject: `Howdy @${transaction.senderTag}, your transfer is on its way! 🚀`,
                                        text: emailTemplate.text,
                                        html: emailTemplate.html,
                                    });

                                    // const termiiPayload = {
                                    //     api_key: process.env.TERMII_API_KEY,
                                    //     to: transaction.senderPhoneNumber,
                                    //     from: process.env.TERMII_SENDER_ID,
                                    //     channel: "generic",
                                    //     type: "plain",
                                    //     sms: `Retro Wallet - Debit Alert\nAmount: NGN${(transaction.amount/100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}\nRecipient: @${transaction.recipientTag}\nDate: ${new Date(transaction.createdAt).toLocaleDateString()}\n
                                    //     `
                                    // }

                                    // const response = await axios({
                                    //     method: 'POST',
                                    //     url: 'https://api.ng.termii.com/api/sms/send',
                                    //     data: termiiPayload,
                                    // })

                                    // console.log(response, "termii response")
                                }
                                break;
                            case "withdrawal" || 'Withdrawal': {
                                await publishMessage(
                                    await brokerChannel,
                                    `${process.env.ACCOUNT_BINDING_KEY}`,
                                    JSON.stringify({
                                        event: "QUEUE_NOTIFICATION",
                                        data: {
                                            id: transaction.id,
                                            trType: "withdrawal",
                                            amount: transaction.amount,
                                            recipientBankInfo: `${transaction.beneficiaryName}(${transaction.beneficiaryBank}-${transaction.beneficiaryAccount})`,
                                            timestamp: transaction.createdAt,
                                        },
                                    })
                                );

                                // Send email notification
                                const emailTemplate = transferOutRecieptEmail(
                                    transaction.senderTag,
                                    transaction.amount,
                                    transaction.beneficiaryName,
                                    transaction.transactionId,
                                    transaction.createdAt
                                );
                                const mailService = MailService.getInstance();
                                mailService.sendMail({
                                    to: transaction.senderEmail,
                                    subject: `Howdy @${transaction.senderTag}, your transfer is on its way! 🚀`,
                                    text: emailTemplate.text,
                                    html: emailTemplate.html,
                                });

                                const termiiPayload = {
                                    api_key: process.env.TERMII_API_KEY,
                                    to: transaction.senderPhoneNumber,
                                    from: process.env.TERMII_SENDER_ID,
                                    channel: "generic",
                                    type: "plain",
                                    sms: 'hello there, you sent'
                                    // sms: 
                                    // `Retro Wallet - Debit Alert\n Amount: NGN${(transaction.amount/100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}\n Recipient: ${transaction.beneficiaryName}/${transaction.beneficiaryAccount}\n Date: ${new Date(transaction.createdAt).toLocaleDateString()}\n
                                    // `
                                }

                                const response = await axios({
                                    method: 'POST',
                                    url: 'https://api.ng.termii.com/api/sms/send',
                                    data: termiiPayload,
                                })
                            }
                                break;
                            default:
                                break;
                        }
                    }
                    break;
                default:
                    break;
            }
        } catch (error) {
            console.log(error, "webhook whole error")
            await logsnag.publish({
                channel: "failed-requests",
                event: "Failed to process wallet webhook",
                description:
                    `Webhook process failed. error: ${error}`,
                icon: "😭",
                notify: true,
            });
        }
    };
}

export default WebhookController;

import IController from "@/utils/interfaces/controller.interface"
import { Router, Request, Response, NextFunction } from "express"
import HttpExeception from "@/utils/exceptions/http.exception"
import IWallet from "./wallet.interface"
import MailService from "@/services/sendEmails"
import WalletService from "./wallet.service"
import authenticatedMiddleware from "@/middlewares/authenticate.middlware"
import validationMiddleware from "@/middlewares/validation.middleware"
import validate from "./wallet.validation"
import {brokerChannel} from "../../server"
import { publishMessage } from "@/utils/broker"
import kudaTokenHandler from "@/middlewares/kudaToken.middleware"
import transferInRecieptEmail from "@/templates/transferin-receipt.template"
import transferOutRecieptEmail from "@/templates/transferout.template"

class WalletController implements IController {
    public path = '/wallet'
    public router = Router()
    private walletService = new WalletService

    constructor() {
        this.initialiseRoutes()
    }

    private initialiseRoutes(): void {
        //transactions
        this.router.get("/wallet/transactions/:reference/status", authenticatedMiddleware, kudaTokenHandler, this.queryTransactionStatus)
        this.router.get("/wallet/transactions/:year/:month", authenticatedMiddleware, this.getTransactionByMonth)
        this.router.get("/wallet/transactions/:reference", authenticatedMiddleware, this.getTransactionDetails)

        this.router.get("/wallet/transactions-summary/:year", authenticatedMiddleware, this.getYearTransactionSummary)

        //wallet balance
        this.router.get("/wallet/balance", authenticatedMiddleware, kudaTokenHandler, this.getWalletBalance)

        //wallet transfers
        this.router.post("/wallet/transfer", authenticatedMiddleware, kudaTokenHandler, validationMiddleware(validate.transferFunds), this.transferFunds)
        this.router.post("/wallet/tag/resolve-account", authenticatedMiddleware, kudaTokenHandler, validationMiddleware(validate.resolveAccountTag), this.resolveAccountTag)

        //wallet withdrawals
        this.router.post("/wallet/bank/resolve-account", authenticatedMiddleware, validationMiddleware(validate.resolveAccount), kudaTokenHandler, this.resolveBankAccount)
        this.router.get("/wallet/banks/list", authenticatedMiddleware, kudaTokenHandler, this.getBankList)
        this.router.post("/wallet/withdraw", authenticatedMiddleware, validationMiddleware(validate.withdrawFunds), kudaTokenHandler, this.withdrawFunds)
    }

    private getTransactionByMonth = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const { month, year } = req.params
            if(month == "" || year == "") throw new Error("Invalid request. Include month or year.")

            const months: string[] = ['january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december']

            const monthNumber = months.indexOf(month.toLowerCase())
            if(monthNumber == -1) throw new Error("Invalid request. Include valid month")

            const result = await this.walletService.getTransactionsByMonthandYear(monthNumber + 1, year, req.user)
            res.status(200).json({
                success: true,
                message: "Transactions retrieved succeesfully",
                data: result
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private getYearTransactionSummary = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const { year } = req.params
            if(year == "") throw new Error("Invalid request. Include year.")
            
            const result = await this.walletService.getYearlyTransactions(year, req.user)

            res.status(200).json({
                success: true,
                message: "Transaction summary retrieved successfully",
                data: result
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private queryTransactionStatus = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const { reference } = req.params
            console.log(reference)
            if(reference == "") throw new Error("Invalid request. Include valid reference.")

            const transaction = await this.walletService.getTransactionStatus(req.user, req.k_token, reference)
            res.status(200).json({
                success: true,
                message: "Transactions status retrieved succeesfully",
                data: transaction
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private getTransactionDetails = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const { reference } = req.params
            if(reference == "") throw new Error("Invalid request. Include valid reference.")

            const transaction = await this.walletService.getTransactionDetails(req.user, reference)

            delete transaction.fundOriginatorAccount
            delete transaction.fundRecipientAccount

            res.status(200).json({
                success: true,
                message: "Transactions retrieved succeesfully.",
                data: { transaction }
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private getWalletBalance = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            console.log(req.user)
            const balance = await this.walletService.getAccountBalance(req.referenceId, req.k_token, req.user)
            
            res.status(200).json({
                success: true,
                message: "Balance retrieved succeesfully",
                data: {
                    balance
                }
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private transferFunds = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const { pin, amount, recipientTag, comment, beneficiaryName } = req.body
            const transaction = await this.walletService.transferFunds(pin, amount, recipientTag, comment, req.user, req.username, req.referenceId, req.k_token, beneficiaryName)
            console.log('transaction', transaction)
            publishMessage(await brokerChannel, `${process.env.ACCOUNT_BINDING_KEY}`, JSON.stringify({
                event: 'QUEUE_NOTIFICATION',
                data: {
                    id: req.referenceId,
                    trType: 'transfer-out',
                    amount: transaction.amount,
                    recipientTag: transaction.fundRecipientAccountTag,
                    timestamp: transaction.createdAt
                }
            }));

            //temporary! log new transaction in recipient notification
            publishMessage(await brokerChannel, `${process.env.ACCOUNT_BINDING_KEY}`, JSON.stringify({
                event: 'QUEUE_NOTIFICATION',
                data: {
                    id: transaction.tempAccountRecipientId,
                    trType: 'transfer-in',
                    amount: transaction.amount,
                    senderTag: transaction.tempSenderTag,
                    timestamp: transaction.createdAt
                }
            }));

            // temporary! Send email to recipient as notification
            const emailTemplate = transferInRecieptEmail(transaction.fundRecipientAccountTag, transaction.amount, transaction.tempSenderTag, transaction.transactionId, transaction.createdAt)
            const mailService = MailService.getInstance();
            mailService.sendMail({
                to: transaction.tempRecipientEmail,
                subject: `Howdy @${transaction.fundRecipientAccountTag}, you just got credited! 🎉`,
                text: emailTemplate.text,
                html: emailTemplate.html,
            });

            // temporary! Send email to sender as notification
            const emailService = MailService.getInstance();
            emailService.sendMail({
                to: transaction.tempSenderEmail,
                subject: `Howdy @${transaction.fundRecipientAccountTag}, your transfer is on it way! 🚀`,
                text: transferOutRecieptEmail(transaction.tempSenderTag, transaction.amount, transaction.fundRecipientAccountTag, transaction.transactionId, transaction.createdAt).text,
                html: transferOutRecieptEmail(transaction.fundRecipientAccountTag, transaction.amount, transaction.tempSenderTag, transaction.transactionId, transaction.createdAt).html,
            });

            delete transaction.tempSenderTag
            delete transaction.tempAccountRecipientId
            delete transaction.tempRecipientEmail
            delete transaction.tempSenderEmail

            res.status(201).json({
                success: true,
                message: "Transaction successfull",
                data: {
                    transaction
                }
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))  
        }
    }

    
    private withdrawFunds = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const { pin, amount, beneficiaryAccount, comment, beneficiaryBankCode, beneficiaryName, beneficiaryBank, nameEnquiryId } = req.body

            console.log(req.body)
            const transaction = await this.walletService.withdrawFunds(pin, req.referenceId, req.user, amount, beneficiaryAccount, comment, beneficiaryBankCode, beneficiaryBank, beneficiaryName, nameEnquiryId, req.k_token)
            
            publishMessage(await brokerChannel, `${process.env.ACCOUNT_BINDING_KEY}`, JSON.stringify({
                event: 'QUEUE_NOTIFICATION',
                data: {
                    id: req.referenceId,
                    trType: 'withdrawal',
                    amount: transaction.amount,
                    recipientBankInfo: `${transaction.beneficiaryName}(${transaction.beneficiaryBank}-${transaction.beneficiaryAccount})`,
                    timestamp: transaction.createdAt
                }
            }));
            
            res.status(201).json({
                success: true,
                message: "Transaction successfull",
                data: {
                    transaction
                }
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private resolveBankAccount = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const accountDetails = await this.walletService.confirmTransferRecipient(req.body.accountNumber, req.body.bankCode, req.referenceId, req.k_token)
            res.status(200).json({
                success: true,
                message: "Bank account resolved successfully.",
                data: {
                    accountDetails
                }
            })
        } catch (error :any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private resolveAccountTag = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const accountDetails = await this.walletService.confirmTransferRecipientByAccountTag(req.body.accountTag, req.k_token, req.referenceId)
            res.status(200).json({
                success: true,
                message: "User account resolved successfully.",
                data: {
                    accountDetails
                }
            })
        } catch (error :any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private getBankList = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const banks = await this.walletService.getBankList(req.k_token)
            res.status(200).json({
                success: true,
                message: "Bank list retrieved succesfully",
                data: {
                    banks,
                }
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }
}

export default WalletController
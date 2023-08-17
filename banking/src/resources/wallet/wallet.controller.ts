import IController from "@/utils/interfaces/controller.interface"
import { Router, Request, Response, NextFunction } from "express"
import HttpException from "@/utils/exceptions/http.exception"
import IWallet from "./wallet.interface"
import WalletService from "./wallet.service"
import authenticatedMiddleware from "@/middlewares/authenticate.middleware"
import validationMiddleware from "@/middlewares/validation.middleware"
import validate from "./wallet.validation"
import kudaTokenHandler from "@/middlewares/kudaToken.middleware"
import { usdAccountMeta } from "./wallet.type"
import logger from "@/utils/logger"

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

        // virtual accounts
        this.router.post("/wallet/accounts/create", authenticatedMiddleware, kudaTokenHandler, validationMiddleware(validate.createCurrencyAccount), this.createCurrencyAccount)

        //wallet balance
        this.router.get("/wallet/balance", authenticatedMiddleware, kudaTokenHandler, this.getWalletBalance)

        //wallet transfers
        this.router.post("/wallet/transfer", authenticatedMiddleware, kudaTokenHandler, validationMiddleware(validate.transferFunds), this.transferFunds)
        this.router.post("/wallet/tag/resolve-account", authenticatedMiddleware, kudaTokenHandler, validationMiddleware(validate.resolveAccountTag), this.resolveAccountTag)

        //wallet withdrawals
        this.router.post("/wallet/bank/resolve-account", authenticatedMiddleware, validationMiddleware(validate.resolveAccount), kudaTokenHandler, this.resolveBankAccount)
        this.router.get("/wallet/banks/list", authenticatedMiddleware, kudaTokenHandler, this.getBankList)
        this.router.post("/wallet/withdraw", authenticatedMiddleware, validationMiddleware(validate.withdrawFunds), kudaTokenHandler, this.withdrawFunds)
        this.router.post("/wallet/withdraw/v2", authenticatedMiddleware, validationMiddleware(validate.withdrawFundsV2), kudaTokenHandler,this.withdrawFundsV2)
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
                message: "Transactions retrieved successfully",
                data: result
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))
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
            return next(new HttpException(400, error.message))
        }
    }

    private queryTransactionStatus = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const { reference } = req.params
           
            if(reference == "") throw new Error("Invalid request. Include valid reference.")

            const transaction = await this.walletService.getTransactionStatus(req.user, req.k_token, reference)
            res.status(200).json({
                success: true,
                message: "Transactions status retrieved successfully",
                data: transaction
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))
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
                message: "Transactions retrieved successfully.",
                data: { transaction }
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))
        }
    }

    private getWalletBalance = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
         
            const balance = await this.walletService.getAccountBalance(req.referenceId, req.k_token, req.user)
            
            res.status(200).json({
                success: true,
                message: "Balance retrieved successfully",
                data: {
                    balance
                }
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))
        }
    }

    private transferFunds = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const { pin, amount, recipientTag, comment, beneficiaryName } = req.body
            const transaction = await this.walletService.transferFunds(pin, amount, recipientTag, comment, req.user, req.username, req.referenceId, req.k_token, beneficiaryName)

            res.status(201).json({
                success: true,
                message: "Transaction successful",
                data: {
                    transaction
                }
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))  
        }
    }

    
    private withdrawFunds = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const { pin, amount, beneficiaryAccount, comment, beneficiaryBankCode, beneficiaryName, beneficiaryBank, nameEnquiryId } = req.body

            const transaction = await this.walletService.withdrawFunds(pin, req.referenceId, req.user, amount, beneficiaryAccount, comment, beneficiaryBankCode, beneficiaryBank, beneficiaryName, nameEnquiryId, req.k_token)
            
            res.status(201).json({
                success: true,
                message: "Transaction successful",
                data: {
                    transaction
                }
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))
        }
    }

    
    private withdrawFundsV2 = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const { currency, pin, amount, beneficiaryAccount, comment, beneficiaryBankCode, beneficiaryName, beneficiaryBank, nameEnquiryId, recipientInfo } = req.body

            const transaction = await this.walletService.withdrawFunds_v2(currency, pin, req.referenceId, req.user, amount, beneficiaryAccount, comment, beneficiaryBankCode, beneficiaryBank, req.k_token, beneficiaryName, nameEnquiryId, recipientInfo)
            
            res.status(201).json({
                success: true,
                message: "Transaction successful",
                data: {
                    transaction
                }
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))
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
            return next(new HttpException(400, error.message))
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
            return next(new HttpException(400, error.message))
        }
    }

    private getBankList = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const banks = await this.walletService.getBankList(req.k_token)
            res.status(200).json({
                success: true,
                message: "Bank list retrieved successfully",
                data: {
                    banks,
                }
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))
        }
    }

    private createCurrencyAccount = async (req: Request | any, res: Response, next: NextFunction): Promise<any> => {
        try {
            logger("called")
            const { currency, meta }: { currency: string, meta: usdAccountMeta | undefined} = req.body;
            logger(currency)
            logger(meta)
            const account = await this.walletService.createCurrencyAccount(req.user, "req.map_customer_id", req.k_token, currency, meta)
            res.status(200).json({
                success: true,
                message: "Account created successfully"
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))
        }
    }
}

export default WalletController
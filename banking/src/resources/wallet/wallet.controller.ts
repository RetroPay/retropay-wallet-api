import IController from "@/utils/interfaces/controller.interface"
import { Router, Request, Response, NextFunction } from "express"
import HttpExeception from "@/utils/exceptions/http.exception"
import IWallet from "./wallet.interface"
import WalletService from "./wallet.service"
import authenticatedMiddleware from "@/middlewares/authenticate.middlware"
import validationMiddleware from "@/middlewares/validation.middleware"
import validate from "./wallet.validation"
import {brokerChannel} from "../../server"
import { publishMessage } from "@/utils/broker"
import kudaTokenHandler from "@/middlewares/kudaToken.middleware"

class WalletController implements IController {
    public path = '/wallet'
    public router = Router()
    private walletService = new WalletService

    constructor() {
        this.initialiseRoutes()
    }

    private initialiseRoutes(): void {
        this.router.post("/wallet/fund", validationMiddleware(validate.fundWallet), this.fundWallet)
        //transaction history
        this.router.get("/wallet/transactions/:reference/verify", authenticatedMiddleware, this.verifyDepositTransaction)
        this.router.get("/wallet/transactions/:year/:month", authenticatedMiddleware, this.getTransactionByMonth)
        this.router.get("/wallet/transactions/:reference", authenticatedMiddleware, this.getTransactionDetails)
        //wallet balance
        this.router.get("/wallet/balance", authenticatedMiddleware, this.getWalletBalance)
        //wallet transfers
        this.router.post("/wallet/transfer", authenticatedMiddleware, validationMiddleware(validate.transferFunds), this.transferFunds)
        //wallet withdrawals
        this.router.post("/wallet/bank/resolve-account", authenticatedMiddleware, validationMiddleware(validate.resolveAccount), this.resolveBankAccount)
        this.router.get("/wallet/banks/list", authenticatedMiddleware, kudaTokenHandler, this.getBankList)
    }

    private fundWallet = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            // const checkout = await this.walletService.initializePaystackCheckout(req.body.amount, req.user, "NGN")
            publishMessage(await brokerChannel, `${process.env.ACCOUNT_BINDING_KEY}`, JSON.stringify({
                event: 'USER_INITIALISE_FUND_WALLET',
                // data: checkout,
                data: 'It went through'
            }));
            res.status(201).json({
                success: true,
                message: "Initialization successful",
                // data: checkout
                data: 'It went through'
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private verifyDepositTransaction = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            if(req.params.reference === undefined) return next(new HttpExeception(400, "Invalid request. Include transaction reference"))
           
            const updatedTransaction: IWallet | null = await this.walletService.verifyTransaction(req.params.reference)
            res.status(200).json({
                success: true,
                message: "Transaction succesfully verified",
                data: { 
                    transactionStatus: updatedTransaction?.status,
                    amount: updatedTransaction?.amount,
                    transactionType: updatedTransaction?.transactionType
                 }
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private getTransactionByMonth = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const { month, year } = req.params
            if(month == "" || year == "") throw new Error("Invalid request. Include month or year.")

            const months: string[] = ['january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december']

            const monthNumber = months.indexOf(month.toLowerCase())
            if(monthNumber == -1) throw new Error("Invalid request.")

            const result = await this.walletService.getTransactionsByMonth(monthNumber + 1, year, req.user)
            res.status(200).json({
                success: true,
                message: "Transactions retrieved succeesfully",
                data: result
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private getTransactionDetails = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            const { reference } = req.params
            if(!reference) throw new Error("Invalid request. Include valid reference.")

            const transaction = await this.walletService.getTransactionDetails(req.user, reference)

            res.status(200).json({
                success: true,
                message: "Transactions retrieved succeesfully",
                data: transaction
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private getWalletBalance = async (req: Request | any, res: Response, next: NextFunction): Promise<IWallet | void> => {
        try {
            console.log(req.user)
            const balance = await this.walletService.calculateWalletBalance(req.user)
            
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
            const { pin, amount, recipientTag, comment } = req.body
            const transaction = await this.walletService.transferFund(pin, amount, recipientTag, comment, req.user, req.username)
            res.status(201).json({
                success: true,
                message: "Balance retrieved succeesfully",
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
            const accountDetails = await this.walletService.resolveBankAccount(req.body.accountNumber, req.body.bankCode)
            res.status(200).json({
                success: true,
                message: "Baank account resolved successfully.",
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
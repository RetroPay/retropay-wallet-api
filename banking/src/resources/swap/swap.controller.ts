import IController from "@/utils/interfaces/controller.interface"
import { Router, Request, Response, NextFunction } from "express"
import HttpException from "@/utils/exceptions/http.exception"
import ISwap from "./swap.interface"
import SwapService from "./swap.service"
import authenticatedMiddleware from "@/middlewares/authenticate.middleware"
import validationMiddleware from "@/middlewares/validation.middleware"
import validate from "./swap.validation"
import kudaTokenHandler from "@/middlewares/kudaToken.middleware"
import logger from "@/utils/logger"

class SwapController implements IController {
    public path: string = '/wallet/swap'
    public router: Router = Router()
    private swapService = new SwapService

    constructor() {
        this.initialiseRoutes()
    }

    private initialiseRoutes(): void {
        this.router.post(`${this.path}/quote`, authenticatedMiddleware, validationMiddleware(validate.swapQuote), this.generateSwapQuote)
        this.router.post(`${this.path}`, authenticatedMiddleware, validationMiddleware(validate.swapFunds), this.swapFunds)
    }

    private generateSwapQuote = async (req: Request | any, res: Response, next: NextFunction): Promise<ISwap | any> => {
        try {
            const { sourceCurrency, targetCurrency, amount } = req.body
            const quote = await this.swapService.generateSwapQuote(sourceCurrency, targetCurrency, amount, req.user)

            res.status(200).json({
                success: true,
                message: "Swap quote generated",
                data: {
                    quote
                }
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))
        }
    }

    private swapFunds = async (req: Request | any, res: Response, next: NextFunction): Promise<ISwap | any> => {
        try {
            const { quoteReference } = req.body
            const quote = await this.swapService.swapFunds(quoteReference, req.user)
            
            res.status(200).json({
                success: true,
                message: "Funds exchange successful.",
                data: {
                    quote
                }
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))
        }
    }
}

export default SwapController;
import IController from "@/utils/interfaces/controller.interface"
import { Router, Request, Response, NextFunction } from "express"
import HttpException from "@/utils/exceptions/http.exception"
import authenticatedMiddleware from "@/middlewares/authenticate.middleware"
import validationMiddleware from "@/middlewares/validation.middleware"
import validate from "./budget.validation"
import kudaTokenHandler from "@/middlewares/kudaToken.middleware"
import BudgetService from "./budget.service"
import IBudget from "./budget.interface"


class BudgetController implements IController {
    public path = '/budget'
    public router = Router()
    private budgetService = new BudgetService

    constructor() {
        this.initializeRoutes()
    }

    private initializeRoutes(): void {
        this.router.post(`${this.path}/monthly/ngn/create`, validationMiddleware(validate.createMonthBudget), authenticatedMiddleware, kudaTokenHandler, this.createMonthlyBudget)
    }

    private createMonthlyBudget = async (req: Request | any, res: Response | any, next: NextFunction): Promise<IBudget | void> => {
        try {
            const { budgetName, budgetAmount, budgetYear, budgetMonth, budgetItems } = req.body 
            const budget: IBudget = await this.budgetService.createNairaMonthlyBudget(
                req.user,
                req.referenceId,
                req.k_token,
                budgetAmount,
                budgetMonth,
                budgetYear,
                budgetName,
                budgetItems
            )
            res.status(201).json({
                success: true,
                message: "Budget created successfully",
                data: {
                    budget
                }
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))
        }
    }
}

export default BudgetController
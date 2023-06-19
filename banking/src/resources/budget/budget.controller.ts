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
        this.router.post(`${this.path}/monthly/ngn/create`, validationMiddleware(validate.createMonthBudget), authenticatedMiddleware, kudaTokenHandler, this.createNairaMonthlyBudget)
        this.router.post(`${this.path}/goal/ngn/create`, validationMiddleware(validate.createGoalBudget), authenticatedMiddleware, kudaTokenHandler, this.createNairaGoalBudget)
        this.router.post(`${this.path}/goal/ngn/add-funds`, validationMiddleware(validate.addFundsToBudget), authenticatedMiddleware, kudaTokenHandler, this.fundNairaGoalBudget)
        this.router.post(`${this.path}/monthly/ngn/add-funds`, validationMiddleware(validate.addFundsToBudget), authenticatedMiddleware, kudaTokenHandler, this.fundNairaMonthlyBudget)
        this.router.get(`${this.path}/:budgetUniqueId`, authenticatedMiddleware, this.getBudgetDetails)
    }

    private createNairaMonthlyBudget = async (req: Request | any, res: Response | any, next: NextFunction): Promise<IBudget | void> => {
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
                    budget: {
                        budgetName,
                        totalBudgetAmount: budget.totalBudgetAmount,
                        currency: budget.currency,
                        budgetAmountSpent: budget.budgetAmountSpent,
                        budgetUniqueId: budget.budgetUniqueId,
                        budgetType: budget.budgetType,
                        budgetItems: budget.budgetItems
                    }
                }
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))
        }
    }

    private createNairaGoalBudget = async (req: Request | any, res: Response | any, next: NextFunction): Promise<IBudget | void> => {
        try {
            const { budgetName, budgetAmount } = req.body 
            const budget: IBudget = await this.budgetService.createNairaGoalBudget(
                req.user,
                req.referenceId,
                req.k_token,
                budgetAmount,
                budgetName
            )

            res.status(201).json({
                success: true,
                message: "Budget created successfully",
                data: {
                    budget: {
                        budgetName,
                        totalBudgetAmount: budget.totalBudgetAmount,
                        currency: budget.currency,
                        budgetAmountSpent: budget.budgetAmountSpent,
                        budgetUniqueId: budget.budgetUniqueId,
                        budgetType: budget.budgetType,
                    }
                }
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))
        }
    }

    private getBudgetDetails = async (req: Request | any, res: Response | any, next: NextFunction): Promise<IBudget | void> => {
        try {
            const { budgetUniqueId } = req.params

            if(!budgetUniqueId || budgetUniqueId === '') throw new Error("Invalid request - budget ID required.")

            const budget = await this.budgetService.getBudgetDetails(
                req.user,
                req.k_token,
                budgetUniqueId
            )

            res.status(201).json({
                success: true,
                message: "Budget retrieved successfully",
                data: {
                    budget
                }
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message)) 
        }
    }

    private fundNairaGoalBudget = async (req: Request | any, res: Response | any, next: NextFunction): Promise<IBudget | void> => {
        try {
            const { budgetUniqueId, amount } = req.body;

            const budget = await this.budgetService.fundNairaGoalBudget(
                req.k_token,
                amount,
                budgetUniqueId
            )
            
            res.status(201).json({
                success: true,
                message: "Budget funded successfully",
                data: {
                    budget
                }
            })
        } catch (error: any) {
            return next(new HttpException(400, error.message))    
        }
    }

    private fundNairaMonthlyBudget = async (req: Request | any, res: Response | any, next: NextFunction): Promise<IBudget | void> => {
        try {
            const { budgetUniqueId, amount , budgetItemId} = req.body;

            const budget = await this.budgetService.fundNairaMonthlyBudget(
                req.k_token,
                amount,
                budgetUniqueId,
                budgetItemId
            )
            
            res.status(201).json({
                success: true,
                message: "Budget funded successfully",
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
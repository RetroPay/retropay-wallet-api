import IController from "@/utils/interfaces/controller.interface";
import { Router, Request, Response, NextFunction } from "express";
import HttpException from "@/utils/exceptions/http.exception";
import authenticatedMiddleware from "@/middlewares/authenticate.middleware";
import validationMiddleware from "@/middlewares/validation.middleware";
import validate from "./budget.validation";
import kudaTokenHandler from "@/middlewares/kudaToken.middleware";
import BudgetService from "./budget.service";
import IBudget from "./budget.interface";
import logger from "@/utils/logger";

class BudgetController implements IController {
  public path = "/budget";
  public router = Router();
  private budgetService = new BudgetService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      `${this.path}/create`,
      validationMiddleware(validate.createBudget),
      authenticatedMiddleware,
      kudaTokenHandler,
      this.createBudget
    );
    this.router.post(
      `${this.path}/add-funds`,
      validationMiddleware(validate.addFundsToBudget),
      authenticatedMiddleware,
      kudaTokenHandler,
      this.topUpBudget
    );
    this.router.get(
      `${this.path}/:budgetUniqueId`,
      authenticatedMiddleware,
      this.getBudgetDetails
    );
    this.router.get(
      `${this.path}`,
      authenticatedMiddleware,
      this.getAllBudgets
    );
    this.router.get(
      `${this.path}/transactions/:year/:month`,
      authenticatedMiddleware,
      this.budgetTransactionHistory
    );
    this.router.post(
      `${this.path}/transfer`,
      validationMiddleware(validate.transferFromBudget),
      authenticatedMiddleware,
      kudaTokenHandler,
      this.transferFundsFromBudget
    );
    this.router.post(
      `${this.path}/withdraw`,
      validationMiddleware(validate.withdrawFromBudget),
      authenticatedMiddleware,
      kudaTokenHandler,
      this.withdrawFundsFromBudget
    );
    this.router.put(
      `${this.path}/edit`,
      authenticatedMiddleware,
      kudaTokenHandler,
      this.editBudget
    );
  }

  private createBudget = async (
    req: Request | any,
    res: Response | any,
    next: NextFunction
  ): Promise<IBudget | void> => {
    try {
      const {
        budgetName,
        budgetAmount,
        startDate,
        endDate,
        budgetItems,
        currency,
        budgetIcon,
      } = req.body;

      const budget: IBudget = await this.budgetService.createBudget(
        req.user,
        req.referenceId,
        req.k_token,
        budgetAmount,
        startDate,
        endDate,
        budgetName,
        budgetItems,
        currency,
        budgetIcon
      );

      res.status(201).json({
        success: true,
        message: "Budget created successfully",
        data: {
          budget: {
            budgetName,
            totalBudgetAmount: budget.totalBudgetAmount,
            initialBudgetAmount: budget.initialBudgetAmount,
            currency: budget.currency,
            budgetAmountSpent: budget.budgetAmountSpent,
            budgetUniqueId: budget.budgetUniqueId,
            budgetType: budget.budgetType,
            budgetItems: budget.budgetItems,
            startDate: budget.startDate,
            endDate: budget.endDate,
          },
        },
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };

  private getBudgetDetails = async (
    req: Request | any,
    res: Response | any,
    next: NextFunction
  ): Promise<IBudget | void> => {
    try {
      const { budgetUniqueId } = req.params;

      if (!budgetUniqueId || budgetUniqueId === "")
        throw new Error("Invalid request - budget ID required.");

      const budget = await this.budgetService.getBudgetDetails(
        req.user,
        req.k_token,
        budgetUniqueId
      );

      res.status(201).json({
        success: true,
        message: "Budget retrieved successfully",
        data: {
          budget,
        },
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };

  private getAllBudgets = async (
    req: Request | any,
    res: Response | any,
    next: NextFunction
  ): Promise<IBudget | void> => {
    try {
      const budgets = await this.budgetService.getAllBudgets(req.user);

      res.status(201).json({
        success: true,
        message: "Budgets retrieved successfully",
        data: {
          budgets,
        },
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };

  private topUpBudget = async (
    req: Request | any,
    res: Response | any,
    next: NextFunction
  ): Promise<IBudget | void> => {
    try {
      const { budgetUniqueId, amount, budgetItemId } = req.body;

      const budget = await this.budgetService.topUpBudget(
        req.user,
        req.k_token,
        amount,
        budgetUniqueId,
        budgetItemId
      );

      res.status(201).json({
        success: true,
        message: "Budget funded successfully",
        data: {
          budget,
        },
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };

  private transferFundsFromBudget = async (
    req: Request | any,
    res: Response | any,
    next: NextFunction
  ): Promise<IBudget | void> => {
    try {
      const {
        budgetUniqueId,
        amount,
        budgetItemId,
        pin,
        recipientTag,
        comment,
        beneficiaryName,
      } = req.body;

      const budget = await this.budgetService.transferFromBudget(
        req.k_token,
        budgetUniqueId,
        budgetItemId,
        amount,
        pin,
        recipientTag,
        comment,
        req.user,
        req.username,
        req.referenceId,
        beneficiaryName
      );

      res.status(200).json({
        success: true,
        message: "Transaction successful.",
        data: budget,
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };

  private withdrawFundsFromBudget = async (
    req: Request | any,
    res: Response | any,
    next: NextFunction
  ): Promise<IBudget | void> => {
    try {
      const {
        pin,
        amount,
        beneficiaryAccount,
        comment,
        beneficiaryBankCode,
        beneficiaryName,
        beneficiaryBank,
        nameEnquiryId,
        budgetUniqueId,
        budgetItemId,
      } = req.body;

      const budget = await this.budgetService.withdrawFromBudget(
        req.k_token,
        budgetUniqueId,
        budgetItemId,
        amount,
        pin,
        comment,
        req.user,
        req.referenceId,
        beneficiaryName,
        beneficiaryAccount,
        beneficiaryBankCode,
        beneficiaryBank,
        nameEnquiryId
      );

      res.status(200).json({
        success: true,
        message: "Transaction successful.",
        data: budget,
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };

  private budgetTransactionHistory = async (
    req: Request | any,
    res: Response,
    next: NextFunction
  ): Promise<IBudget | void> => {
    try {
      const { month, year } = req.params;

      logger(req.params);

      if (month == "" || year == "")
        throw new Error("Invalid request. Include month or year.");

      const months: string[] = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ];

      const monthNumber = months.indexOf(month.toLowerCase());
      if (monthNumber == -1)
        throw new Error("Invalid request. Include valid month");

      const result =
        await this.budgetService.getBudgetTransactionsByMonthAndYear(
          monthNumber + 1,
          year,
          req.user
        );
      res.status(200).json({
        success: true,
        message: "Budget transactions retrieved successfully",
        data: result,
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };

  private editBudget = async (
    req: Request | any,
    res: Response,
    next: NextFunction
  ): Promise<IBudget | void> => {
    try {
      const { budgetName, budgetIcon } = req.body;

      logger(req.body);

      const budget: IBudget = await this.budgetService.editBudget(
        req.params.budgetId,
        budgetName,
        budgetIcon
      );

      res.status(201).json({
        success: true,
        message: "Budget edited successfully",
        data: {
          budget: {
            budgetName,
            budgetIcon,
          },
        },
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };
}

export default BudgetController;

import IController from "@/utils/interfaces/controller.interface";
import { Router, Response, Request, NextFunction } from "express";
import BillService from "./bill.service";
import HttpException from "@/utils/exceptions/http.exception";
import validationMiddleware from "@/middlewares/validation.middleware";
import authenticatedMiddleware from "@/middlewares/authenticate.middleware";
import kudaTokenHandler from "@/middlewares/kudaToken.middleware";
import validationObject from "./bill.validation";
import IBill from "./bill.interface";

class BillController implements IController {
  public path = "/bills";
  public router = Router();
  private billService = new BillService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(
      `${this.path}/categories/:billCategory/providers`,
      authenticatedMiddleware,
      kudaTokenHandler,
      this.getBillProviders
    );
    this.router.post(
      `${this.path}/customer/verify`,
      validationMiddleware(validationObject.verifyBillCustomer),
      authenticatedMiddleware,
      kudaTokenHandler,
      this.verifyCustomer
    );
    this.router.post(
      `${this.path}/purchase`,
      validationMiddleware(validationObject.billPurchase),
      authenticatedMiddleware,
      kudaTokenHandler,
      this.purchaseBill
    );
    this.router.get(
      `${this.path}/history/:billCategory`,
      authenticatedMiddleware,
      kudaTokenHandler,
      this.getBillsHistory
    );
  }

  private getBillProviders = async (
    req: Request | any,
    res: Response | any,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { billCategory }: { billCategory: string | undefined } = req.params;

      if (!billCategory)
        return next(new HttpException(400, "Include valid bill category."));

      const allowedCategories: string[] = [
        "airtime",
        "betting",
        "internet Data",
        "electricity",
        "cableTv",
      ];
      if (!allowedCategories.includes(billCategory))
        return next(new HttpException(400, "Include valid bill category."));

      const providers: object[] = await this.billService.getBillProviders(
        req.k_token,
        billCategory
      );

      res.status(200).json({
        success: true,
        message: "bill providers retrieved",
        data: providers,
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };

  private verifyCustomer = async (
    req: Request | any,
    res: Response | any,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        kudaBillItemIdentifier,
        customerIdentification,
      }: { kudaBillItemIdentifier: string; customerIdentification: string } =
        req.body;

      const customer: {} = await this.billService.verifyCustomer(
        req.k_token,
        req.referenceId,
        kudaBillItemIdentifier,
        customerIdentification
      );

      res.status(200).json({
        success: true,
        message: "customer verified successfully",
        data: customer,
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };

  private purchaseBill = async (
    req: Request | any,
    res: Response | any,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        kudaBillItemIdentifier,
        customerIdentification,
        amount,
        phoneNumber,
        pin,
        billCategory,
        billerName,
        billerImageUrl,
        narrations,
        budgetUniqueId,
        budgetItemId
      }: {
        kudaBillItemIdentifier: string;
        customerIdentification: string;
        amount: number;
        phoneNumber: string;
        pin: string;
        billCategory: string;
        billerName: string;
        billerImageUrl: string;
        narrations: string,
        budgetUniqueId: string,
        budgetItemId: string
      } = req.body;

      const response: {} = await this.billService.purchaseBill(
        req.user,
        pin,
        req.k_token,
        billCategory,
        req.referenceId,
        phoneNumber,
        amount,
        kudaBillItemIdentifier,
        customerIdentification,
        billerName,
        billerImageUrl,
        narrations,
        budgetUniqueId,
        budgetItemId
      );

      res.status(200).json({
        success: true,
        message: "Bill purchased. Payment successfully!",
        data: response,
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };

  private getBillsHistory = async (
    req: Request | any,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { billCategory }: { billCategory: string | undefined } = req.params;

      const allowedCategories: string[] = [
        "airtime",
        "betting",
        "internet Data",
        "electricity",
        "cableTv",
      ];
      if (!billCategory || !allowedCategories.includes(billCategory))
        return next(new HttpException(400, "Invalid bill category."));

      const billHistory = await this.billService.getBillHistoryById(
        req.user,
        billCategory
      );

      res.status(200).json({
        success: true,
        message: "Transactions retrieved successfully",
        data: billHistory,
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };
}

export default BillController;

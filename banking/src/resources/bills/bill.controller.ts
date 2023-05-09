import IController from "@/utils/interfaces/controller.interface";
import { Router, Response, Request, NextFunction } from "express";
import BillService from "./bill.service";
import HttpExeception from "@/utils/exceptions/http.exception";
import validationMiddleware from "@/middlewares/validation.middleware";
import authenticatedMiddleware from "@/middlewares/authenticate.middlware";
import kudaTokenHandler from "@/middlewares/kudaToken.middleware";
import validationObject from './bill.validation'

class BillController implements IController {
  public path = "/bills";
  public router = Router();
  private billService = new BillService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(`${this.path}/categories/:billCategory/providers`, authenticatedMiddleware, kudaTokenHandler, this.getBillProviders);
    this.router.post(`${this.path}/customer/verify`, validationMiddleware(validationObject.verifyBillCustomer), authenticatedMiddleware, kudaTokenHandler, this.verifyCustomer);
    this.router.post(`${this.path}/purchase`, validationMiddleware(validationObject.billPurchase), authenticatedMiddleware, kudaTokenHandler, this.purchaseBill)
  }

  private getBillProviders = async (
    req: Request | any,
    res: Response | any,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { billCategory }: { billCategory: string | undefined } = req.params;
      console.log(billCategory, "bill category");

      if (!billCategory)
        return next(new HttpExeception(400, "Include valid bill category."));

      const allowedCategories: string[] = [
        "airtime",
        "betting",
        "internet Data",
        "electricity",
        "cableTv",
      ];
      if (!allowedCategories.includes(billCategory))
        return next(new HttpExeception(400, "Include valid bill category."));

      const providers: object[] = await this.billService.getBillProviders(
        req.k_token,
        billCategory
      );
      console.log(providers, "billers");

      res.status(200).json({
        success: true,
        message: "bill providers retrieved",
        data: providers,
      });
    } catch (error: any) {
      return next(new HttpExeception(400, error.message));
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

      console.log(customer, "customer");

      res.status(200).json({
        success: true,
        message: "customer verified successfully",
        data: customer,
      });
    } catch (error: any) {
        return next(new HttpExeception(400, error.message));
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
        phoneNumber
      }: { kudaBillItemIdentifier: string; customerIdentification: string, amount: number, phoneNumber: string } =
        req.body;

      const response: {} = await this.billService.purchaseBill(
        req.k_token,
        req.referenceId,
        phoneNumber,
        amount,
        kudaBillItemIdentifier,
        customerIdentification
      );

      console.log(response, "response");

      res.status(200).json({
        success: true,
        message: "Bill purchased. Payment successfully!",
        data: response,
      });
    } catch (error: any) {
        return next(new HttpExeception(400, error.message));
    }
  };
}

export default BillController;

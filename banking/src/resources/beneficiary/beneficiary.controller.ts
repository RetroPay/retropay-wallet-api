import authenticatedMiddleware from "@/middlewares/authenticate.middleware";
import kudaTokenHandler from "@/middlewares/kudaToken.middleware";
import validationMiddleware from "@/middlewares/validation.middleware";
import HttpException from "@/utils/exceptions/http.exception";
import IController from "@/utils/interfaces/controller.interface";
import { NextFunction, Request, Response, Router } from "express";
import IBeneficiary from "./beneficiary.interface";
import BeneficiaryService from "./beneficiary.service";
import validate from "./beneficiary.validation";

class BeneficiaryController implements IController {
  public path = "/beneficiary";
  public router = Router();
  private beneficiaryService = new BeneficiaryService();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post(
      `${this.path}/create`,
      authenticatedMiddleware,
      validationMiddleware(validate.createBeneficiary),
      kudaTokenHandler,
      this.createBeneficiary
    );
    this.router.get(
      `${this.path}`,
      authenticatedMiddleware,
      this.getBeneficiaries
    );
  }

  private createBeneficiary = async (
    req: Request | any,
    res: Response | any,
    next: NextFunction
  ): Promise<IBeneficiary | void> => {
    try {
      const beneficiary = await this.beneficiaryService.createBeneficiary({
        userId: req.user,
        currency: req.body.currency,
        accountName: req.body.accountName,
        accountNumber: req.body.accountNumber,
        bankName: req.body.bankName,
        bankCode: req.body.bankCode,
        address: req.body.address,
        phoneNumber: req.body.phoneNumber,
      });

      res.status(201).json({
        success: true,
        message: "Beneficiary created successfully",
        data: beneficiary,
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };

  private getBeneficiaries = async (
    req: Request | any,
    res: Response | any,
    next: NextFunction
  ): Promise<IBeneficiary | void> => {
    try {
      const beneficiaries = await this.beneficiaryService.getAllBeneficiaries(
        req.user
      );

      res.status(201).json({
        success: true,
        message: "Beneficiaries retrieved successfully",
        data: beneficiaries,
      });
    } catch (error: any) {
      return next(new HttpException(400, error.message));
    }
  };
}

export default BeneficiaryController;

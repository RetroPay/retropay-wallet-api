import userModel from "@/resources/user/user.model";
import HttpException from "@/utils/exceptions/http.exception";
import { NextFunction, Request, Response } from "express";
import { logsnag } from "../server";

const verifyKycMiddleware = async (
  req: Request | any,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await userModel.findById(req.user);

    if (!user) {
      throw new Error("User not found");
    }

    const verificationInfo = user.verificationInformation;

    if (!verificationInfo) {
      throw new Error("KYC documents not found");
    }

    // Check each field for valid values
    if (
      verificationInfo.identificationNumber &&
      verificationInfo.dateOfBirth &&
      verificationInfo.country &&
      verificationInfo.documentType &&
      verificationInfo.documentNumber &&
      verificationInfo.documentFrontPicture &&
      verificationInfo.documentBackPicture &&
      verificationInfo.address &&
      verificationInfo.address.street &&
      verificationInfo.address.city &&
      verificationInfo.address.state &&
      verificationInfo.address.country &&
      verificationInfo.address.postalCode &&
      verificationInfo.selfiePhoto
    ) {
      next(); // All fields have valid values
    } else {
      throw new Error("Incomplete KYC documents"); // At least one field doesn't have a valid value
    }
  } catch (error) {
    await logsnag.publish({
      channel: "server",
      event: "Accounts Service - KYC documents verification failed",
      description: `KYC middleware failed: ${error}`,
      icon: "💥",
    });
    return next(new HttpException(400, (error as Error).message));
  }
};

export default verifyKycMiddleware;

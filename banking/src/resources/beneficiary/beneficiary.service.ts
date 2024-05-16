import logger from "@/utils/logger";
import IBeneficiary from "./beneficiary.interface";
import beneficiaryModel from "./beneficiary.model";

class BeneficiaryService {
  public async createBeneficiary({
    userId,
    currency,
    accountName,
    accountNumber,
    bankName,
    bankCode,
    address,
    phoneNumber,
  }: IBeneficiary): Promise<IBeneficiary> {
    try {
      switch (currency) {
        case "NGN":
        case "NGN_X":
        case "USD": {
          const newBeneficiary = this.createCurrencyBeneficiary({
            userId: userId,
            currency: currency,
            accountName: accountName,
            accountNumber: accountNumber,
            bankName: bankName,
            bankCode: bankCode,
            address: address,
            phoneNumber: phoneNumber,
          });

          logger(newBeneficiary);
          return newBeneficiary;
        }
        case "GHS":
        case "KES":
        case "XAF":
          const newBeneficiary = this.createMobileMoneyBeneficiary({
            userId: userId,
            currency: currency,
            accountName: accountName,
            phoneNumber: phoneNumber,
          });
          logger(newBeneficiary);
          return newBeneficiary;
        default:
          throw new Error("You can't save a beneficiary of this currency yet.");
      }
    } catch (error) {
      console.error(error, "error");
      throw new Error("We were unable to create this budget, please try again");
    }
  }

  private async createCurrencyBeneficiary({
    userId,
    currency,
    accountName,
    accountNumber,
    bankName,
    bankCode,
    address,
    phoneNumber,
  }: IBeneficiary): Promise<IBeneficiary> {
    try {
      if (currency === "USD" && !address) {
        throw new Error("Address cannot be empty");
      }

      if (!accountNumber) {
        throw new Error("Account number cannot be empty");
      }
      if (!bankName) {
        throw new Error("Bank name cannot be empty");
      }
      if (!bankCode) {
        throw new Error("Bank code cannot be empty");
      }
      if (!phoneNumber) {
        throw new Error("Phone number cannot be empty");
      }

      const beneficiary = new beneficiaryModel({
        userId: userId,
        currency: currency,
        accountName: accountName,
        accountNumber: accountNumber,
        bankName: bankName,
        bankCode: bankCode,
        address: address,
        phoneNumber: phoneNumber,
      });

      await beneficiary.save();

      return beneficiary;
    } catch (error: any) {
      console.error(error, "error");
      throw new Error(
        (error as Error).message ??
          "We were unable to save this beneficiary. Please try again"
      );
    }
  }

  private async createMobileMoneyBeneficiary({
    userId,
    currency,
    accountName,
    phoneNumber,
  }: IBeneficiary): Promise<IBeneficiary> {
    try {
      const beneficiary = new beneficiaryModel({
        userId: userId,
        currency: currency,
        accountName: accountName,
        phoneNumber: phoneNumber,
      });

      await beneficiary.save();

      return beneficiary;
    } catch (error) {
      console.error(error, "error");
      throw new Error(
        (error as Error).message ??
          "We were unable to save this beneficiary. Please try again"
      );
    }
  }

  public async getAllBeneficiaries(userId: string): Promise<any> {
    try {
      const beneficiaries: IBeneficiary[] | null = await beneficiaryModel
        .find({
          userId: userId,
        })
        .select("-userId")
        .sort({ createdAt: -1 });

      if (!beneficiaries) throw new Error("No beneficiaries found.");

      return beneficiaries;
    } catch (error: any) {
      console.error(error, "error");
      throw new Error(
        "Unable to retrieve your beneficiaries, please try again."
      );
    }
  }
}

export default BeneficiaryService;

import walletModel from "./wallet.model";
import { v4 } from "uuid";
import userModel from "../user/user.model";
import IWallet from "./wallet.interface";
import translateError from "@/helpers/mongod.helper";
import mongoose from "mongoose";
import axios from "axios";
import { redisClient, logsnag } from "../../server";
import billModel from "../bills/bill.model";
import IBill from "../bills/bill.interface";
import BillService from "../bills/bill.service";
import logger from "@/utils/logger";
import { usdAccountMeta, usdRecipientInfo } from "./wallet.type";
import IUser from "../user/user.interface";
import { calculateFees } from "@/utils/feeCalculator";
import { checkCurrenciesAvailability } from "@/utils/checkCurrency";
import generateOtp from "@/services/otp";
import { transferLimit } from "@/utils/transferLimit";

class WalletService {
  public async getTransactionsByMonthandYear(
    month: number,
    year: number,
    userId: string
  ): Promise<any | null> {
    try {
      const creditTransactions: any = await walletModel
        .find(
          {
            fundRecipientAccount: userId,
            // status: "success",
            $and: [
              { $expr: { $eq: [{ $month: "$createdAt" }, Number(month)] } },
              { $expr: { $eq: [{ $year: "$createdAt" }, Number(year)] } },
            ],
          },
          {
            fundOriginatorAccount: 0,
            fundRecipientAccount: 0,
            WebhookAcknowledgement: 0,
            senderWebhookAcknowledgement: 0,
            fundsReceivedbyRecipient: 0,
          }
        )
        .sort({ createdAt: -1 });

      const debitTransactions: any = await walletModel
        .find(
          {
            fundOriginatorAccount: userId,
            // status: "success",
            $and: [
              { $expr: { $eq: [{ $month: "$createdAt" }, month] } },
              { $expr: { $eq: [{ $year: "$createdAt" }, year] } },
            ],
          },
          {
            fundOriginatorAccount: 0,
            fundRecipientAccount: 0,
            WebhookAcknowledgement: 0,
            senderWebhookAcknowledgement: 0,
            fundsReceivedbyRecipient: 0,
          }
        )
        .sort({ createdAt: -1 });

      return { creditTransactions, debitTransactions };
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to retrieve transactions"
      );
    }
  }

  public async getYearlyTransactions(
    year: number,
    userId: string
  ): Promise<any> {
    try {
      if (year > new Date().getFullYear()) year = new Date().getFullYear();

      interface MonthlyTotal {
        [month: number]: number;
      }
      // Create an array of 12 months for the given year
      const months = Array.from(Array(12).keys()).map(
        (m) => new Date(year, m, 1)
      );

      // Query the database to get the total debit transactions for each month
      const debits = await walletModel.aggregate([
        {
          $match: {
            fundOriginatorAccount: new mongoose.Types.ObjectId(userId),
            $expr: { $eq: [{ $year: "$createdAt" }, Number(year)] },
          },
        },
        {
          $project: {
            amount: 1,
            month: { $month: "$createdAt" },
          },
        },
        {
          $group: {
            _id: "$month", // Group by month
            total: { $sum: "$amount" }, // Sum the amount field
          },
        },
      ]);

      // Map the results to an object with a debit total for each month
      const debitTotals: MonthlyTotal = {};
      debits.forEach(({ _id, total }) => (debitTotals[_id] = total));

      const debitOutput: MonthlyTotal = months.reduce((acc: any, month) => {
        const monthNum = month.getMonth() + 1;
        acc[monthNum] = debitTotals[monthNum] || 0;
        return acc;
      }, {});

      const debitTransactions: {
        _id: string;
        totalDebit: number;
      }[] = [];

      /*loop through debitOutput and push each key and value as a single object into debit transactions,
       * note: this is done so frontend dont have to do such data manipulations
       */
      for (const key in debitOutput) {
        if (Object.prototype.hasOwnProperty.call(debitOutput, key)) {
          const element = debitOutput[key];
          debitTransactions.push({ _id: key, totalDebit: debitOutput[key] });
        }
      }

      // Credit Transaction section

      // Query the database to get the total credit transactions for each month
      const credits = await walletModel.aggregate([
        {
          $match: {
            fundRecipientAccount: new mongoose.Types.ObjectId(userId),
            $expr: { $eq: [{ $year: "$createdAt" }, Number(year)] },
          },
        },
        {
          $project: {
            amount: 1,
            month: { $month: "$createdAt" },
          },
        },
        {
          $group: {
            _id: "$month",
            total: { $sum: "$amount" },
          },
        },
      ]);
      // Map the results to an object with a total for each month
      const creditTotals: MonthlyTotal = [];
      credits.forEach(({ _id, total }) => (creditTotals[_id] = total));

      const creditOutput: MonthlyTotal = months.reduce((acc: any, month) => {
        const monthNum = month.getMonth() + 1;
        acc[monthNum] = creditTotals[monthNum] || 0;
        return acc;
      }, {});

      const creditTransactions: {
        _id: string;
        totalCredit: number;
      }[] = [];

      /*loop through debitOutput and push each key and value as a single object into debit transactions,
       * note: this is done so frontend dont have to do such data manipulations
       */
      for (const key in creditOutput) {
        if (Object.prototype.hasOwnProperty.call(creditOutput, key)) {
          const element = creditOutput[key];
          creditTransactions.push({ _id: key, totalCredit: creditOutput[key] });
        }
      }

      return { year, debitTransactions, creditTransactions };
    } catch (error) {
      throw new Error(
        translateError(error)[0] || "Unable to retrieve yearly analytics"
      );
    }
  }

  public async getTransactionDetails(
    userId: string,
    reference: string
  ): Promise<IWallet | any> {
    try {
      const transaction: IWallet[] = await walletModel.aggregate([
        {
          $match: {
            referenceId: reference,
          },
        },
      ]);

      if (!transaction) throw new Error("Transaction not found.");

      if (
        transaction[0]?.fundRecipientAccount != userId &&
        transaction[0]?.fundOriginatorAccount != userId
      )
        throw new Error("Unauthorized");
      return transaction[0];
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to retrieve transaction"
      );
    }
  }

  public async getAccountBalanceV2(
    referenceId: string,
    k_token: string,
    userId: string
  ): Promise<any> {
    try {
      const balance = await walletModel.aggregate([
        {
          $match: {
            $or: [
              {
                fundOriginatorAccount: new mongoose.Types.ObjectId(userId),
                status:
                  process.env.NODE_ENV === "production" ? "success" : "pending",
              },
              {
                fundRecipientAccount: new mongoose.Types.ObjectId(userId),
                status:
                  process.env.NODE_ENV === "production" ? "success" : "pending",
              },
            ],
          },
        },
        {
          $group: {
            _id: {
              currency: "$currency",
            },
            totalDebits: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$fundOriginatorAccount",
                      new mongoose.Types.ObjectId(userId),
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            totalCredits: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$fundRecipientAccount",
                      new mongoose.Types.ObjectId(userId),
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            currency: "$_id.currency",
            balance: { $subtract: ["$totalCredits", "$totalDebits"] },
          },
        },
      ]);

      return balance;
    } catch (error) {
      throw new Error(
        translateError(error)[0] ||
          "Unable to retrieve your balance, please try again."
      );
    }
  }

  public async getCurrencyAccountBalanceV2(
    userId: string,
    currency: string
  ): Promise<any> {
    try {
      const balance = await walletModel.aggregate([
        {
          $match: {
            $or: [
              {
                fundOriginatorAccount: new mongoose.Types.ObjectId(userId),
                status:
                  process.env.NODE_ENV === "production" ? "success" : "pending",
              },
              {
                fundRecipientAccount: new mongoose.Types.ObjectId(userId),
                status:
                  process.env.NODE_ENV === "production" ? "success" : "pending",
              },
            ],
            currency: currency.toUpperCase(),
          },
        },
        {
          $group: {
            _id: null,
            debits: {
              $sum: {
                $cond: [
                  { $ifNull: ["$fundOriginatorAccount", false] },
                  "$amount",
                  0,
                ],
              },
            },
            credits: {
              $sum: {
                $cond: [
                  { $ifNull: ["$fundRecipientAccount", false] },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            balance: { $subtract: ["$credits", "$debits"] },
          },
        },
      ]);

      return balance[0].balance;
    } catch (error) {
      throw new Error(
        translateError(error)[0] ||
          "Unable to retrieve your balance, please try again."
      );
    }
  }

  public async getAccountBalance(
    referenceId: string, // tracking reference
    k_token: string,
    userId: string
  ): Promise<any> {
    try {
      const foundUser = await userModel.findOne({ referenceId });
      if (!foundUser?.nubanAccountDetails)
        throw new Error(
          "You don't have an account number yet. Kindly create a nuban account to get started."
        );

      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "RETRIEVE_VIRTUAL_ACCOUNT_BALANCE",
          RequestRef: v4(),
          data: {
            trackingReference: referenceId,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      if (!data.status) throw new Error(data.message);

      return data.data.availableBalance;
    } catch (error) {
      throw new Error(
        translateError(error)[0] ||
          "Unable to retrieve your balance, please try again."
      );
    }
  }

  public async getOneCurrencyAccountBalanceV2({
    userId,
    currency,
    referenceId,
    k_token,
  }: {
    userId: string;
    currency: string;
    referenceId: string;
    k_token: string;
  }) {
    try {
      switch (currency.toLowerCase()) {
        case "ngn":
          const nairaBalance: number = await this.getAccountBalance(
            referenceId,
            k_token,
            userId
          );

          return nairaBalance;

        default:
          const currencyBalance = await this.getCurrencyAccountBalanceV2(
            userId,
            currency
          );

          return currencyBalance;
      }
    } catch (error) {
      translateError(error)[0] ||
        "Unable to retrieve your balance, please try again.";
    }
  }

  private async validatePin(formPin: string, userId: string): Promise<boolean> {
    try {
      const foundUser = await userModel.findById(userId);

      if (!foundUser) throw new Error("Error validating your pin");

      if (await foundUser.isValidPin(formPin)) {
        return true;
      }
      return false;
    } catch (error) {
      throw new Error("Unable to validate pin.");
    }
  }

  public async transferFunds(
    formPin: string,
    amount: number,
    fundRecipientAccountTag: string,
    comment: string,
    userId: string,
    senderTag: string,
    referenceId: string,
    k_token: string,
    beneficiaryName: string,
    isBudgetTransaction?: boolean,
    budgetUniqueId?: string,
    budgetItemId?: string
  ): Promise<any> {
    try {
      //find recipient account
      const foundRecipient = await userModel.findOne({
        username: fundRecipientAccountTag,
      });

      if (!foundRecipient) throw new Error("Invalid recipient account.");

      //If intended recipient doesn't have a nuban account created yet
      if (!foundRecipient?.nubanAccountDetails?.nuban)
        throw new Error("Invalid recipient account.");

      const foundUser = await userModel
        .findById(userId)
        .select("firstname lastname profilePhoto username email");

      if (!foundUser) throw new Error("Unable to process transaction.");

      // If user tries to transfer to their own account lol.
      if (foundRecipient._id == userId)
        throw new Error("Unable to process transaction.");

      if (!(await this.validatePin(formPin, userId)))
        throw new Error("Transfer failed - Incorrect transaction pin");

      const response = await axios({
        method: "post",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          serviceType: "VIRTUAL_ACCOUNT_FUND_TRANSFER",
          requestRef: v4(),
          data: {
            trackingReference: referenceId, //Unique identifier of user with Kuda
            beneficiaryAccount: foundRecipient?.nubanAccountDetails?.nuban,
            amount: amount * 100, //amount in Kobo
            narration: "retro-trf: " + comment,
            beneficiaryBankCode: await redisClient.get("kudaBankCode"),
            beneficiaryName,
            senderName: foundUser.lastname + " " + foundUser.firstname,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;
      logger(data);

      //if axios call is successful but kuda status returns failed e'g 400 errors
      if (!data.status) {
        const { responseCode } = data;

        switch (String(responseCode)) {
          case "06":
            throw new Error("Transfer failed - processing error.");
            break;
          case "52":
            throw new Error("Transfer failed - Inactive recipient account.");
            break;
          case "23":
            throw new Error(
              "Transfer failed - A PND is active on your account. Kindly contact support."
            );
            break;
          case "51":
            throw new Error("Transfer failed - Insufficient funds on account.");
            break;
          case "93":
            throw new Error(
              "Transfer failed - Cash limit exceeded for your account tier."
            );
            break;
          case "k91":
            throw new Error(
              "Transfer error - Transaction timeout, Kindly contact support to confirm transaction status."
            );
            break;
          default:
            throw new Error(data.message);
        }
      }

      //Log new transaction
      const newTransaction = await walletModel.create({
        fundRecipientAccount: foundRecipient._id,
        fundOriginatorAccount: userId,
        amount,
        transactionType: "transfer",
        status: "pending",
        referenceId:
          process.env.NODE_ENV == "development"
            ? "test-transfer" + v4()
            : data.transactionReference,
        comment,
        recepientTag: fundRecipientAccountTag,
        senderTag,
        responseCode: data.responseCode,
        beneficiaryName,
        currency: "NGN",
        processingFees: 15,
        senderProfile: foundUser.profilePhoto?.url,
        recipientProfile: foundRecipient.profilePhoto?.url,
        isBudgetTransaction,
        budgetUniqueId,
        budgetItemId,
      });

      // if transfer is successful, charge transaction fee
      this.chargeTransactionFees("transfer", referenceId, userId, k_token);

      return {
        amount,
        transactionId: data.transactionReference,
        fundRecipientAccountTag,
        transactionType: "Transfer",
        createdAt: newTransaction?.createdAt,
      };
    } catch (error) {
      logger(error);
      await logsnag.publish({
        channel: "failed-requests",
        event: "Transfer failed",
        description: `An attempt to transfer funds between wallet users has failed. err: ${error}`,
        icon: "😥",
        notify: true,
      });

      throw new Error(
        translateError(error)[0] || "Unable to process transaction."
      );
    }
  }

  private async chargeTransactionFees(
    transactionType: string,
    referenceId: string,
    userId: string,
    k_token: string
  ): Promise<void> {
    try {
      const response = await axios({
        method: "post",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          serviceType: "WITHDRAW_VIRTUAL_ACCOUNT",
          requestRef: v4(),
          data: {
            trackingReference: referenceId, // Unique identifier of user with Kuda
            amount: 10 * 100,
            narration: "Transaction fee",
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      //if axios call is successful but kuda status returns failed e'g 400 errors
      if (!data.status) {
        const { responseCode } = data;

        switch (responseCode) {
          case "06":
            throw new Error("Transfer failed - processing error.");
            break;
          case "52":
            throw new Error("Transfer failed - Inactive recipient account.");
            break;
          case "23":
            throw new Error(
              "Transfer failed - A PND is active on your account. Kindly contact support."
            );
            break;
          case "51":
            throw new Error("Transfer failed - Insufficient funds on account.");
            break;
          case "93":
            throw new Error(
              "Transfer failed - Cash limit exceeded for your account tier."
            );
            break;
          case "k91":
            throw new Error(
              "Transfer error - Transaction timeout, Kindly contact support to confirm transaction status."
            );
            break;
          default:
            throw new Error("Transfer failed - processing error.");
        }
      }
    } catch (error) {
      await logsnag.publish({
        channel: "failed-requests",
        event: "Charge transaction fee failed",
        description: `The service to handle charging of transfer fees has failed. err: ${error}`,
        icon: "⚠👀",
        notify: false,
      });
    }
  }

  private async chargeTransactionFeesV2(
    transactionType: string,
    currency: string,
    userId: string,
    amount: number,
    transactionDate: string,
    referenceId: string,
    k_token: string,
    beneficiaryName: string
  ): Promise<void> {
    try {
      switch (currency.toUpperCase()) {
        case "NGN_X":
        case "XAF":
        case "KES":
        case "GHS":
          {
            const transactionFee = await walletModel.create({
              fundOriginatorAccount: userId,
              currency,
              amount: await calculateFees(currency, amount),
              transactionType,
              status: "success",
              referenceId: "charges-" + v4(),
              comment: `Transaction fee for ${currency}${amount} sent to ${beneficiaryName}. Date: ${transactionDate}`,
            });

            logger(transactionFee);

            return;
          }
          break;
        case "NGN": {
          const response = await axios({
            method: "post",
            url:
              process.env.NODE_ENV == "production"
                ? "https://kuda-openapi.kuda.com/v2.1"
                : "https://kuda-openapi-uat.kudabank.com/v2.1",
            data: {
              serviceType: "WITHDRAW_VIRTUAL_ACCOUNT",
              requestRef: v4(),
              data: {
                trackingReference: referenceId, // Unique identifier of user with Kuda
                amount: 10 * 100,
                narration: "Transaction fee",
              },
            },
            headers: {
              Authorization: `Bearer ${k_token}`,
            },
          });

          const data = response.data;

          //if axios call is successful but kuda status returns failed e'g 400 errors
          if (!data.status) {
            const { responseCode } = data;

            switch (responseCode) {
              case "06":
                throw new Error("Transfer failed - processing error.");
                break;
              case "52":
                throw new Error(
                  "Transfer failed - Inactive recipient account."
                );
                break;
              case "23":
                throw new Error(
                  "Transfer failed - A PND is active on your account. Kindly contact support."
                );
                break;
              case "51":
                throw new Error(
                  "Transfer failed - Insufficient funds on account."
                );
                break;
              case "93":
                throw new Error(
                  "Transfer failed - Cash limit exceeded for your account tier."
                );
                break;
              case "k91":
                throw new Error(
                  "Transfer error - Transaction timeout, Kindly contact support to confirm transaction status."
                );
                break;
              default:
                throw new Error("Transfer failed - processing error.");
            }
          }
        }
        default:
          throw new Error("Currency not supported");
          break;
      }
    } catch (error: any) {
      await logsnag.publish({
        channel: "failed-requests",
        event: "Charge transaction fee failed",
        description: `The service to handle charging of transfer fees has failed. err: ${error}`,
        icon: "⚠👀",
        notify: true,
      });
    }
  }

  public async withdrawFunds(
    formPin: string,
    referenceId: string,
    userId: string,
    amount: number,
    beneficiaryAccount: string,
    comment: string,
    beneficiaryBankCode: string,
    beneficiaryBank: string,
    beneficiaryName: string,
    nameEnquiryId: string,
    k_token: string,
    isBudgetTransaction?: boolean,
    budgetUniqueId?: string,
    budgetItemId?: string
  ): Promise<IWallet | any> {
    try {
      const foundUser = await userModel
        .findById(userId)
        .select("firstname lastname");
      if (!foundUser) throw new Error("Unable to process transaction.");

      if ((await this.validatePin(formPin, userId)) == false)
        throw new Error("Transfer failed - Incorrect transaction pin");

      const response = await axios({
        method: "post",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          serviceType: "VIRTUAL_ACCOUNT_FUND_TRANSFER",
          requestRef: v4(),
          data: {
            trackingReference: referenceId, //Unique identifier of user with Kuda
            beneficiaryAccount,
            amount: amount * 100, //amount in Kobo
            narration: "retro-trf: " + comment,
            beneficiaryBankCode,
            beneficiaryName,
            senderName: foundUser.lastname + " " + foundUser.firstname,
            nameEnquiryId,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      //if axios call is successful but kuda status returns failed e'g 400 errors
      if (!data.status) {
        const { responseCode } = data;

        switch (responseCode) {
          case "-1":
            throw new Error("Transfer failed - Transaction cancelled.");
            break;
          case "-2":
          case "51":
            throw new Error("Transfer failed. Insufficient funds");
            break;
          case "-3":
            throw new Error("Transfer failed - Unable to process transaction");
            break;
          case "91":
            throw new Error("Transfer failed - Request timeout.");
            break;
          default:
            throw new Error(
              "Transfer error - We were unable to process your transaction, please try again."
            );
        }
      }

      const newTransaction = await walletModel.create({
        fundOriginatorAccount: userId,
        amount,
        transactionType: "withdrawal",
        status: "pending",
        referenceId:
          process.env.NODE_ENV == "development"
            ? "test-withdrawal" + v4()
            : data.transactionReference,
        processingFees: 30,
        comment,
        beneficiaryBankCode,
        beneficiaryBank,
        beneficiaryName,
        nameEnquiryId,
        beneficiaryAccount,
        responseCode: data.responseCode,
        currency: "NGN",
        isBudgetTransaction,
        budgetUniqueId,
        budgetItemId,
      });

      logger(newTransaction);
      // if transfer is successful, charge transaction fee
      this.chargeTransactionFees("withdraw", referenceId, userId, k_token);

      return {
        amount,
        transactionId: data.transactionReference,
        beneficiaryName,
        beneficiaryBank,
        beneficiaryAccount,
        transactionType: "Withdrawal",
        createdAt: newTransaction?.createdAt,
      };
    } catch (error) {
      await logsnag.publish({
        channel: "failed-requests",
        event: "Withdrawal failed",
        description: `An attempt to withdraw funds to a bank account has failed. err: ${error}`,
        icon: "😭",
        notify: true,
      });

      throw new Error(
        translateError(error)[0] ||
          "Transfer failed - Unable to process transfer."
      );
    }
  }

  public async withdrawFunds_v2(
    currency: string,
    formPin: string,
    referenceId: string,
    userId: string,
    amount: number,
    beneficiaryAccount: string,
    comment: string,
    beneficiaryBankCode: string,
    beneficiaryBank: string,
    k_token: string,
    beneficiaryName: string,
    nameEnquiryId?: string,
    recipientInfo?: usdRecipientInfo,
    isBudgetTransaction?: boolean,
    budgetUniqueId?: string,
    budgetItemId?: string
  ): Promise<IWallet | any> {
    try {
      await checkCurrenciesAvailability(currency);
      await transferLimit(currency, amount);

      currency = currency.toUpperCase();

      const foundUser = await userModel
        .findOne({
          _id: userId,
          "currencyAccounts.currency": currency,
          "currencyAccounts.status": "approved",
          "currencyAccounts.isActive": true,
        })
        .select(
          "firstname lastname phoneNumber verificationInformation isIdentityVerified currencyAccounts"
        );

      if (!foundUser)
        throw new Error(
          `Create an active ${currency} account to make payments.`
        );

      if (!foundUser.isIdentityVerified)
        throw new Error(`Verify your identity to proceed.`);

      if (!foundUser.verificationInformation)
        throw new Error("KYC documents not found.");

      if ((await this.validatePin(formPin, userId)) == false)
        throw new Error("Transfer failed - Incorrect transaction pin");

      interface Args {
        [key: string]: any;
      }

      const args: Args = {
        currency,
        formPin,
        amount,
        beneficiaryAccount,
        comment,
        beneficiaryBankCode,
        beneficiaryBank,
        beneficiaryName,
        nameEnquiryId,
        recipientInfo,
      };

      switch (currency) {
        case "NGN":
          {
            const ngnRequiredProperties: (keyof Args)[] = [
              "amount",
              "beneficiaryAccount",
              "comment",
              "beneficiaryBankCode",
              "beneficiaryBank",
              "beneficiaryName",
              "nameEnquiryId",
            ];

            // check that required parameters for ngn currency payments are passed to method
            const errors: string[] = [];

            for (const key of ngnRequiredProperties) {
              if (!args.hasOwnProperty(key) || args[key] === undefined)
                errors.push(`${key} is required for this currency.`);
            }

            if (errors.length > 0) throw new Error(errors.toString());

            const response = await this.initialize_ngn_payment(
              referenceId,
              userId,
              amount,
              beneficiaryAccount,
              comment,
              beneficiaryBankCode,
              beneficiaryBank,
              beneficiaryName,
              k_token,
              foundUser.firstname,
              foundUser.lastname,
              nameEnquiryId,
              isBudgetTransaction,
              budgetUniqueId,
              budgetItemId
            );

            this.chargeTransactionFeesV2(
              "withdrawal",
              currency,
              userId,
              amount,
              response?.createdAt || new Date().toISOString(),
              referenceId,
              k_token,
              beneficiaryName
            );

            return response;
          }
          break;
        case "USD":
          {
            const usdRequiredProperties: (keyof Args)[] = [
              "amount",
              "beneficiaryAccount",
              "comment",
              "beneficiaryBankCode",
              "beneficiaryBank",
              "beneficiaryName",
              "recipientInfo",
            ];

            // check that required parameters for ngn currency payments are passed to method
            const errors: string[] = [];

            for (const key of usdRequiredProperties) {
              if (!args.hasOwnProperty(key) || args[key] === undefined)
                errors.push(`${key} is required for this currency.`);
            }
            logger(errors);
            if (errors.length > 0) throw new Error(errors.toString());

            const balance = await this.calculateMapleradCurrencyBalance(
              currency,
              userId
            );

            if (amount >= balance)
              throw new Error("Transfer failed - Insufficient funds");

            const { postalCode, street, city, state, country } =
              foundUser?.verificationInformation.address;

            const response = await this.initialize_USD_Payment(
              userId,
              beneficiaryAccount,
              beneficiaryBankCode,
              beneficiaryBank,
              beneficiaryName,
              amount,
              comment,
              foundUser.firstname,
              foundUser.lastname,
              foundUser?.phoneNumber,
              `${postalCode}, ${street}, ${city}, ${state}, ${country},`,
              country,
              recipientInfo
            );

            logger(response);

            this.chargeTransactionFeesV2(
              "withdrawal",
              currency,
              userId,
              amount,
              response?.createdAt || new Date().toISOString(),
              referenceId,
              k_token,
              beneficiaryName
            );

            return response;
          }
          break;
        case "XAF":
        case "GHS":
        case "KES":
          {
            const mobileMoneyRequiredProperties: (keyof Args)[] = [
              "amount",
              "beneficiaryAccount",
              "comment",
              "beneficiaryBankCode",
              "beneficiaryBank",
              "beneficiaryName",
              "recipientInfo",
            ];

            // check that required parameters for ngn currency payments are passed to method
            const errors: string[] = [];

            for (const key of mobileMoneyRequiredProperties) {
              if (!args.hasOwnProperty(key) || args[key] === undefined)
                errors.push(`${key} is required for this currency.`);
            }
            logger(errors);
            if (errors.length > 0) throw new Error(errors.toString());

            const balance = await this.calculateMapleradCurrencyBalance(
              currency,
              userId
            );

            if (amount >= balance)
              throw new Error("Transfer failed - Insufficient funds");

            const response = await this.initialize_mobile_money_payment(
              currency,
              userId,
              beneficiaryAccount,
              beneficiaryBankCode,
              beneficiaryBank,
              beneficiaryName,
              amount,
              comment,
              recipientInfo
            );

            this.chargeTransactionFeesV2(
              "withdrawal",
              currency,
              userId,
              amount,
              response?.createdAt || new Date().toISOString(),
              referenceId,
              k_token,
              beneficiaryName
            );

            return response;
          }
          break;
        case "NGN_X": {
          const ngn_xRequiredProperties: (keyof Args)[] = [
            "amount",
            "beneficiaryAccount",
            "comment",
            "beneficiaryBankCode",
            "beneficiaryBank",
            "beneficiaryName",
          ];

          // check that required parameters for ngn currency payments are passed to method
          const errors: string[] = [];

          for (const key of ngn_xRequiredProperties) {
            if (!args.hasOwnProperty(key) || args[key] === undefined)
              errors.push(`${key} is required for this currency.`);
          }
          logger(errors);
          if (errors.length > 0) throw new Error(errors.toString());

          const balance = await this.calculateMapleradCurrencyBalance(
            currency,
            userId
          );

          if (amount >= balance)
            throw new Error("Transfer failed - Insufficient funds");

          const response = await this.initialize_NGN_X_payment(
            currency,
            userId,
            beneficiaryAccount,
            beneficiaryBankCode,
            beneficiaryBank,
            beneficiaryName,
            amount,
            comment
          );

          logger(response);
          this.chargeTransactionFeesV2(
            "withdrawal",
            currency,
            userId,
            amount,
            response?.createdAt || new Date().toISOString(),
            referenceId,
            k_token,
            beneficiaryName
          );

          return response;
        }
        default:
          throw new Error("Currency not supported.");
          break;
      }
    } catch (error) {
      await logsnag.publish({
        channel: "failed-requests",
        event: "Withdrawal failed",
        description: `An attempt to withdraw funds to a bank account has failed. err: ${error}`,
        icon: "😭",
        notify: true,
      });

      throw new Error(
        translateError(error)[0] ||
          "Transfer failed - Unable to process transfer."
      );
    }
  }

  public async transferFundsV2(
    formPin: string,
    amount: number,
    currency: string,
    fundRecipientAccountTag: string,
    comment: string,
    userId: string,
    senderTag: string,
    referenceId: string,
    k_token: string,
    beneficiaryName: string,
    isBudgetTransaction?: boolean,
    budgetUniqueId?: string,
    budgetItemId?: string
  ): Promise<any> {
    try {
      currency = currency.toUpperCase();

      await checkCurrenciesAvailability(currency);
      await transferLimit(currency, amount);

      const foundUser = await userModel
        .findOne({
          _id: userId,
          "currencyAccounts.currency": currency,
          "currencyAccounts.status": "approved",
          "currencyAccounts.isActive": true,
        })
        .select(
          "firstname lastname phoneNumber verificationInformation isIdentityVerified currencyAccounts"
        );

      if (!foundUser)
        throw new Error(
          `Create an active ${currency} account to make payments.`
        );

      if (!foundUser.isIdentityVerified)
        throw new Error(`Verify your identity to proceed.`);

      if (!foundUser.verificationInformation)
        throw new Error("KYC documents not found.");

      const fundsRecipient = await userModel.findOne({
        username: fundRecipientAccountTag,
        "currencyAccounts.currency": currency,
        "currencyAccounts.status": "approved",
        "currencyAccounts.isActive": true,
      });

      if (!fundsRecipient) throw new Error("Invalid recipient account.");

      if (fundsRecipient._id == userId)
        throw new Error("Unable to process transaction.");

      if (currency == "NGN" && !fundsRecipient?.nubanAccountDetails?.nuban)
        throw new Error("Invalid recipient account.");

      if ((await this.validatePin(formPin, userId)) == false)
        throw new Error("Transfer failed - Incorrect transaction pin");

      switch (currency) {
        case "NGN":
          {
            const response = await axios({
              method: "post",
              url:
                process.env.NODE_ENV == "production"
                  ? "https://kuda-openapi.kuda.com/v2.1"
                  : "https://kuda-openapi-uat.kudabank.com/v2.1",
              data: {
                serviceType: "VIRTUAL_ACCOUNT_FUND_TRANSFER",
                requestRef: v4(),
                data: {
                  trackingReference: referenceId, //Unique identifier of user with Kuda
                  beneficiaryAccount: fundsRecipient.nubanAccountDetails?.nuban,
                  amount: amount * 100, //amount in Kobo
                  narration: "retro-trf: " + comment,
                  beneficiaryBankCode: await redisClient.get("kudaBankCode"),
                  beneficiaryName,
                  senderName: foundUser.lastname + " " + foundUser.firstname,
                  clientFeeCharge: 10 * 100,
                },
              },
              headers: {
                Authorization: `Bearer ${k_token}`,
              },
            });

            const data = response.data;

            //if axios call is successful but kuda status returns failed e'g 400 errors
            if (!data.status) {
              const { responseCode } = data;

              switch (String(responseCode)) {
                case "06":
                  throw new Error("Transfer failed - processing error.");
                  break;
                case "52":
                  throw new Error(
                    "Transfer failed - Inactive recipient account."
                  );
                  break;
                case "23":
                  throw new Error(
                    "Transfer failed - A PND is active on your account. Kindly contact support."
                  );
                  break;
                case "51":
                  throw new Error(
                    "Transfer failed - Insufficient funds on account."
                  );
                  break;
                case "93":
                  throw new Error(
                    "Transfer failed - Cash limit exceeded for your account tier."
                  );
                  break;
                case "k91":
                  throw new Error(
                    "Transfer error - Transaction timeout, Kindly contact support to confirm transaction status."
                  );
                  break;
                default:
                  throw new Error(data.message);
              }
            }

            //Log new transaction
            const newTransaction = await walletModel.create({
              fundRecipientAccount: fundsRecipient._id,
              fundOriginatorAccount: userId,
              amount,
              transactionType: "transfer",
              status: "pending",
              referenceId:
                process.env.NODE_ENV == "development"
                  ? "test-transfer" + v4()
                  : data.transactionReference,
              comment,
              recepientTag: fundRecipientAccountTag,
              senderTag,
              responseCode: data.responseCode,
              beneficiaryName,
              currency: "NGN",
              processingFees: 15,
              senderProfile: foundUser.profilePhoto?.url,
              recipientProfile: fundsRecipient.profilePhoto?.url,
              isBudgetTransaction,
              budgetUniqueId,
              budgetItemId,
            });

            // if transfer is successful, charge transaction fee
            this.chargeTransactionFeesV2(
              "transfer",
              currency,
              userId,
              amount,
              newTransaction?.createdAt || new Date().toISOString(),
              referenceId,
              k_token,
              fundRecipientAccountTag
            );

            return {
              amount,
              transactionId: data.transactionReference,
              fundRecipientAccountTag,
              transactionType: "Transfer",
              currency,
              createdAt: newTransaction?.createdAt,
            };
          }
          break;
        case "GHS":
        case "XAF":
        case "KES":
          {
            const balance = await this.calculateMapleradCurrencyBalance(
              currency,
              userId
            );

            if (amount >= balance)
              throw new Error("Transfer failed - Insufficient funds");

            const transactionId =
              process.env.NODE_ENV == "development"
                ? "test-transfer" + v4()
                : v4();

            const newTransaction = await walletModel.create({
              fundRecipientAccount: fundsRecipient._id,
              fundOriginatorAccount: userId,
              amount,
              transactionType: "transfer",
              status: "success",
              referenceId: transactionId,
              comment,
              recepientTag: fundRecipientAccountTag,
              senderTag,
              beneficiaryName,
              currency,
              processingFees: await calculateFees(currency, amount),
              senderProfile: foundUser.profilePhoto?.url,
              recipientProfile: fundsRecipient.profilePhoto?.url,
              isBudgetTransaction,
              budgetUniqueId,
              budgetItemId,
            });

            if (!newTransaction)
              throw new Error(
                "Unable to process transaction. Please try again."
              );

            // if transfer is successful, charge transaction fee
            this.chargeTransactionFeesV2(
              "transfer",
              currency,
              userId,
              amount,
              newTransaction?.createdAt || new Date().toISOString(),
              referenceId,
              k_token,
              fundRecipientAccountTag
            );

            return {
              amount,
              transactionId: transactionId,
              fundRecipientAccountTag,
              transactionType: "Transfer",
              createdAt: newTransaction?.createdAt,
            };
          }
          break;
        case "NGN_X":
          {
            const balance = await this.calculateMapleradCurrencyBalance(
              currency,
              userId
            );

            if (amount >= balance)
              throw new Error("Transfer failed - Insufficient funds");

            const accountDetails = fundsRecipient.currencyAccounts.find(
              (obj) => {
                return obj.currency === "NGN_X";
              }
            );

            if (!accountDetails) throw new Error("Invalid recipient account.");

            const { accountNumber, bankName, accountName } = accountDetails;

            const bankList = await this.getBankListV2(k_token, currency);
            const bank = bankList.find((obj: any) => {
              return obj.name === bankName;
            });
            await redisClient.set("ngnXBankCode", bank.code);

            const response = await axios({
              method: "post",
              url:
                process.env.NODE_ENV == "production"
                  ? "https://api.maplerad.com/v1/transfers"
                  : "https://sandbox.api.maplerad.com/v1/transfers",
              data: {
                account_number: accountNumber,
                bank_code: bank.code,
                amount: amount * 100,
                reason: "retro-trf: " + comment,
                currency: "NGN",
                reference:
                  process.env.NODE_ENV == "development"
                    ? "test-withdrawal" + v4()
                    : "retro-trf" + v4(),
              },
              headers: {
                Authorization: `Bearer ${process.env.MAPLERAD_SECRET_KEY}`,
              },
            });

            const data = response.data;
            logger(data);

            if (!data.status) throw new Error("Transfer failed");

            //Log new transaction
            const newTransaction = await walletModel.create({
              fundRecipientAccount: fundsRecipient._id,
              fundOriginatorAccount: userId,
              amount,
              transactionType: "transfer",
              status: "pending",
              referenceId:
                process.env.NODE_ENV == "development"
                  ? "test-transfer" + v4()
                  : data.transactionReference,
              comment,
              recepientTag: fundRecipientAccountTag,
              senderTag,
              responseCode: data.responseCode,
              beneficiaryName,
              currency,
              processingFees: await calculateFees(currency, amount),
              senderProfile: foundUser.profilePhoto?.url,
              recipientProfile: fundsRecipient.profilePhoto?.url,
              isBudgetTransaction,
              budgetUniqueId,
              budgetItemId,
            });

            // if transfer is successful, charge transaction fee
            this.chargeTransactionFeesV2(
              "transfer",
              currency,
              userId,
              amount,
              newTransaction?.createdAt || new Date().toISOString(),
              referenceId,
              k_token,
              fundRecipientAccountTag
            );

            return {
              amount,
              transactionId: data.transactionReference,
              fundRecipientAccountTag,
              transactionType: "Transfer",
              currency,
              createdAt: newTransaction?.createdAt,
            };
          }
          break;
        default:
          throw new Error("Currency not supported.");
          break;
      }
    } catch (error) {
      logger(error);
      await logsnag.publish({
        channel: "failed-requests",
        event: "Transfer failed",
        description: `An attempt to transfer funds between wallet users has failed. err: ${error}`,
        icon: "😥",
        notify: true,
      });

      throw new Error(
        translateError(error)[0] || "Unable to process transaction."
      );
    }
  }

  public async calculateMapleradCurrencyBalance(
    currency: string,
    userId: string
  ): Promise<number> {
    try {
      const balance = await walletModel.aggregate([
        {
          $match: {
            $or: [
              {
                fundOriginatorAccount: new mongoose.Types.ObjectId(userId),
                // status:
                //   process.env.NODE_ENV === "production" ? "success" : "pending",
                currency,
              },
              {
                fundRecipientAccount: new mongoose.Types.ObjectId(userId),
                // status:
                //   process.env.NODE_ENV === "production" ? "success" : "pending",
                currency,
              },
            ],
          },
        },
        {
          $group: {
            _id: 0,
            totalDebits: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$fundOriginatorAccount",
                      new mongoose.Types.ObjectId(userId),
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
            totalCredits: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      "$fundRecipientAccount",
                      new mongoose.Types.ObjectId(userId),
                    ],
                  },
                  "$amount",
                  0,
                ],
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            balance: { $subtract: ["$totalCredits", "$totalDebits"] },
          },
        },
      ]);

      logger(balance);

      if (!balance)
        throw new Error(
          "Unable to retrieve account balance. Please try again."
        );

      if (balance.length == 0) return 0;

      return balance[0].balance;
    } catch (error: any) {
      throw new Error("Unable to retrieve account balance. Please try again.");
    }
  }

  private async initialize_ngn_payment(
    referenceId: string,
    userId: string,
    amount: number,
    beneficiaryAccount: string,
    comment: string,
    beneficiaryBankCode: string,
    beneficiaryBank: string,
    beneficiaryName: string,
    k_token: string,
    firstname: string,
    lastname: string,
    nameEnquiryId?: string,
    isBudgetTransaction?: boolean,
    budgetUniqueId?: string,
    budgetItemId?: string
  ): Promise<IWallet | any> {
    try {
      const response = await axios({
        method: "post",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          serviceType: "VIRTUAL_ACCOUNT_FUND_TRANSFER",
          requestRef: v4(),
          data: {
            trackingReference: referenceId, //Unique identifier of user with Kuda
            beneficiaryAccount,
            amount: amount * 100, //amount in Kobo
            narration: "retro-trf: " + comment,
            beneficiaryBankCode,
            beneficiaryName,
            senderName: lastname + " " + firstname,
            nameEnquiryId,
            clientFeeCharge: 10 * 100,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      //if axios call is successful but kuda status returns failed e'g 400 errors
      if (!data.status) {
        const { responseCode } = data;

        switch (responseCode) {
          case "-1":
            throw new Error("Transfer failed - Transaction cancelled.");
            break;
          case "-2":
          case "51":
            throw new Error("Transfer failed. Insufficient funds");
            break;
          case "-3":
            throw new Error("Transfer failed - Unable to process transaction");
            break;
          case "91":
            throw new Error("Transfer failed - Request timeout.");
            break;
          default:
            throw new Error(
              "Transfer error - We were unable to process your transaction, please try again."
            );
        }
      }

      const newTransaction = await walletModel.create({
        fundOriginatorAccount: userId,
        amount,
        transactionType: "withdrawal",
        status: "pending",
        referenceId:
          process.env.NODE_ENV == "development"
            ? "test-withdrawal" + v4()
            : data.transactionReference,
        processingFees: 30,
        comment,
        beneficiaryBankCode,
        beneficiaryBank,
        beneficiaryName,
        nameEnquiryId,
        beneficiaryAccount,
        responseCode: data.responseCode,
        currency: "NGN",
        isBudgetTransaction,
        budgetUniqueId,
        budgetItemId,
      });

      logger(newTransaction);

      return {
        amount,
        transactionId: data.transactionReference,
        beneficiaryName,
        beneficiaryBank,
        beneficiaryAccount,
        transactionType: "Withdrawal",
        createdAt: newTransaction?.createdAt,
      };
    } catch (error) {
      await logsnag.publish({
        channel: "failed-requests",
        event: "Withdrawal failed",
        description: `An attempt to withdraw funds to a bank account has failed. err: ${error}`,
        icon: "😭",
        notify: true,
      });

      throw new Error(
        translateError(error)[0] ||
          "Transfer failed - Unable to process transfer."
      );
    }
  }

  private async initialize_NGN_X_payment(
    currency: string,
    userId: string,
    beneficiaryAccountNumber: string,
    beneficiaryBankCode: string,
    beneficiaryBank: string,
    beneficiaryName: string,
    amount: number,
    comment: string
  ): Promise<any> {
    /** Method processes ngn-x payments */

    try {
      const response = await axios({
        method: "post",
        url:
          process.env.NODE_ENV == "production"
            ? "https://api.maplerad.com/v1/transfers"
            : "https://sandbox.api.maplerad.com/v1/transfers",
        data: {
          account_number: beneficiaryAccountNumber,
          bank_code: beneficiaryBankCode,
          amount: amount * 100,
          reason: "retro-trf: " + comment,
          currency: "NGN",
          reference:
            process.env.NODE_ENV == "development"
              ? "test-withdrawal" + v4()
              : "retro-trf" + v4(),
        },
        headers: {
          Authorization: `Bearer ${process.env.MAPLERAD_SECRET_KEY}`,
        },
      });

      const data = response.data;
      logger(data);

      if (!data.status) throw new Error("Transfer failed");

      const newTransaction = await walletModel.create({
        fundOriginatorAccount: userId,
        amount,
        transactionType: "withdrawal",
        status: "pending",
        referenceId:
          process.env.NODE_ENV == "development"
            ? "test-withdrawal" + v4()
            : data.transactionReference,
        processingFees: await calculateFees(currency, amount),
        comment,
        beneficiaryBankCode,
        beneficiaryBank,
        beneficiaryName,
        beneficiaryAccountNumber,
        currency,
        scheme: "BANK",
      });

      logger(newTransaction);

      return {
        amount,
        transactionId: data.reference,
        beneficiaryName,
        beneficiaryBank,
        beneficiaryAccountNumber,
        transactionType: "Withdrawal",
        createdAt: newTransaction?.createdAt,
      };
    } catch (error: any) {
      await logsnag.publish({
        channel: "failed-requests",
        event: "Withdrawal failed",
        description: `An attempt to withdraw USDfunds to a bank account has failed. err: ${error}`,
        icon: "😭",
        notify: true,
      });

      throw new Error(
        translateError(error)[0] ||
          "Transfer failed - Unable to process transfer."
      );
    }
  }

  private async initialize_mobile_money_payment(
    currency: string,
    userId: string,
    beneficiaryAccountNumber: string,
    beneficiaryBankCode: string,
    beneficiaryBank: string,
    beneficiaryName: string,
    amount: number,
    comment: string,
    recipientInfo: usdRecipientInfo | undefined,
    isBudgetTransaction?: boolean,
    budgetUniqueId?: string,
    budgetItemId?: string
  ): Promise<any> {
    /** Method initializes transfer for all mobile money currencies. */
    try {
      const response = await axios({
        method: "post",
        url:
          process.env.NODE_ENV == "production"
            ? "https://api.maplerad.com/v1/transfers"
            : "https://sandbox.api.maplerad.com/v1/transfers",
        data: {
          account_number: beneficiaryAccountNumber,
          bank_code: beneficiaryBankCode,
          amount: amount * 100,
          reason: "retro-trf: " + comment,
          currency,
          reference:
            process.env.NODE_ENV == "development"
              ? "test-withdrawal" + generateOtp(15)
              : generateOtp(15),
          meta: {
            scheme: "MOBILEMONEY",
            counterparty: {
              name: recipientInfo?.name,
            },
          },
        },
        headers: {
          Authorization: `Bearer ${process.env.MAPLERAD_SECRET_KEY}`,
        },
      });

      logger(response.data);

      if (!response) throw new Error("Transfer failed");

      const data = response.data;

      if (!data.status) throw new Error("Transfer failed");

      const newTransaction = await walletModel.create({
        fundOriginatorAccount: userId,
        amount,
        transactionType: "withdrawal",
        status: "pending",
        referenceId:
          process.env.NODE_ENV == "development"
            ? "test-withdrawal" + v4()
            : data.transactionReference,
        processingFees: await calculateFees(currency, amount),
        comment,
        beneficiaryBankCode,
        beneficiaryBank,
        beneficiaryName,
        beneficiaryAccountNumber,
        currency,
        scheme: "MOBILEMONEY",
        isBudgetTransaction,
        budgetUniqueId,
        budgetItemId,
      });

      logger(newTransaction);

      return {
        amount,
        transactionId: data.reference,
        beneficiaryName,
        beneficiaryBank,
        beneficiaryAccountNumber,
        transactionType: "Withdrawal",
        createdAt: newTransaction?.createdAt,
      };
    } catch (error: any) {
      await logsnag.publish({
        channel: "failed-requests",
        event: "Withdrawal failed",
        description: `An attempt to withdraw USDfunds to a bank account has failed. err: ${error}`,
        icon: "😭",
        notify: true,
      });

      throw new Error("Transfer failed - Unable to process transfer.");
    }
  }

  private async initialize_USD_Payment(
    userId: string,
    beneficiaryAccountNumber: string,
    beneficiaryBankCode: string,
    beneficiaryBank: string,
    beneficiaryName: string,
    amount: number,
    comment: string,
    firstname: string,
    lastname: string,
    phoneNumber: string,
    address: string,
    countryCode: string,
    recipientInfo: usdRecipientInfo | undefined,
    isBudgetTransaction?: boolean,
    budgetUniqueId?: string,
    budgetItemId?: string
  ): Promise<any> {
    try {
      const response = await axios({
        method: "post",
        url:
          process.env.NODE_ENV == "production"
            ? "https://api.maplerad.com/v1/transfers"
            : "https://sandbox.api.maplerad.com/v1/transfers",

        data: {
          account_number: beneficiaryAccountNumber,
          bank_code: beneficiaryBankCode,
          amount: amount * 100,
          reason: "retro-trf: " + comment,
          currency: "USD",
          reference:
            process.env.NODE_ENV == "development"
              ? "test-withdrawal" + v4()
              : "retro-trf" + v4(),
          meta: {
            scheme: "DOM",
            sender: {
              first_name: firstname,
              last_name: lastname,
              address,
              phone_number: phoneNumber,
              country: countryCode,
            },
            counterparty: {
              first_name: recipientInfo?.first_name,
              last_name: recipientInfo?.last_name,
              address,
              phone_number: phoneNumber,
              country: countryCode,
            },
          },
        },
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          Authorization: `Bearer ${process.env.MAPLERAD_SECRET_KEY}`,
        },
      });

      const data = response.data;
      logger(data);

      if (!data.status) throw new Error("Transfer failed");

      const newTransaction = await walletModel.create({
        fundOriginatorAccount: userId,
        amount,
        transactionType: "withdrawal",
        status: "pending",
        referenceId:
          process.env.NODE_ENV == "development"
            ? "test-withdrawal" + v4()
            : data.transactionReference,
        processingFees: await calculateFees("USD", amount),
        comment,
        beneficiaryBankCode,
        beneficiaryBank,
        beneficiaryName,
        beneficiaryAccountNumber,
        currency: "USD",
        scheme: "DOM",
        isBudgetTransaction,
        budgetUniqueId,
        budgetItemId,
      });

      logger(newTransaction);

      return {
        amount,
        transactionId: data.reference,
        beneficiaryName,
        beneficiaryBank,
        beneficiaryAccountNumber,
        transactionType: "Withdrawal",
        createdAt: newTransaction?.createdAt,
      };
    } catch (error: any) {
      await logsnag.publish({
        channel: "failed-requests",
        event: "Withdrawal failed",
        description: `An attempt to withdraw USDfunds to a bank account has failed. err: ${error}`,
        icon: "😭",
        notify: true,
      });

      throw new Error(
        translateError(error)[0] ||
          "Transfer failed - Unable to process transfer."
      );
    }
  }

  public async getTransactionStatus(
    userId: string,
    k_token: string,
    transactionReference: string
  ): Promise<any> {
    try {
      const foundTransaction = await walletModel.findOne({
        referenceId: transactionReference,
      });
      if (!foundTransaction) throw new Error("Transaction record not found.");

      //If user requesting for data is not a participant of the transaction
      if (
        foundTransaction.fundRecipientAccount != userId &&
        foundTransaction.fundOriginatorAccount != userId
      )
        throw new Error("Unauthorized.");

      const response = await axios({
        method: "post",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          serviceType: "TRANSACTION_STATUS_QUERY",
          requestRef: v4(),
          data: {
            isThirdPartyBankTransfer:
              foundTransaction.transactionType == "withdrawal" ? true : false,
            transactionRequestReference: foundTransaction.referenceId,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      //if axios call is successful but kuda status returns failed e'g 400 errors
      if (!data.status)
        throw new Error(
          data.responseCode == "k25" ? "Record not found" : data.message
        );

      /* Implement saving status query response to database, and update required fields */

      return data.data;
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to retrieve transaction status"
      );
    }
  }

  public async confirmTransferRecipient(
    accountNumber: string,
    bankCode: string,
    referenceId: string,
    k_token: string
  ): Promise<any> {
    try {
      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "NAME_ENQUIRY",
          RequestRef: v4(),
          data: {
            beneficiaryAccountNumber: accountNumber,
            beneficiaryBankCode: bankCode,
            SenderTrackingReference: referenceId,
            isRequestFromVirtualAccount: true,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });
      const data = response.data;

      //if axios call is successful but kuda status returns failed e'g 400 errors
      if (!data.status) throw new Error(data.message);

      return data.data;
    } catch (error: any) {
      throw new Error("Unable to resolve bank account. Try again.");
    }
  }

  public async resolveAccountNumber(
    currency: string,
    accountNumber: string,
    bankCode: string,
    referenceId: string,
    k_token: string
  ): Promise<any> {
    try {
      await checkCurrenciesAvailability(currency);

      switch (currency) {
        case "NGN":
          {
            const response = await axios({
              method: "POST",
              url:
                process.env.NODE_ENV == "production"
                  ? "https://kuda-openapi.kuda.com/v2.1"
                  : "https://kuda-openapi-uat.kudabank.com/v2.1",
              data: {
                ServiceType: "NAME_ENQUIRY",
                RequestRef: v4(),
                data: {
                  beneficiaryAccountNumber: accountNumber,
                  beneficiaryBankCode: bankCode,
                  SenderTrackingReference: referenceId,
                  isRequestFromVirtualAccount: true,
                },
              },
              headers: {
                Authorization: `Bearer ${k_token}`,
              },
            });

            const data = response.data;

            logger(data);

            //if axios call is successful but kuda status returns failed e'g 400 errors
            if (!data.status)
              throw new Error("Unable to resolve bank account. Try again.");

            return data.data;
          }
          break;
        case "USD":
        case "XAF":
        case "GHS":
        case "KES":
        case "NGN_X":
          {
            const response = await this.mapleradAccountResolution(
              accountNumber,
              bankCode
            );

            const { account_number, account_name } = response;
            return {
              beneficiaryAccountNumber: account_number,
              beneficiaryName: account_name,
            };
          }
          break;
        default:
          throw new Error("Currency not supported.");
          break;
      }
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to resolve account details."
      );
    }
  }

  private async mapleradAccountResolution(
    accountNumber: string,
    bankCode: string
  ): Promise<any> {
    try {
      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://api.maplerad.com/v1/institutions/resolve"
            : "https://sandbox.api.maplerad.com/v1/institutions/resolve",
        data: {
          account_number: accountNumber,
          bank_code: bankCode,
        },
        headers: {
          Authorization: `Bearer ${process.env.MAPLERAD_SECRET_KEY}`,
        },
      });

      if (!response)
        throw new Error("Unable to resolve account details. Try again.");

      return response.data.data;
    } catch (error: any) {
      throw new Error("Unable to resolve account details.");
    }
  }

  public async resolveAccountTag(
    username: string,
    currency: string,
    k_token: string,
    referenceId: string,
    userId: string
  ): Promise<any> {
    try {
      await checkCurrenciesAvailability(currency);

      currency = currency.toUpperCase();

      const recipient = await userModel
        .findOne({
          username,
          "currencyAccounts.currency": currency,
          "currencyAccounts.status": "approved",
          "currencyAccounts.isActive": true,
        })
        .select(
          "nubanAccountDetails firstname lastname phoneNumber verificationInformation isIdentityVerified currencyAccounts profilePhoto"
        );

      logger(recipient);

      if (!recipient) throw new Error("Invalid recipient account.");

      switch (currency.toUpperCase()) {
        case "NGN":
          {
            const response = await axios({
              method: "POST",
              url:
                process.env.NODE_ENV == "production"
                  ? "https://kuda-openapi.kuda.com/v2.1"
                  : "https://kuda-openapi-uat.kudabank.com/v2.1",
              data: {
                ServiceType: "NAME_ENQUIRY",
                RequestRef: v4(),
                data: {
                  beneficiaryAccountNumber:
                    recipient?.nubanAccountDetails?.nuban,
                  beneficiaryBankCode: await redisClient.get("kudaBankCode"),
                  SenderTrackingReference: referenceId,
                  isRequestFromVirtualAccount: true,
                },
              },
              headers: {
                Authorization: `Bearer ${k_token}`,
              },
            });
            logger(response);
            const data = response.data;

            if (!data.status) throw new Error(data.message);

            const { beneficiaryName } = data.data;
            const {
              lastname,
              firstname,
              middlename,
              isIdentityVerified,
              profilePhoto,
            } = recipient;

            return {
              lastname,
              firstname,
              middlename,
              isIdentityVerified,
              profilePhoto: profilePhoto?.url,
              beneficiaryName,
            };
          }
          break;
        case "GHS":
        case "KES":
        case "GHS":
        case "XAF":
        case "NGN_X":
          {
            const {
              lastname,
              firstname,
              middlename,
              isIdentityVerified,
              profilePhoto,
            } = recipient;

            return {
              lastname,
              firstname,
              middlename,
              isIdentityVerified,
              profilePhoto: profilePhoto?.url,
              beneficiaryName: `(Retrostack)-${lastname} ${firstname}`,
            };
          }
          break;
        default:
          throw new Error("Currency not supported");
          break;
      }
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to resolve recipient account."
      );
    }
  }

  public async confirmTransferRecipientByAccountTag(
    username: string,
    k_token: string,
    referenceId: string
  ): Promise<any> {
    try {
      const foundRecipient = await userModel
        .findOne({ username })
        .select(
          "nubanAccountDetails transferPermission lastname firstname isIdentityVerified profilePhoto"
        );

      /*Check if user exists and has created a nuban to receive funds in*/
      if (!foundRecipient || !foundRecipient.transferPermission)
        throw new Error("Invalid recipient account");

      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "NAME_ENQUIRY",
          RequestRef: v4(),
          data: {
            beneficiaryAccountNumber:
              foundRecipient?.nubanAccountDetails?.nuban,
            beneficiaryBankCode: await redisClient.get("kudaBankCode"),
            SenderTrackingReference: referenceId,
            isRequestFromVirtualAccount: true,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      //if axios call is successful but kuda status returns failed e'g 400 errors
      if (!data.status) throw new Error(data.message);

      const { beneficiaryName } = data.data;
      const {
        lastname,
        firstname,
        middlename,
        isIdentityVerified,
        profilePhoto,
      } = foundRecipient;

      return {
        lastname,
        firstname,
        middlename,
        isIdentityVerified,
        profilePhoto: profilePhoto?.url,
        beneficiaryName,
      };
    } catch (error: any) {
      throw new Error(translateError(error)[0] || "Invalid recipient account.");
    }
  }

  public async getBankList(kuda_token: string): Promise<any> {
    try {
      const response = await axios({
        method: "post",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          serviceType: "BANK_LIST",
          requestRef: v4(),
        },
        headers: {
          Authorization: `Bearer ${kuda_token}`,
        },
      });

      if (!response) throw new Error("Unable to retrieve list of banks.");

      const kudaBankObject = response.data.data.banks.find((obj: any) => {
        return (obj.bankName = "Kuda." || "Kudimoney(Kudabank)");
      });

      // Store current Kuda bank code
      await redisClient.set("kudaBankCode", kudaBankObject.bankCode);

      return response.data.data.banks;
    } catch (error: any) {
      await logsnag.publish({
        channel: "failed-requests",
        event: "Bank list failed",
        description: `Unable to retrieve bank list from Kuda. err: ${error}`,
        icon: "😭",
        notify: true,
      });
      throw new Error("Unable to retrieve list of banks.");
    }
  }

  public async getBankListV2(
    kuda_token: string,
    currency: string,
    countryCode?: string
  ): Promise<any> {
    try {
      await checkCurrenciesAvailability(currency);

      switch (currency) {
        case "NGN":
          {
            const response = await axios({
              method: "post",
              url:
                process.env.NODE_ENV == "production"
                  ? "https://kuda-openapi.kuda.com/v2.1"
                  : "https://kuda-openapi-uat.kudabank.com/v2.1",
              data: {
                serviceType: "BANK_LIST",
                requestRef: v4(),
              },
              headers: {
                Authorization: `Bearer ${kuda_token}`,
              },
            });

            if (!response) throw new Error("Unable to retrieve list of banks.");

            const kudaBankObject = response.data.data.banks.find((obj: any) => {
              return (obj.bankName = "Kuda." || "Kudimoney(Kudabank)");
            });

            // Store current Kuda bank code
            await redisClient.set("kudaBankCode", kudaBankObject.bankCode);

            return response.data.data.banks;
          }

          break;
        case "GHS":
          {
            return await this.getMapleradInstitutionList("GH", "MOMO");
          }
          break;
        case "KES":
          {
            return await this.getMapleradInstitutionList("KE", "MOMO");
          }
          break;
        case "XAF":
          {
            return await this.getMapleradInstitutionList(
              countryCode || "CM",
              "MOMO"
            );
          }
          break;
        case "USD":
          {
            return await this.getMapleradInstitutionList("NG", "DOM");
          }
          break;
        case "NGN_X":
          {
            return await this.getMapleradInstitutionList("NG", "nuban");
          }
          break;

        default:
          throw new Error("Currency not supported");
          break;
      }
    } catch (error: any) {
      logger(error);
      await logsnag.publish({
        channel: "failed-requests",
        event: "Bank list failed",
        description: `Unable to retrieve bank list from Kuda. err: ${error}`,
        icon: "😭",
        notify: true,
      });
      throw new Error(error.message);
    }
  }

  private async getMapleradInstitutionList(
    countryCode: string,
    type: string
  ): Promise<[]> {
    try {
      const response = await axios({
        method: "get",
        url:
          process.env.NODE_ENV == "production"
            ? "https://api.maplerad.com/v1/institutions"
            : "https://sandbox.api.maplerad.com/v1/institutions",
        params: {
          country: countryCode,
          type,
        },
        headers: {
          Authorization: `Bearer ${process.env.MAPLERAD_SECRET_KEY}`,
        },
      });

      logger(response);

      if (!response) throw new Error("Unable to retrieve list of operators.");

      return response.data.data;
    } catch (error: any) {
      logger(error);
      throw new Error("Unable to retrieve list of operators.");
    }
  }

  public async createCurrencyAccount(
    userId: string,
    k_token: string,
    currency: string,
    meta?: usdAccountMeta
  ): Promise<any> {
    try {
      logger(currency);
      const currencies = ["XAF", "NGN", "USD", "GHS", "KES", "NGN_X"];

      currency = currency.toUpperCase();

      if (!currencies.includes(currency))
        throw new Error("Currency not supported.");

      if (currency === "USD" && meta === undefined)
        throw new Error(
          "Provide all required documents to create a USD account."
        );

      const foundUser = await userModel
        .findById(userId)
        .select(
          "email firstname referenceId lastname phoneNumber nubanAccountDetails isIdentityVerified mapleradCustomerId"
        );
      logger(foundUser);
      if (!foundUser)
        throw new Error(
          "We were unable to create your account, please try again."
        );

      if (!foundUser.isIdentityVerified || !foundUser.mapleradCustomerId)
        throw new Error("Complete your KYC to proceed.");

      const payload: {
        customer_id: string;
        currency: string;
        meta?: usdAccountMeta;
      } = {
        customer_id: foundUser?.mapleradCustomerId,
        currency: currency === "NGN_X" ? "NGN" : currency,
      };

      currency === "USD" ? (payload.meta = meta) : "";

      logger(payload);

      switch (currency.toUpperCase()) {
        case "USD":
        case "NGN_X":
          {
            const response = await axios({
              method: "post",
              url:
                process.env.NODE_ENV == "production"
                  ? "https://api.maplerad.com/v1/collections/virtual-account"
                  : "https://sandbox.api.maplerad.com/v1/collections/virtual-account",
              data: payload,
              headers: {
                Authorization: `Bearer ${process.env.MAPLERAD_SECRET_KEY}`,
              },
            });

            const responseData = response.data;
            logger(responseData.data);
            if (!responseData.status)
              throw new Error(
                "We were unable to create your account, please try again."
              );

            const { id, bank_name, account_number, account_name, created_at } =
              responseData.data;

            const updateUser = await userModel.findOneAndUpdate(
              {
                _id: userId,
                $or: [
                  {
                    "currencyAccounts.currency": {
                      $ne: currency,
                    },
                  }, // Currency doesn't exist
                  {
                    "currencyAccounts.currency": currency,
                    "currencyAccounts.status": "declined",
                  }, // Currency exists, but status is declined. (user tried requesting account but was denied, hence they can try again)
                ],
              },
              {
                $addToSet: {
                  currencyAccounts: {
                    bankName: bank_name,
                    accountNumber: account_number,
                    accountName: account_name,
                    referenceId: id,
                    creationDate: created_at,
                    currency,
                    status: "pending",
                    isActive: false,
                  },
                },
              },
              {
                new: true,
              }
            );

            if (!updateUser) throw new Error("Account already exists.");

            logger(updateUser);

            return responseData.data;
          }
          break;
        case "NGN":
          /*
           * create Kuda NGN virtual account, account creation is synchronous/instant
           */
          {
            if (foundUser.nubanAccountDetails) {
              /**
               * if user already has a nuban (an ngn virtual account), update currencyAccounts array with already created nuban.
               * */
              const updatedUser = await userModel.findOneAndUpdate(
                {
                  _id: userId,
                  $or: [
                    {
                      "currencyAccounts.currency": {
                        $ne: currency,
                      },
                    },
                    {
                      "currencyAccounts.currency": currency,
                      "currencyAccounts.status": "declined",
                    },
                  ],
                },
                {
                  $addToSet: {
                    currencyAccounts: {
                      bankName: "Kuda Bank",
                      accountNumber: foundUser.nubanAccountDetails.nuban,
                      currency,
                      isActive: true,
                      status: "approved",
                    },
                  },
                  $set: { transferPermission: true },
                },
                { new: true }
              );

              logger(updatedUser);

              throw new Error("NGN account already exists.");
            }

            const {
              email,
              firstname,
              lastname,
              middlename,
              phoneNumber,
              referenceId,
            } = foundUser;

            /* Phone numbers are stored with their respective country codes e.g +234, 
              strip away the country code which is the first 4 characters */
            const formatPhoneNumber = "0" + phoneNumber?.substring(3);

            logger(formatPhoneNumber);

            const response = await axios({
              method: "POST",
              url:
                process.env.NODE_ENV == "production"
                  ? "https://kuda-openapi.kuda.com/v2.1"
                  : "https://kuda-openapi-uat.kudabank.com/v2.1",
              data: {
                ServiceType: "ADMIN_CREATE_VIRTUAL_ACCOUNT",
                RequestRef: v4(),
                data: {
                  email,
                  phoneNumber: formatPhoneNumber,
                  lastName: lastname.replace(" ", "-"),
                  firstName: firstname.replace(" ", "-"),
                  middleName: middlename?.replace(" ", "-") || "",
                  trackingReference: referenceId,
                },
              },
              headers: {
                Authorization: `Bearer ${k_token}`,
              },
            });

            const data = response.data;

            // if axios call is successful but kuda status returns failed e'g 400 errors
            if (!data.status) throw new Error(data.message);

            const updatedUser = await userModel.findOneAndUpdate(
              {
                _id: userId,
                $or: [
                  {
                    "currencyAccounts.currency": {
                      $ne: currency,
                    },
                  },
                  {
                    "currencyAccounts.currency": currency,
                    "currencyAccounts.status": "declined",
                  },
                ],
              },
              {
                nubanAccountDetails: { nuban: data.data.accountNumber },
                $addToSet: {
                  currencyAccounts: {
                    bankName: "Kuda Bank",
                    accountNumber: data.data.accountNumber,
                    currency,
                    isActive: true,
                    status: "approved",
                  },
                },
                $set: { transferPermission: true },
              },
              { new: true }
            );
            logger(updatedUser);

            if (!updatedUser) throw new Error("");

            return data.data;
          }
          break;
        case "GHS":
        case "KES":
        case "XAF":
          {
            // enable mobile money currency
            const updateUser = await userModel.findOneAndUpdate(
              {
                _id: userId,
                $or: [
                  {
                    "currencyAccounts.currency": {
                      $ne: currency,
                    },
                  },
                  {
                    "currencyAccounts.currency": currency,
                    "currencyAccounts.status": "declined",
                  },
                ],
              },
              {
                $addToSet: {
                  currencyAccounts: {
                    currency,
                    isActive: true,
                    status: "approved",
                  },
                },
              },
              { new: true }
            );

            if (!updateUser) throw new Error("Account already exists.");

            logger(updateUser);
            return;
          }
          break;
        default:
          throw new Error("Currency not supported.");
          break;
      }
    } catch (error: any) {
      logger(error);
      throw new Error(
        error.message || "Unable to create your account, please try again."
      );
    }
  }

  public async getCurrencyAccounts(userId: string): Promise<IUser> {
    try {
      const accounts = await userModel.findOne(
        {
          _id: userId,
        },
        {
          currencyAccounts: 1,
        }
      );
      logger(accounts);

      if (!accounts) throw new Error("No accounts found");
      return accounts;
    } catch (error: any) {
      logger(error);
      throw new Error(
        error.message || "Unable to retrieve your accounts, please try again."
      );
    }
  }

  //KUDA WEBHOOK SERVICES

  public async recieveFunds(
    payingBank: string,
    amount: string | number,
    transactionReference: string,
    narrations: string,
    accountName: string,
    accountNumber: string,
    transactionType: string,
    senderName: string,
    recipientName: string,
    sessionId: string
  ): Promise<IWallet | any> {
    try {
      const foundRecipient = await userModel.findOne({
        "nubanAccountDetails.nuban": accountNumber,
      });

      if (!foundRecipient) throw new Error("No account with nuban found");

      /* 
        When this webhook is fired, it is due to either a retro wallet user sent funds to a recipient or it's a transfer from an external bank (wallet funding).
        If the transaction is from a retro wallet user, then there is no need to create/log a new transaction object, 
        because we already do that when the sender (a retro wallet user) sends the funds,
        what should be done it to acknowledge that the recipient has received the funds and update the status of the transaction.
      */
      const updatedTransaction = await walletModel.findOneAndUpdate(
        { referenceId: transactionReference },
        { $set: { fundsReceivedbyRecipient: true }, status: "success" },
        { new: true }
      );

      // If incoming credit transaction isn't from retro, log funding transaction
      if (!narrations.toLowerCase().includes("retro-trf")) {
        const newTransaction = await walletModel.create({
          fundRecipientAccount: foundRecipient._id,
          amount: Number(amount) / 100, //convert amount from kobo to naira
          transactionType: "funding",
          status: "success",
          referenceId:
            process.env.NODE_ENV == "development"
              ? "test-funding" + v4()
              : transactionReference,
          comment: narrations,
          beneficiaryName: accountName,
          beneficiaryAccount: accountNumber,
          currency: "NGN",
          senderName,
          senderBank: payingBank,
        });

        return {
          amount,
          transactionId: newTransaction?.referenceId,
          senderName: senderName,
          senderBank: payingBank,
          beneficiaryAccount: newTransaction.beneficiaryAccount,
          transactionType: "Funding",
          createdAt: newTransaction.createdAt,
          id: foundRecipient.referenceId,
          recipientPhoneNumber: foundRecipient.phoneNumber,
          oneSignalPlayerId: foundRecipient?.oneSignalDeviceId || null,
        };
      }

      return {
        amount,
        transactionId: updatedTransaction?.referenceId,
        senderTag: updatedTransaction?.senderTag,
        transactionType: "Transfer",
        createdAt: updatedTransaction?.createdAt,
        id: foundRecipient.referenceId,
        recipientTag: foundRecipient.username,
        recipientEmail: foundRecipient.email,
        recipientPhoneNumber: foundRecipient.phoneNumber,
        oneSignalPlayerId: foundRecipient?.oneSignalDeviceId || null, //one signal player ID for Push notification
      };
    } catch (error) {
      await logsnag.publish({
        channel: "failed-requests",
        event: "Process webhook failed",
        description: `The receive funds webhook handler has failed. err: ${error}`,
        icon: "🛑",
        notify: true,
      });

      throw new Error("Unable to process receive funds webhook.");
    }
  }

  //Acknowledge that funds have left senders account, and kuda has processed transfer
  public async acknowledgeFundsTransfer(
    amount: string,
    transactionReference: string,
    narrations: string,
    sessionId: string,
    instrumentNumber: string,
    payingBank: string,
    k_token: string
  ): Promise<any> {
    try {
      // Check transaction is a payment transaction
      const transaction: IWallet | null = await walletModel.findOneAndUpdate(
        {
          $or: [
            { referenceId: transactionReference },
            { referenceId: instrumentNumber },
          ],
        },
        { $set: { senderWebhookAcknowledgement: true }, status: "success" },
        { new: true }
      );

      // Check transaction is a bill payment
      const billTransaction: IBill | null = await billModel.findOne({
        transactionReference,
      });

      // If incoming transaction is not payment or bill purchase, kill webhook processing
      if (!transaction && !billTransaction)
        throw new Error(
          "Invalid Transaction: Payment and Bill transaction not found"
        );

      // if incoming transaction is a bill transaction not payment
      if (billTransaction && !transaction) {
        // process bill purchase transaction
        const billService = new BillService();
        const processedTransaction = await billService.updateBillPurchase(
          k_token,
          payingBank,
          transactionReference,
          narrations,
          instrumentNumber
        );

        return processedTransaction;
      }

      if (!transaction)
        throw new Error("Invalid transaction: Payment record not found");

      // continue processing webhook if incoming transaction is payment and not bill transaction

      const foundSender = await userModel.findById(
        transaction?.fundOriginatorAccount
      );

      // if transaction is a withdrawal, include recipient bank info
      if (transaction?.transactionType.toLowerCase() == "withdrawal") {
        return {
          id: foundSender?.referenceId,
          amount: transaction.amount * 100, //amount in kobo
          beneficiaryName: transaction.beneficiaryName,
          beneficiaryBank: transaction.beneficiaryBank,
          beneficiaryAccount: transaction.beneficiaryAccount,
          transactionId: transaction.referenceId,
          createdAt: transaction.createdAt,
          senderTag: foundSender?.username,
          senderEmail: foundSender?.email,
          senderPhoneNumber: foundSender?.phoneNumber,
          transactionType: "Withdrawal",
          oneSignalPlayerId: foundSender?.oneSignalDeviceId || null,
        };
      }

      return {
        id: foundSender?.referenceId,
        amount: transaction.amount * 100, //amount in kobo
        recipientTag: transaction.recepientTag,
        transactionType: "Transfer",
        createdAt: transaction.createdAt,
        senderTag: foundSender?.username,
        transactionId: transaction.referenceId,
        senderEmail: foundSender?.email,
        senderPhoneNumber: foundSender?.phoneNumber,
        oneSignalPlayerId: foundSender?.oneSignalDeviceId || null,
      };
    } catch (error) {
      await logsnag.publish({
        channel: "failed-requests",
        event: "Process webhook failed",
        description: `Acknowledge funds transfer failed in webhook. err: ${error}`,
        icon: "🛑",
        notify: true,
      });

      throw new Error("Unable to process acknowledge webhook.");
    }
  }
}

export default WalletService;

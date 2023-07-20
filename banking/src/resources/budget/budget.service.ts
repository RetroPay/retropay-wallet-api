import budgetModel from "./budget.model";
import { v4 } from "uuid";
import translateError from "@/helpers/mongod.helper";
import mongoose from "mongoose";
import axios from "axios";
import { redisClient, logsnag } from "../../server";
import IBudget from "./budget.interface";
import userModel from "../user/user.model";
import WalletService from "../wallet/wallet.service";
import walletModel from "../wallet/wallet.model";
import logger from "@/utils/logger";

class BudgetService {
  private walletService = new WalletService();

  public async createBudget(
    userId: string,
    referenceId: string,
    k_token: string,
    totalBudgetAmount: number,
    startDate: string,
    endDate: string,
    budgetName: string,
    budgetItems: {}[],
    currency: string,
    budgetIcon?: string
  ): Promise<IBudget> {
    try {
      switch (currency.toLocaleLowerCase()) {
        case "ngn":
          {
            const newBudget = this.createNairaBudgetAccount(
              userId,
              referenceId,
              k_token,
              totalBudgetAmount,
              startDate,
              endDate,
              budgetName,
              budgetItems,
              currency,
              budgetIcon
            );

            logger(newBudget);
            return newBudget;
          }
          break;
        default:
          throw new Error(`${currency} budgets are currently not supported.`);
          break;
      }
    } catch (error) {
      console.error(error, "error");
      throw new Error("We were unable to create this budget, please try again");
    }
  }

  private async createNairaBudgetAccount(
    userId: string,
    referenceId: string,
    k_token: string,
    totalBudgetAmount: number,
    startDate: string,
    endDate: string,
    budgetName: string,
    budgetItems: {}[],
    currency: string,
    budgetIcon?: string
  ) {
    try {
      // get naira account balance nb: it is returned in kobo
      const nairaBalance: number = await this.walletService.getAccountBalance(
        referenceId,
        k_token,
        userId
      );
      logger(nairaBalance);
      if (nairaBalance / 100 < totalBudgetAmount)
        throw new Error(
          "You don't have enough money on your NGN spend balance to create this budget."
        );

      // create budget account
      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "CREATE_PLAIN_SAVE",
          RequestRef: v4(),
          data: {
            trackingReference: referenceId,
            name: budgetName,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      logger(data);
      if (!data.status)
        throw new Error(
          "We were unable to create this budget, please try again"
        );

      // fund budget account from naira spend balance
      const fundBudgetResponse = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "PLAIN_SAVE_DEBIT_CREDIT",
          RequestRef: v4(),
          data: {
            amount: totalBudgetAmount * 100, // convert to kobo
            narration: `Fund Budget - ${budgetName}`,
            transactionType: "c",
            savingsId: data.data.savingsId,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const fundBudgetResponseData = fundBudgetResponse.data;

      logger(fundBudgetResponseData);
      if (!fundBudgetResponseData.status)
        throw new Error("We were unable to fund this budget, please try again");

      // record created budget on DB
      const newBudget: IBudget = await budgetModel.create({
        budgetName,
        budgetOwnerId: userId,
        totalBudgetAmount,
        initialBudgetAmount: totalBudgetAmount,
        currency,
        budgetItems,
        startDate,
        endDate,
        budgetUniqueId: data.data.savingsId,
        budgetType: "monthly",
        budgetIcon
      });

      return newBudget;
    } catch (error) {
      console.error(error, "error");
      throw new Error("We were unable to create this budget, please try again");
    }
  }

  public async topUpBudget(
    userId: string,
    k_token: string,
    amount: number,
    budgetUniqueId: string,
    budgetItemId: string
  ): Promise<any> {
    try {
      const budget: IBudget | null = await budgetModel
        .findOne({ budgetUniqueId, "budgetItems._id": budgetItemId })
        .select("currency budgetOwnerId");

      if (!budget) throw new Error("Budget not found.");

      const { currency, budgetOwnerId } = budget;

      switch (currency.toLocaleLowerCase()) {
        case "ngn":
          {
            const updatedBudget = await this.topUpNairaBudgetItem(
              k_token,
              amount,
              budgetUniqueId,
              budgetItemId
            );

            return updatedBudget;
          }
          break;

        default:
          throw new Error("Budget not found.");
          break;
      }
    } catch (error: any) {
      console.error(error, "error");
      throw new Error(
        translateError(error)[0] ||
          "We were unable to fund this budget, please try again"
      );
    }
  }

  private async topUpNairaBudgetItem(
    k_token: string,
    amount: number,
    budgetUniqueId: string,
    budgetItemId: string
  ): Promise<any> {
    try {
      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "PLAIN_SAVE_DEBIT_CREDIT",
          RequestRef: v4(),
          data: {
            amount: amount * 100, // convert to kobo
            narration: `Fund budget`,
            transactionType: "c",
            savingsId: budgetUniqueId,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      console.error(data.message, "error");
      if (!data.status) throw new Error(data.message);

      // update budget
      const updatedBudget = await budgetModel
        .findOneAndUpdate(
          { budgetUniqueId },
          {
            $inc: {
              totalBudgetAmount: amount,
              "budgetItems.$[elem].budgetItemAmount": amount,
            },
            "budgetItems.$[elem].isExceeded": true,
            $push: {
              "budgetItems.$[elem].topUpHistory": {
                date: Date.now(),
                topUpAmount: amount,
              },
            },
          },
          { arrayFilters: [{ "elem._id": budgetItemId }], new: true }
        )
        .select("-budgetOwnerId");

      logger(updatedBudget);
      if (!updatedBudget) throw new Error("Unable to update this budget.");

      return updatedBudget;
    } catch (error: any) {
      console.error(error, "error");
      throw new Error(
        translateError(error)[0] ||
          "Unable to fund this budget, please try again"
      );
    }
  }

  public async getBudgetDetails(
    userId: string,
    k_token: string,
    budgetUniqueId: string
  ): Promise<any> {
    try {
      const budget: IBudget | null = await budgetModel
        .findOne({ budgetUniqueId })
        .select("-budgetOwnerId");

      if (!budget) throw new Error("Budget not found.");

      return budget;
    } catch (error: any) {
      console.error(error, "error");
      throw new Error(
        translateError(error)[0] ||
          "Unable to retrieve this budget, please try again."
      );
    }
  }

  public async getAllBudgets(userId: string): Promise<any> {
    try {
      const budgets: IBudget[] | null = await budgetModel.find({
        budgetOwnerId: userId,
      }, 
      { 
        budgetName: 1,
        initialBudgetAmount: 1,
        totalBudgetAmount: 1,
        budgetAmountSpent: 1,
        budgetItems: 1,
        endDate: 1,
        startDate: 1,
        budgetUniqueId: 1,
        createdAt: 1,
        budgetBalance: {
          $subtract: ["$totalBudgetAmount", "$budgetAmountSpent"],
        },
      }).select("-budgetOwnerId").sort({ createdAt: -1 });

      if (!budgets) throw new Error("No Budgets found.");

      return budgets;
    } catch (error: any) {
      console.error(error, "error");
      throw new Error("Unable to retrieve your budgets, please try again.");
    }
  }

  public async transferFromBudget(
    k_token: string,
    budgetUniqueId: string,
    budgetItemId: string,
    amount: number,
    formPin: string,
    fundRecipientAccountTag: string,
    comment: string,
    userId: string,
    senderTag: string,
    referenceId: string,
    beneficiaryName: string
  ): Promise<any> {
    try {
      const budget: IBudget | null = await budgetModel.findOne(
        {
          budgetUniqueId,
          "budgetItems._id": budgetItemId,
        },
        {
          budgetItems: { $elemMatch: { _id: budgetItemId } },
          totalBudgetAmount: 1,
          currency: 1,
          budgetAmountSpent: 1,
          budgetOwnerId: 1,
          budgetBalance: {
            $subtract: ["$totalBudgetAmount", "$budgetAmountSpent"],
          },
        }
      );

      logger(budget);

      if (!budget) throw new Error("Budget not found.");

      const { currency, budgetOwnerId, budgetItems, budgetBalance } = budget;
      const budgetItemBalance =
        budgetItems[0].budgetItemAmount - budgetItems[0].budgetItemAmountSpent;

      if (budgetBalance < amount)
        throw new Error("Transfer failed - Insufficient funds on this budget.");

      if (budgetItemBalance < amount)
        throw new Error(
          "Transfer failed - Insufficient funds on this budget category."
        );

      switch (currency.toLocaleLowerCase()) {
        case "ngn":
          {
            const response = await this.transferFromNairaBudget(
              k_token,
              budgetUniqueId,
              budgetItemId,
              formPin,
              amount,
              fundRecipientAccountTag,
              comment,
              userId,
              senderTag,
              referenceId,
              beneficiaryName
            );

            logger(response);
            return response;
          }
          break;

        default:
          throw new Error("Budget not found.");
          break;
      }
    } catch (error: any) {
      console.error(error, "error");
      throw new Error(
        translateError(error)[0] ||
          "Transfer failed - unable to process transfer."
      );
    }
  }

  public async debitNairaBudgetAccount(
    budgetUniqueId: string,
    amount: number,
    budgetItemId: string,
    k_token: string
  ): Promise<any> {
    try {
      const budget: IBudget | null = await budgetModel.findOne(
        {
          budgetUniqueId,
          "budgetItems._id": budgetItemId,
        },
        {
          budgetItems: { $elemMatch: { _id: budgetItemId } },
          totalBudgetAmount: 1,
          currency: 1,
          budgetAmountSpent: 1,
          budgetOwnerId: 1,
          budgetBalance: {
            $subtract: ["$totalBudgetAmount", "$budgetAmountSpent"],
          },
        }
      );

      logger(budget);

      if (!budget) throw new Error("Budget not found.");

      const { currency, budgetItems, budgetBalance } = budget;
      const budgetItemBalance =
        budgetItems[0].budgetItemAmount - budgetItems[0].budgetItemAmountSpent;

      if (budgetBalance < amount)
        throw new Error("Insufficient funds on this budget.");

      if (budgetItemBalance < amount)
        throw new Error(
          "Insufficient funds on this budget category."
        );

      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "PLAIN_SAVE_DEBIT_CREDIT",
          RequestRef: v4(),
          data: {
            amount: amount * 100, // convert to kobo
            narration: `Spend from budget`,
            transactionType: "d",
            savingsId: budgetUniqueId,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      logger(data);

      /**
       * Failed to move funds from budget account to naira spend balance, but we can't tell our users that lol.
       */
      if (!data.status)
        throw new Error(
          "Bill Purchase failed - Funds have been reversed to your naira spend balance."
        );

      const updatedBudget = await budgetModel
        .findOneAndUpdate(
          { budgetUniqueId, "budgetItems._id": budgetItemId },
          {
            $inc: {
              budgetAmountSpent: amount,
              "budgetItems.$.budgetItemAmountSpent": amount,
            },
          },
          { new: true }
        )
        .select("-budgetOwnerId");
      logger(updatedBudget);
      return updatedBudget;
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] ||
          "Transfer failed - unable to process transfer."
      );
    }
  }

  private async transferFromNairaBudget(
    k_token: string,
    budgetUniqueId: string,
    budgetItemId: string,
    formPin: string,
    amount: number,
    fundRecipientAccountTag: string,
    comment: string,
    userId: string,
    senderTag: string,
    referenceId: string,
    beneficiaryName: string
  ) {
    try {
      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "PLAIN_SAVE_DEBIT_CREDIT",
          RequestRef: v4(),
          data: {
            amount: amount * 100, // convert to kobo
            narration: `Spend from budget`,
            transactionType: "d",
            savingsId: budgetUniqueId,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      logger(data);

      /**
       * Failed to move funds from budget account to naira spend balance, but we can't tell our users that lol.
       */
      if (!data.status)
        throw new Error(
          "Transfer failed - Funds have been reversed to your naira spend balance."
        );

      const budget = await budgetModel
        .findOneAndUpdate(
          { budgetUniqueId, "budgetItems._id": budgetItemId },
          {
            $inc: {
              budgetAmountSpent: amount,
              "budgetItems.$.budgetItemAmountSpent": amount,
            },
          },
          { new: true }
        )
        .select("-budgetOwnerId");

      const transaction = await this.walletService.transferFunds(
        formPin,
        amount,
        fundRecipientAccountTag,
        `Budget Spend - ${comment}`,
        userId,
        senderTag,
        referenceId,
        k_token,
        beneficiaryName,
        true,
        budgetUniqueId,
        budgetItemId
      );

      return {
        transaction,
        budget,
      };
    } catch (error) {
      console.error(error, "error");
      throw new Error(
        translateError(error)[0] ||
          "Transfer failed - unable to process transfer."
      );
    }
  }

  // Bank transfer
  public async withdrawFromBudget(
    k_token: string,
    budgetUniqueId: string,
    budgetItemId: string,
    amount: number,
    formPin: string,
    comment: string,
    userId: string,
    referenceId: string,
    beneficiaryName: string,
    beneficiaryAccount: string,
    beneficiaryBankCode: string,
    beneficiaryBank: string,
    nameEnquiryId: string
  ): Promise<any> {
    try {
      const budget: IBudget | null = await budgetModel.findOne(
        {
          budgetUniqueId,
          "budgetItems._id": budgetItemId,
        },
        {
          budgetItems: { $elemMatch: { _id: budgetItemId } },
          totalBudgetAmount: 1,
          currency: 1,
          budgetAmountSpent: 1,
          budgetOwnerId: 1,
          budgetBalance: {
            $subtract: ["$totalBudgetAmount", "$budgetAmountSpent"],
          },
        }
      );

      logger(budget);

      if (!budget) throw new Error("Budget not found.");

      const { currency, budgetItems, budgetBalance } = budget;
      const budgetItemBalance =
        budgetItems[0].budgetItemAmount - budgetItems[0].budgetItemAmountSpent;

      if (budgetBalance < amount)
        throw new Error("Transfer failed - Insufficient funds on this budget.");

      if (budgetItemBalance < amount)
        throw new Error(
          "Transfer failed - Insufficient funds on this budget category."
        );

      switch (currency.toLocaleLowerCase()) {
        case "ngn":
          {
            const response = await this.withdrawFromNairaBudget(
              budgetUniqueId,
              budgetItemId,
              formPin,
              referenceId,
              userId,
              amount,
              beneficiaryAccount,
              comment,
              beneficiaryBankCode,
              beneficiaryBank,
              beneficiaryName,
              nameEnquiryId,
              k_token
            );

            logger(response);
            return response;
          }
          break;

        default:
          throw new Error("Budget not found.");
          break;
      }
    } catch (error: any) {
      console.error(error, "error");
      throw new Error(
        translateError(error)[0] ||
          "Transfer failed - unable to process transfer."
      );
    }
  }

  private async withdrawFromNairaBudget(
    budgetUniqueId: string,
    budgetItemId: string,
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
    k_token: string
  ) {
    try {
      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "PLAIN_SAVE_DEBIT_CREDIT",
          RequestRef: v4(),
          data: {
            amount: amount * 100, // convert to kobo
            narration: `Spend from budget`,
            transactionType: "d",
            savingsId: budgetUniqueId,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      logger(data);

      /**
       * Failed to move funds from budget account to naira spend balance, but we can't tell our users that lol.
       */
      if (!data.status)
        throw new Error(
          "Transfer failed - Funds have been reversed to your naira spend balance."
        );

      const budget = await budgetModel
        .findOneAndUpdate(
          { budgetUniqueId, "budgetItems._id": budgetItemId },
          {
            $inc: {
              budgetAmountSpent: amount,
              "budgetItems.$.budgetItemAmountSpent": amount,
            },
          },
          { new: true }
        )
        .select("-budgetOwnerId");

      const transaction = await this.walletService.withdrawFunds(
        formPin,
        referenceId,
        userId,
        amount,
        beneficiaryAccount,
        comment,
        beneficiaryBankCode,
        beneficiaryBank,
        beneficiaryName,
        nameEnquiryId,
        k_token,
        true,
        budgetUniqueId,
        budgetItemId
      );

      return {
        transaction,
        budget,
      };
    } catch (error) {
      console.error(error, "error");
      throw new Error(
        translateError(error)[0] ||
          "Transfer failed - unable to process transfer."
      );
    }
  }

  public async getBudgetTransactionsByMonthAndYear(
    month: number,
    year: number,
    userId: string
  ): Promise<any | null> {
    try {
      const creditTransactions: any = await walletModel
        .find(
          {
            fundRecipientAccount: userId,
            isBudgetTransaction: true,
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
            isBudgetTransaction: true,
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

      return { creditTransactions, debitTransactions };
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to retrieve transactions"
      );
    }
  }
}

export default BudgetService;

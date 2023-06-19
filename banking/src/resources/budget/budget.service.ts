import budgetModel from "./budget.model"
import { v4 } from "uuid";
import translateError from "@/helpers/mongod.helper";
import mongoose from "mongoose";
import axios from "axios";
import { redisClient, logsnag } from "../../server";
import IBudget from "./budget.interface";
import userModel from "../user/user.model";
import WalletService from "../wallet/wallet.service";

class BudgetService {
  private walletService = new WalletService

  public async createNairaMonthlyBudget(userId: string, referenceId: string, k_token: string, totalBudgetAmount: number, budgetMonth: string, budgetYear: string, budgetName: string, budgetItems: {}[]): Promise<IBudget> {
    try {
      // get naira account balance nb: it is returned in kobo
      const nairaBalance: number = await this.walletService.getAccountBalance(referenceId, k_token, userId)
      console.log(nairaBalance, "ngn balance")
      console.log(totalBudgetAmount, 'budget amount')

      if ((nairaBalance / 100) < totalBudgetAmount) throw new Error("You don't have enough money on your NGN spend balance to create this budget.")

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
            name: budgetName
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;
      console.log(data)


      console.error(data.message, "error")
      if (!data.status) throw new Error("We were unable to create this budget, please try again");

      //fund budget
      const fundBudgetResponse = await this.fundNairaBudget(
        k_token,
        totalBudgetAmount,
        budgetName,
        data.data.savingsId
      )

      // record created budget
      const newBudget: IBudget = await budgetModel.create({
        budgetName,
        budgetOwnerId: userId,
        totalBudgetAmount,
        currency: 'NGN',
        budgetItems,
        budgetMonth: budgetMonth.toLowerCase(),
        budgetYear,
        budgetUniqueId: data.data.savingsId,
        budgetType: "monthly"
      })
      console.log(newBudget)

      return newBudget
    } catch (error) {
      console.error(error, "error")
      throw new Error(
        "We were unable to create this budget, please try again"
      )
    }
  }

  public async createNairaGoalBudget(userId: string, referenceId: string, k_token: string, totalBudgetAmount: number, budgetName: string): Promise<IBudget> {
    try {
      // get naira account balance nb: it is returned in kobo
      const nairaBalance: number = await this.walletService.getAccountBalance(referenceId, k_token, userId)
      console.log(nairaBalance, "ngn balance")
      console.log(totalBudgetAmount, 'budget amount')

      if ((nairaBalance / 100) < totalBudgetAmount) throw new Error("You don't have enough money on your NGN spend balance to create this budget.")

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
            name: budgetName
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;
      console.log(data)


      console.error(data.message, "error")
      if (!data.status) throw new Error("We were unable to create this budget, please try again");

      //fund budget
      const fundBudgetResponse = await this.fundNairaBudget(
        k_token,
        totalBudgetAmount,
        budgetName,
        data.data.savingsId
      )

      // record budget
      const newBudget: IBudget = await budgetModel.create({
        budgetName,
        budgetOwnerId: userId,
        totalBudgetAmount,
        currency: 'NGN',
        budgetUniqueId: data.data.savingsId,
        budgetType: "goal"
      })
      console.log(newBudget)

      return newBudget
    } catch (error) {
      console.error(error, "error")
      throw new Error(
        "We were unable to create this budget, please try again"
      )
    }
  }

  public async getBudgetDetails(userId: string, k_token: string, budgetUniqueId: string): Promise<any> {
    try {
      const budget: IBudget | null = await budgetModel.findOne({ budgetUniqueId }).select("-budgetOwnerId")

      if(!budget) throw new Error("Budget not found");

      return budget
    } catch (error: any) {
      
    }
  }

  private async fundNairaBudget(k_token: string, amount: number, budgetName: string, budgetUniqueId: string): Promise<any> {
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
            narration: `Fund Budget - ${budgetName}`,
            transactionType: "c",
            savingsId: budgetUniqueId
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;
      console.log(data, "fund budget response")

      console.error(data.message, "error")
      if (!data.status) throw new Error("We were unable to fund this budget, please try again");

      return true
    } catch (error) {
      console.error(error, "error")
      throw new Error(
        "We were unable to fund this budget, please try again"
      )
    }
  }

  public async fundNairaGoalBudget(k_token: string, amount: number, budgetUniqueId: string): Promise<any> {
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
            savingsId: budgetUniqueId
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;
      console.log(data, "fund budget response")

      console.error(data.message, "error")
      if (!data.status) throw new Error(data.message);

      //update budget
      const updatedBudget = await budgetModel.findOneAndUpdate({ budgetUniqueId }, { $inc: { totalBudgetAmount: amount}}, { new: true }).select("-budgetOwnerId")

      if(!updatedBudget) throw new Error("We were unable to update this budget.")

      return updatedBudget
    } catch (error: any) {
      console.error(error, "error")
      throw new Error(
        translateError(error)[0] ||
        "We were unable to fund this budget, please try again"
      )
    }
  }

  public async fundNairaMonthlyBudget(k_token: string, amount: number, budgetUniqueId: string, budgetItemId: string): Promise<any> {
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
            savingsId: budgetUniqueId
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;
      console.log(data, "fund budget response")

      console.error(data.message, "error")
      if (!data.status) throw new Error(data.message);

      //update budget
      const updatedBudget = await budgetModel.findOneAndUpdate(
        { budgetUniqueId },
        { $inc: { totalBudgetAmount: amount, "budgetItems.$[elem].budgetItemAmount": amount } },
        { arrayFilters: [{ "elem._id": budgetItemId }], new: true }
      ).select("-budgetOwnerId");
      
      if(!updatedBudget) throw new Error("We were unable to update this budget.")

      return updatedBudget
    } catch (error: any) {
      console.error(error, "error")
      throw new Error(
        translateError(error)[0] ||
        "We were unable to fund this budget, please try again"
      )
    }
  }


  public async withdrawFundsFromGoalBudget(k_token: string, budgetUniqueId: string, amount: number ): Promise<any> {
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
            savingsId: budgetUniqueId
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;
      console.log(data, "fund budget response")

      if (!data.status) throw new Error(data.message);

      // update budget on DB
      const updatedBudget = await budgetModel.findOneAndUpdate({ budgetUniqueId }, {$inc: { budgetAmountSpent: amount }} )

      return 
    } catch (error: any) {
      
    }
  }
}

export default BudgetService
import walletModel from "./wallet.model";
import { v4 } from "uuid";
import userModel from "../user/user.model";
import IWallet from "./wallet.interface";
import translateError from "@/helpers/mongod.helper";
import mongoose from "mongoose";
import axios from "axios";
import { redisClient, logsnag } from "../../server";

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
      const transaction = await walletModel.aggregate([
        {
          $match: {
            referenceId: reference,
          },
        },
        {
          $lookup: {
            from: "users",
            let: { fundRecipientAccount: "$fundRecipientAccount" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$fundRecipientAccount"],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  firstname: 1,
                  lastname: 1,
                  middlename: 1,
                  profilePhoto: 1,
                  username: 1,
                },
              },
            ],
            as: "FundRecipientDetails",
          },
        },
        {
          $lookup: {
            from: "users",
            let: { fundOriginatorAccount: "$fundOriginatorAccount" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$fundOriginatorAccount"],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  firstname: 1,
                  lastname: 1,
                  middlename: 1,
                  profilePhoto: 1,
                  username: 1,
                },
              },
            ],
            as: "FundOriginatorDetails",
          },
        },
      ]);

      if (!transaction) throw new Error("Transaction not found.");

      if (
        transaction[0].fundRecipientAccount != userId &&
        transaction[0].fundOriginatorAccount != userId
      )
        throw new Error("Unauthorized");
        console.log(transaction[0])
      return transaction[0];
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to retrieve transaction"
      );
    }
  }

  // public async calculateWalletBalance(userId: string): Promise<number> {
  //   try {
  //     const credits = await walletModel.aggregate([
  //       {
  //         $match: { fundRecipientAccount: new mongoose.Types.ObjectId(userId) },
  //       },
  //       { $group: { _id: null, totalCredits: { $sum: "$amount" } } },
  //     ]);

  //     const debits = await walletModel.aggregate([
  //       { $match: { fundOriginatorAccount: new mongoose.Types.ObjectId(userId) } },
  //       { $group: { _id: null, totalDebits: { $sum: '$amount' } } }
  //     ])
      
  //     console.log(credits, "credit", debits, "debit")
  //     console.log((credits[0]?.totalCredits ? credits[0]?.totalCredits : 0) - (debits[0]?.totalDebits ? debits[0]?.totalDebits : 0), "balance")
  //     return (credits[0]?.totalCredits ? credits[0]?.totalCredits : 0) - (debits[0]?.totalDebits ? debits[0]?.totalDebits : 0);
  //   } catch (error) {
  //     throw new Error("Balance unavailable.");
  //   }
  // }

  public async getAccountBalance(
    referenceId: string,
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

      // return this.calculateWalletBalance(userId)
    } catch (error) {
      throw new Error(
        translateError(error)[0] ||
          "Transfer failed - Unable to process transfer."
      );
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
    beneficiaryName: string
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

      //calculate users wallet balance - Temporary, remove when going live! Kuda already checks for balance
      // if ((await this.calculateWalletBalance(userId)) <= Number(amount) + 100)
      //   throw new Error("Transfer failed - Insufficient funds");

      if (!(await this.validatePin(formPin, userId)))
        throw new Error("Transfer failed - Incorrect transaction pin");

      const response = await axios({
          method: 'post',
          url: process.env.NODE_ENV == 'production' ? 'https://kuda-openapi.kuda.com/v2.1' : 'https://kuda-openapi-uat.kudabank.com/v2.1',
          data: {
            "serviceType": "VIRTUAL_ACCOUNT_FUND_TRANSFER",
            "requestRef": v4(),
            data: {
              trackingReference: referenceId, //Unique identifier of user with Kuda
              beneficiaryAccount: foundRecipient?.nubanAccountDetails?.nuban,
              amount: amount * 100, //amount in Kobo
              narration: comment,
              beneficiaryBankCode: await redisClient.get("kudaBankCode"),
              beneficiaryName,
              senderName: foundUser.lastname + ' ' + foundUser.firstname,
            }
          },
          headers: {
            "Authorization": `Bearer ${k_token}`
          }
        })

        const data = response.data

        //if axios call is successful but kuda status returns failed e'g 400 errors
        if(!data.status) {
          const { responseCode } = data

          switch (String(responseCode)) {
            case '06' : throw new Error('Transfer failed - processing error.')
              break;
            case '52' : throw new Error('Transfer failed - Inactive recipient account.')
              break;
            case '23' : throw new Error('Transfer failed - A PND is active on your account. Kindly contact support.')
              break;
            case '51' : throw new Error('Transfer failed - Insufficient funds on account.')
              break;
            case '93' : throw new Error('Transfer failed - Cash limit exceeded for your account tier.')
              break;
            case 'k91' : throw new Error('Transfer error - Transaction timeout, Kindly contact support to confirm transaction status.')
              break;
            default: throw new Error(data.message)
          }
        }

      //Log new transaction
      const newTransaction = await walletModel.create({
        fundRecipientAccount: foundRecipient._id,
        fundOriginatorAccount: userId,
        amount,
        transactionType: "transfer",
        status: "pending",
        referenceId: process.env.NODE_ENV == 'development' ? "test-transfer" + v4() : data.transactionReference,
        comment,
        recepientTag: fundRecipientAccountTag,
        senderTag,
        responseCode: data.responseCode,
        beneficiaryName,
        currency: "NGN",
        processingFees: 10,
        senderProfile: foundUser.profilePhoto,
        recipientProfile: foundRecipient.profilePhoto,
      });

      // if transfer is successful, charge transaction fee
      await this.chargeTransactionFees("transfer", referenceId, userId, k_token)

      return {
        amount,
        transactionId: data.transactionReference,
        fundRecipientAccountTag,
        transactionType: "Transfer",
        createdAt: newTransaction?.createdAt,
      };
    } catch (error) {

      await logsnag.publish({
        channel: "failed-requests",
        event: "Transfer failed",
        description: `An attempt to transfer funds between wallet users has failed. err: ${error}`,
        icon: "😥",
        notify: true
      })

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
    k_token: string
  ): Promise<IWallet | any> {
    try {
      const foundUser = await userModel
        .findById(userId)
        .select("firstname lastname");
      if (!foundUser) throw new Error("Unable to process transaction.");

      if ((await this.validatePin(formPin, userId)) == false)
        throw new Error("Transfer failed - Incorrect transaction pin");

      const response = await axios({
        method: 'post',
        url: process.env.NODE_ENV == 'production' ? 'https://kuda-openapi.kuda.com/v2.1' : 'https://kuda-openapi-uat.kudabank.com/v2.1',
        data: {
          "serviceType": "VIRTUAL_ACCOUNT_FUND_TRANSFER",
          "requestRef": v4(),
          data: {
            trackingReference: referenceId, //Unique identifier of user with Kuda
            beneficiaryAccount,
            amount: amount * 100, //amount in Kobo
            narration: comment,
            beneficiaryBankCode,
            beneficiaryName,
            senderName: foundUser.lastname + ' ' + foundUser.firstname,
            nameEnquiryId,
          }
        },
        headers: {
          "Authorization": `Bearer ${k_token}`
        }
      })

      const data = response.data

      console.log(data, "withdraw funds kuda response")

      //if axios call is successful but kuda status returns failed e'g 400 errors
      if(!data.status) {
        const { responseCode } = data

        switch (responseCode) {
          case '-1' : throw new Error('Transfer failed - Transaction cancelled.')
            break;
          case '-2' : throw new Error('Transfer failed. Insufficient funds')
            break;
          case '-3' : throw new Error('Transfer failed - Unable to process transaction')
            break;
          case '91' : throw new Error('Transfer failed - Request timeout.')
            break;
          default: throw new Error('Unable to process transaction')
        }
      }

      const newTransaction = await walletModel.create({
        fundOriginatorAccount: userId,
        amount,
        transactionType: "withdrawal",
        status: "pending",
        // referenceId: "test-withdrawal" + v4(),
        referenceId: process.env.NODE_ENV == 'development' ? "test-withdrawal" + v4() : data.transactionReference,
        processingFees: 10,
        comment,
        beneficiaryBankCode,
        beneficiaryBank,
        beneficiaryName,
        nameEnquiryId,
        beneficiaryAccount,
        responseCode: data.responseCode,
        currency: "NGN",
      });

      console.log(newTransaction, " withdrawal saved transaction response")

      // if transfer is successful, charge transaction fee
      await this.chargeTransactionFees("withdraw", referenceId, userId, k_token)

      return {
        amount,
        transactionId: data.transactionReference,
        // transactionId: newTransaction.referenceId,
        beneficiaryName,
        beneficiaryBank,
        beneficiaryAccount,
        transactionType: "Withdrawal",
        createdAt: newTransaction?.createdAt,
      };
    } catch (error) {
      console.log(error, "error from with fund whole catch")
      await logsnag.publish({
        channel: "failed-requests",
        event: "Withdrawal failed",
        description:
          `An attempt to withdraw funds to a bank account has failed. err: ${error}`,
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
        throw new Error(
          "Oops. We could not find the account you're looking for"
        );

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
        profilePhoto,
        beneficiaryName,
      };
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] ||
          "Network Error - Unable to resolve bank account at the moment."
      );
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
        return obj.bankName.includes("Kuda." || "Kudimoney(Kudabank)");
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

      console.log(foundRecipient, "receive funds, fourd recipint")

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

      // If paying bank isn't kuda bank, log funding transaction
      if (!payingBank.toLowerCase().includes("kuda")) {
        const newTransaction = await walletModel.create({
          fundRecipientAccount: foundRecipient._id,
          amount: Number(amount) / 100, //convert amount from kobo to naira
          transactionType: "funding",
          status: "success",
          referenceId: process.env.NODE_ENV == 'development' ? "test-funding" + v4() : transactionReference,
          comment: narrations,
          beneficiaryName: accountName,
          beneficiaryAccount: accountNumber,
          currency: "NGN",
          senderName,
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
          recipientPhoneNumber: foundRecipient.phoneNumber
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
        recipientPhoneNumber: foundRecipient.phoneNumber
      };
    } catch (error) {
      await logsnag.publish({
        channel: "failed-requests",
        event: "Process webhook failed",
        description: `The receive funds webhook handler has failed. err: ${error}`,
        icon: "🛑",
        notify: true,
      });
    }
  }

  //Acknowledge that funds have left senders account, and kuda is processing transfer
  public async acknowledgeFundsTransfer(
    amount: string,
    transactionReference: string,
    sessionId: string,
    instrumentNumber: string
  ): Promise<any> {
    try {
      const transaction: IWallet | null = await walletModel.findOneAndUpdate(
        { $or: [{referenceId: transactionReference}, {referenceId: instrumentNumber}] },
        { $set: { WebhookAcknowledgement: true }, status: "success" },
        { new: true }
      );

      console.log(transaction, "ackwnowledge webhook found transaction")

      if (!transaction) throw new Error("Failed to update transaction");

      const foundSender = await userModel.findOne({ id: transaction?.fundOriginatorAccount });
      
      // if transaction is a withdrawal, include recipient bank info
      if(transaction.transactionType == 'withdrawal' || 'Withdrawal') {
        return {
          id: foundSender?.referenceId,
          amount: transaction.amount,
          beneficiaryName: transaction.beneficiaryName, 
          beneficiaryBank: transaction.beneficiaryBank,
          beneficiaryAccount: transaction.beneficiaryAccount,
          createdAt: transaction.createdAt,
          senderTag: foundSender?.username,
          senderPhoneNumber: foundSender?.phoneNumber
        }
      }

      return {
        id: foundSender?.referenceId,
        amount: transaction.amount,
        recipientTag: transaction.recepientTag,
        transactionType: transaction.transactionType,
        createdAt: transaction.createdAt,
        senderTag: foundSender?.username,
        transactionId: transaction.referenceId,
        senderEmail: foundSender?.email,
        senderPhoneNumber: foundSender?.phoneNumber
      }
      // return transaction;
    } catch (error) {
      console.log(error, "acknowledge funds service catch error")
      await logsnag.publish({
        channel: "failed-requests",
        event: "Process webhook failed",
        description: `Acknowledge funds transfer failed in webhook. err: ${error}`,
        icon: "🛑",
        notify: true,
      });
    }
  }
}

export default WalletService;

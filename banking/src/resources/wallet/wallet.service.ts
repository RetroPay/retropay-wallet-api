import walletModel from "./wallet.model"
const Paystack = require("paystack-api")(process.env.GATEWAY_SECRET_KEY)
import { v4 } from "uuid"
import userModel from "../user/user.model"
import IWallet from "./wallet.interface"
import translateError from "@/helpers/mongod.helper"
import mongoose from "mongoose"
import axios from "axios"
import { redisClient } from "../../server"
import IUser from "../user/user.interface"

class WalletService {

  // public async initializePaystackCheckout(amount: number, userId: string, currency: string): Promise<IWallet | null> {
  //     try {
        
  //       const foundUser = await userModel.findById(userId).select("email fundPermission")
  
  //       if(!foundUser) throw new Error("Unable to initialize payment.")
  
  //       const { email } = foundUser
  
  //       if(!foundUser?.fundPermission) throw new Error("Verify your identity to fund your wallet.")
  
  //       const helper = new Paystack.FeeHelper();
  //       const amountPlusPaystackFees = helper.addFeesTo(amount * 100);
  //       const splitAccountFees = 100 * 100 //Charge an NGN100 flat fee, in kobo
  
  //       console.log(amountPlusPaystackFees, "paystack fees")
  //       console.log(splitAccountFees, "split account fees")
        
  //       //Initiaize paystack checkout
  //       const result = await Paystack.transaction.initialize({
  //         email,
  //         /* If amount is less than NGN2500, waive paystack's NGN100 charge to NGN10.
  //           There's an overflow padding of NGN10 due to paystack's incosistent fee.
  //         */
  //         amount:
  //           amount >= 2500
  //             ? Math.floor(amountPlusPaystackFees + 11000 + splitAccountFees)
  //             : Math.floor(amountPlusPaystackFees + 1000 + splitAccountFees),
  //         reference: v4(),
  //         currency,
  //         // split_code: process.env.GATEWAY_SPLIT_CODE,
  //         bearer: "account"
  //       });
    
  //       if (!result) throw new Error("Unable to initialize payment.")
  
  //       const newTransaction = await walletModel.create({
  //           referenceId: result.data.reference,
  //           transactionType: 'deposit',
  //           operationType: 'credit',
  //           amount,
  //           currency,
  //           fundRecipientAccount: userId,
  //           accessCode: result.data.access_code
  //       })
  
  //       if(!newTransaction) throw new Error("Unable to fund wallet at this moment. Try again.")

  //       return result.data

  //     } catch (error: any) {
  //       console.log(translateError(error))
  //       throw new Error(translateError(error.error)[0] || translateError(error)[0] || 'Unable to fund wallet at this moment. Try again.')
  //     }
  // }

  // public async verifyTransaction(reference: string): Promise<IWallet | null> {
  //   try {
  //     const result = await Paystack.transaction.verify({
  //       reference,
  //     });

  //     if (!result) throw new Error("Unable to verify deposit transaction. Try again")

  //     const resultData = result.data
  //     const paystack = resultData.fees;
  //     const totalProcessingFees = paystack + (100 * 100); //Paystack charge + retro pay NGN100 service fee, all in kobo

  //     const updatedTransaction = await walletModel.findOneAndUpdate({ referenceId: reference }, {
  //       status: resultData.status,
  //       processingFees: totalProcessingFees / 100,
  //       authorization: resultData.authorization,
  //       fullDepositData: resultData
  //     }, { new: true})

  //     if (!updatedTransaction) throw new Error("Unable to verify deposit transaction. Try again") 

  //     return updatedTransaction

  //   } catch (error: any) {
  //     console.log(translateError(error))
  //     throw new Error(translateError(error.error)[0] || translateError(error)[0] || 'Unable to verify deposit transaction. Try again.')
  //   }
  // }

  public async getTransactionsByMonth(month: number, year: number, userId: string): Promise<any | null> {
    try {
      const creditTransactions: any = await walletModel.find({
        fundRecipientAccount: userId,
        status: "success",
        $and: [
          { $expr: {$eq: [{$month: "$createdAt"}, month]} },
          { $expr: {$eq: [{$year: "$createdAt"}, year]} }
        ]
      }).sort({createdAt: -1})

      const debitTransactions: any = await walletModel.find({
        fundOriginatorAccount: userId,
        status: "success",
        $and: [
          { $expr: {$eq: [{$month: "$createdAt"}, month]} },
          { $expr: {$eq: [{$year: "$createdAt"}, year]} }
        ]
      }).sort({createdAt: -1})
      return { creditTransactions, debitTransactions}
    } catch (error: any) {
      console.log(translateError(error))
      throw new Error(translateError(error)[0] || 'Unable to retrieve transactions')
    }
  }

  public async getTransactionDetails(userId: string, reference: string): Promise<IWallet | null> {
    try {
      const foundTransaction = await walletModel.findOne({ referenceId: reference }).select
      (`transactionType 
        currency 
        operationType 
        fundRecipientAccount 
        fundOriginatorAccount 
        status 
        processingFees 
        amount 
        referenceId 
        comment 
        recepientTag 
        senderTag 
        withdrawalRecipientBankDetails
        createdAt
        updatedAt
      `)

      if(!foundTransaction) throw new Error("Transaction not found.")
      
      if(foundTransaction.fundRecipientAccount != userId && foundTransaction.fundOriginatorAccount != userId) throw new Error("Unauthorized")
      
      return foundTransaction
    } catch (error: any) {
      console.log(translateError(error))
      throw new Error(translateError(error)[0] || 'Unable to retrieve transaction')
    }
  }

  public async calculateWalletBalance(userId: string): Promise<number> {
    try {
      const credits = await walletModel.aggregate([
        { $match: { fundRecipientAccount: new mongoose.Types.ObjectId(userId), status: 'success'} },
        { $group: { _id: null, totalCredits: { $sum:'$amount'} } }
      ])

      const debits = await walletModel.aggregate([
        { $match: { fundOriginatorAccount: new mongoose.Types.ObjectId(userId), status: 'success'} },
        { $group: { _id: null, totalDebits: { $sum:'$amount'} } }
      ])

      console.log(credits)
      console.log(debits)
      console.log("balance", credits[0]?.totalCredits - debits[0]?.totalDebits)

      return credits[0]?.totalCredits - debits[0]?.totalDebits || 0;
    } catch (error) {
      console.log(translateError(error))
      throw new Error('Balance unavailable.')
    }
  }

  public async getAccountBalance(referenceId: string, k_token: string): Promise<any> {
    try {
      const response = await axios({
        method: 'POST',
        url: 'http://kuda-openapi-uat.kudabank.com/v2.1',
        data: {
            ServiceType :"RETRIEVE_VIRTUAL_ACCOUNT_BALANCE",
            RequestRef: v4(),
            data: {
              trackingReference: referenceId,
            }
        },
        headers: {
            Authorization: `Bearer ${k_token}`
        }
      })

      const data = response.data
      console.log(data)

      if(!data.status) throw new Error(data.message)

      return data.data.availableBalance
    } catch (error) {
      console.log(error)
      throw new Error(translateError(error)[0] || 'Transfer failed - Unable to process transfer.')
    }
  }

  private async validatePin(formPin: string, userId: string):Promise<boolean> {
    try {
      const foundUser = await userModel.findById(userId)
      console.log(foundUser)
  
      if(!foundUser) throw new Error("Error validating your pin")
      
      if (await foundUser.isValidPin(formPin)) {
        return true;
      }
      return false;
      
    } catch (error) {
      console.log(error)
      throw new Error('Unable to validate pin.')
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
  ): Promise<IWallet | null> {
    try {
      
      //find recipient account
      const foundRecipient = await userModel.findOne({
        username: fundRecipientAccountTag,
      })

      console.log(foundRecipient)
      if (!foundRecipient) throw new Error("Invalid recipient account.")

      const foundUser = await userModel.findById(userId).select("firstname lastame")
      if(!foundUser) throw new Error('Invalid ')


      // If user tries to transfer to their own account.
      if(foundRecipient._id == userId) throw new Error("Transfer can not be processed.")
  
      //calculate users wallet balance
      // if ((await this.calculateWalletBalance(fundOriginatorAccount)) <= Number(amount) + 100 ) throw new Error("Transafer failed - Insufficient funds")
  
      if (!await this.validatePin(formPin, userId)) throw new Error("Transafer failed - Incorrect transaction pin")
      await redisClient.connect()
      const response = await axios({
          method: 'post',
          url: 'https://kuda-openapi-uat.kudabank.com/v2.1',
          data: {
            "serviceType": "VIRTUAL_ACCOUNT_FUND_TRANSFER",
            "requestRef": v4(),
            data: {
              trackingReference: referenceId, //Unique identifier of user with Kuda
              beneficiaryAccount: foundRecipient?.nubanAccountDetails?.nuban,
              amount: amount * 100, //amount in Kobo
              narration: comment,
              beneficiaryBankCode: await redisClient.get("kudaBankCode") || '999129',
              beneficiaryName,
              senderName: foundUser.lastname + ' ' + foundUser.firstname,
              // nameEnquiryId,
            }
          },
          headers: {
            "Authorization": `Bearer ${k_token}`
          }
        })
  
        const data = response.data
        console.log(data)
            
        //if axios call is successful but kuda status returns failed e'g 400 errors
        if(!data.status) throw new Error(data.message)

        //Log new transaction
        const newTransaction = await walletModel.create({
          fundRecipientAccount: foundRecipient._id,
          fundOriginatorAccount: userId,
          amount,
          transactionType: 'transfer',
          status: 'pending',
          referenceId: data.transactionReference,
          comment,
          recepientTag: fundRecipientAccountTag,
          senderTag,
          responseCode: data.responseCode,
        });
    
        if (!newTransaction) throw new Error("Transafer failed - Unable to process transfer.")
        
        return newTransaction

    } catch (error) {
      console.log(translateError(error))
      throw new Error(translateError(error)[0] || 'Unable to process transaction.')
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
    beneficiaryName: string, 
    nameEnquiryId: string,
    k_token: string ): Promise<IWallet>
    {
      try {
        const foundUser = await userModel.findById(userId).select("firstname lastname")
        if(!foundUser) throw new Error("Unable to process transaction.")

        if (await this.validatePin(formPin, userId) == false) throw new Error("Transfer failed - Incorrect transaction pin")

        console.log(referenceId)
        const response = await axios({
          method: 'post',
          url: 'https://kuda-openapi-uat.kudabank.com/v2.1',
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
        console.log(data)
            
        //if axios call is successful but kuda status returns failed e'g 400 errors
        if(!data.status) throw new Error(data.message)

        const newTransaction = await walletModel.create({
          fundOriginatorAccount: userId,
          amount,
          transactionType: 'withdrawal',
          status: 'pending',
          referenceId: data.transactionReference,
          comment,
          beneficiaryBankCode,
          beneficiaryName,
          nameEnquiryId,
          beneficiaryAccount,
          responseCode: data.responseCode,
        });
      
        return newTransaction
      } catch (error) {
        console.log(error)
        throw new Error(translateError(error)[0] || 'Transfer failed - Unable to process transfer.')
      }
  }

  public async getTransactionStatus(userId: string, k_token: string, transactionReference: string): Promise<any>{
    try{
      const foundTransaction = await walletModel.findOne({referenceId: transactionReference})
      if(!foundTransaction) throw new Error("Record not found.")

      //If user requesting for data is not a participant of the transaction
      if(foundTransaction.fundRecipientAccount != userId && foundTransaction.fundOriginatorAccount != userId) throw new Error("Unauthorized.")

      const response = await axios({
        method: 'post',
        url: 'https://kuda-openapi-uat.kudabank.com/v2.1',
        data: {
          "serviceType": "TRANSACTION_STATUS_QUERY",
          "requestRef": v4(),
          data: {
            isThirdPartyBankTransfer: foundTransaction.transactionType == 'withdrawal' ? true : false,
            transactionRequestReference: foundTransaction.referenceId,
          }
        },
        headers: {
          "Authorization": `Bearer ${k_token}`
        }
      })

      const data = response.data
      console.log(data)
            
      //if axios call is successful but kuda status returns failed e'g 400 errors
      if(!data.status) throw new Error(data.message)

      /* Include section to save response to database, and update requird fields */

      return data.data
    } catch(error: any) {
      console.log(error)
      throw new Error(translateError(error)[0] || 'Unable to retrieve transaction status')
    }
  }

  public async confirmTransferRecipient(accountNumber: string, bankCode: string, referenceId: string, k_token: string): Promise<any> {
    try {
      const response = await axios({
        method: 'POST',
        url: 'http://kuda-openapi-uat.kudabank.com/v2.1',
        data: {
            ServiceType :"NAME_ENQUIRY",
            RequestRef: v4(),
            data: {
              "beneficiaryAccountNumber": accountNumber,
              "beneficiaryBankCode": bankCode,
              "SenderTrackingReference": referenceId, 
              "isRequestFromVirtualAccount": true
            }
        },
        headers: {
            Authorization: `Bearer ${k_token}`
        }
      })

      const data = response.data
      console.log(data)

      //if axios call is successful but kuda status returns failed e'g 400 errors
      if(!data.status) throw new Error(data.message)

      return data.data
    } catch (error: any) {
      console.error(error)
      throw new Error(translateError(error)[0] || "Unable to resolve bank account.")
    }
  }

  public async confirmTransferRecipientByAccountTag(username: string, k_token: string, referenceId: string): Promise<any> {
    try {
        const foundRecipient = await userModel.findOne({username}).select('nubanAccountDetails transferPermission')
        console.log(foundRecipient)

        /*Check if user exists and has created a nuban to recieve funds in*/
        if(!foundRecipient || !foundRecipient.transferPermission) throw new Error('Invalid recipient.')

        await redisClient.connect()

        const response = await axios({
          method: 'POST',
          url: 'http://kuda-openapi-uat.kudabank.com/v2.1',
          data: {
              ServiceType :"NAME_ENQUIRY",
              RequestRef: v4(),
              data: {
                "beneficiaryAccountNumber": foundRecipient?.nubanAccountDetails?.nuban,
                "beneficiaryBankCode": await redisClient.get("kudaBankCode") || '999129', //Get current kuda bank code from redis, else fall to default code
                "SenderTrackingReference": referenceId, 
                "isRequestFromVirtualAccount": true
              }
          },
          headers: {
              Authorization: `Bearer ${k_token}`
          }
        })
  
        const data = response.data
        console.log(data)

        await redisClient.disconnect();
  
        //if axios call is successful but kuda status returns failed e'g 400 errors
        if(!data.status) throw new Error(data.message)
  
        return data.data
    } catch (error: any) {
      console.error(error)
      throw new Error(translateError(error)[0] || "Unable to resolve bank account.")
    }
  }

  public async getBankList(kuda_token: string): Promise<any> {
    try {
      const response = await axios({
        method: 'post',
        url: 'https://kuda-openapi-uat.kudabank.com/v2.1',
        data: {
          "serviceType": "BANK_LIST",
          "requestRef": v4()
        },
        headers: {
          "Authorization": `Bearer ${kuda_token}`
        }
      })

      if(!response) throw new Error("Unable to retrieve list of banks.")

      const kudaBankObject = response.data.data.banks.find((obj: any) => {
        return obj.bankName.includes('Kudabank' || 'Kudimoney')
      })

      console.log(kudaBankObject)

      // Store current Kuda bank code
      await redisClient.connect()
      await redisClient.set("kudaBankCode", kudaBankObject.bankCode)
      await redisClient.disconnect();

      return response.data.data.banks
    } catch (error: any) {
      console.log(error)
      throw new Error("Unable to retrieve list of banks.")
    }
  }
}

export default WalletService

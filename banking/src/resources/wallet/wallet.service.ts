import walletModel from "./wallet.model"
const Paystack = require("paystack-api")(process.env.GATEWAY_SECRET_KEY)
import { v4 } from "uuid"
import userModel from "../user/user.model"
import IWallet from "./wallet.interface"
import translateError from "@/helpers/mongod.helper"
import mongoose from "mongoose"

class WalletService {

  public async initializePaystackCheckout(amount: number, userId: string, currency: string): Promise<IWallet | null> {
      try {
        
        const foundUser = await userModel.findById(userId).select("email fundPermission")
  
        if(!foundUser) throw new Error("Unable to initialize payment.")
  
        const { email } = foundUser
  
        if(!foundUser?.fundPermission) throw new Error("Verify your identity to fund your wallet.")
  
  
        const helper = new Paystack.FeeHelper();
        const amountPlusPaystackFees = helper.addFeesTo(amount * 100);
        const splitAccountFees = 100 * 100 //Charge an NGN100 flat fee, in kobo
  
        console.log(amountPlusPaystackFees, "paystack fees")
        console.log(splitAccountFees, "split account fees")
        
        //Initiaize paystack checkout
        const result = await Paystack.transaction.initialize({
          email,
          /* If amount is less than NGN2500, waive paystack's NGN100 charge to NGN10.
            There's an overflow padding of NGN10 due to paystack's incosistent fee.
          */
          amount:
            amount >= 2500
              ? Math.floor(amountPlusPaystackFees + 11000 + splitAccountFees)
              : Math.floor(amountPlusPaystackFees + 1000 + splitAccountFees),
          reference: v4(),
          currency,
          // split_code: process.env.GATEWAY_SPLIT_CODE,
          bearer: "account"
        });
    
        if (!result) throw new Error("Unable to initialize payment.")
  
        const newTransaction = await walletModel.create({
            referenceId: result.data.reference,
            transactionType: 'deposit',
            operationType: 'credit',
            amount,
            currency,
            fundRecipientAccount: userId,
            accessCode: result.data.access_code
        })
  
        if(!newTransaction) throw new Error("Unable to fund wallet at this moment. Try again.")

        return result.data

      } catch (error: any) {
        console.log(translateError(error))
        throw new Error(translateError(error.error)[0] || translateError(error)[0] || 'Unable to fund wallet at this moment. Try again.')
      }
  }

  public async verifyTransaction(reference: string): Promise<IWallet | null> {
    try {
      const result = await Paystack.transaction.verify({
        reference,
      });

      if (!result) throw new Error("Unable to verify deposit transaction. Try again")

      const resultData = result.data
      const paystack = resultData.fees;
      const totalProcessingFees = paystack + (100 * 100); //Paystack charge + retro pay NGN100 service fee, all in kobo

      const updatedTransaction = await walletModel.findOneAndUpdate({ referenceId: reference }, {
        status: resultData.status,
        processingFees: totalProcessingFees / 100,
        authorization: resultData.authorization,
        fullDepositData: resultData
      }, { new: true})

      if (!updatedTransaction) throw new Error("Unable to verify deposit transaction. Try again") 

      return updatedTransaction

    } catch (error: any) {
      console.log(translateError(error))
      throw new Error(translateError(error.error)[0] || translateError(error)[0] || 'Unable to verify deposit transaction. Try again.')
    }
  }

  public async getTransactionsByMonth(month: number, year: number, userId: string): Promise<any | null> {
    try {
      const creditTransactions: any = await walletModel.find({
        fundRecipientAccount: userId,
        status: "success",
        $and: [
          { $expr: {$eq: [{$month: "$createdAt"}, month]} },
          { $expr: {$eq: [{$year: "$createdAt"}, year]} }
        ]
      }).select
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
      `).sort({createdAt: -1})

      const debitTransactions: any = await walletModel.find({
        fundOriginatorAccount: userId,
        status: "success",
        $and: [
          { $expr: {$eq: [{$month: "$createdAt"}, month]} },
          { $expr: {$eq: [{$year: "$createdAt"}, year]} }
        ]
      }).select
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
      `).sort({createdAt: -1})
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

  private async validatePin(formPin: string, userId: string):Promise<boolean> {
    try {
      const foundUser = await userModel.findById(userId).select('pin');
  
      if(!foundUser) throw new Error("Error validatiing your pin")
      
      if (await foundUser.isValidPin(formPin)) {
        return true;
      }
      return false;
      
    } catch (error) {
      console.log(translateError(error))
      throw new Error('Balance unavailable.')
    }
  }

  public async transferFund(
    pin: string,
    amount: number,
    fundRecipientAccountTag: string,
    comment: string,
    fundOriginatorAccount: string,
    senderTag: string
  ): Promise<IWallet | null> {
    try {
      
      //find recipient account
      const foundRecipient = await userModel.findOne({
        username: fundRecipientAccountTag,
      }).select('username');

      console.log(foundRecipient)
      if (!foundRecipient) throw new Error("Invalid recipient account")

      // If user tries to transfer to their self
      if(foundRecipient._id == fundOriginatorAccount) throw new Error("Transfer can not be processed.")
  
      //calculate users wallet balance
      if ((await this.calculateWalletBalance(fundOriginatorAccount)) <= Number(amount) + 100 ) throw new Error("Transafer failed - Insufficient funds")
  
      if (!await this.validatePin(pin, fundOriginatorAccount)) throw new Error("Transafer failed - Incorrect transaction pin")
      //Log new transaction
      const newTransaction = await walletModel.create({
        fundRecipientAccount: foundRecipient._id,
        fundOriginatorAccount,
        amount,
        operationType: 'debit',
        transactionType: 'transfer',
        status: 'success',
        referenceId: v4(),
        comment,
        recepientTag: fundRecipientAccountTag,
        senderTag,
      });
  
      if (!newTransaction) throw new Error("Transafer failed - Unable to process transfer.")
      
      return newTransaction

    } catch (error) {
      console.log(translateError(error))
      throw new Error('Unable to retrieve transaction')
    }
  } 

  public async resolveBankAccount(account_number: string, bank_code: string): Promise<any> {
    try {
      const accountDetails = await Paystack.verification.resolveAccount({
        account_number,
        bank_code,
      });

      console.log(accountDetails)

      if(!accountDetails) throw new Error("Unable to resolve bank account.")

      return accountDetails.data
    } catch (error: any) {
      throw new Error(translateError(error.error)[0] || translateError(error)[0] || "Unable to resolve bank account.")
    }
  }

  public async getBankList(): Promise<any> {
    try {
      const banks = await Paystack.misc.list_banks({
        country: 'nigeria',
        use_cursor: true,
        perPage: 100,
      });

      if(!banks) throw new Error("Unable to retrieve list of banks.")

      return banks.data
    } catch (error: any) {
      throw new Error(translateError(error.error)[0] || translateError(error)[0] || "Unable to retrieve list of banks.")
    }
  }

  public async genererateTransferRecipient(fullName: string, account_number: string, bank_code: string): Promise<any> {
    try {
      const recipient = await Paystack.transfer_recipient.create({
        type: 'nuban',
        name: fullName,
        account_number,
        bank_code,
        currency: 'NGN',
      });

      if(!recipient) throw new Error("Unable to generate transfer recipient.")

      return recipient.data
    } catch (error: any) {
      throw new Error(translateError(error.error)[0] || translateError(error)[0] || "UUnable to generate transfer recipient.")
    }
  }
}

export default WalletService

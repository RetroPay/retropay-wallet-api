import walletModel from "./wallet.model"
import { v4 } from "uuid"
import userModel from "../user/user.model"
import IWallet from "./wallet.interface"
import translateError from "@/helpers/mongod.helper"
import mongoose from "mongoose"
import axios from "axios"
import { redisClient } from "../../server"
import IUser from "../user/user.interface"

class WalletService {

  public async getTransactionsByMonthandYear(month: number, year: number, userId: string): Promise<any | null> {
    try {
      const creditTransactions: any = await walletModel.find({
        fundRecipientAccount: userId,
        // status: "success",
        $and: [
          { $expr: {$eq: [{$month: "$createdAt"}, Number(month)]} },
          { $expr: {$eq: [{$year: "$createdAt"}, Number(year)]} }
        ]
      }, {
        fundOriginatorAccount: 0, 
        fundRecipientAccount: 0, 
        WebhookAcknowledgement:0
      }).sort({createdAt: -1})

      const debitTransactions: any = await walletModel.find({
        fundOriginatorAccount: userId,
        // status: "success",
        $and: [
          { $expr: {$eq: [{$month: "$createdAt"}, month]} },
          { $expr: {$eq: [{$year: "$createdAt"}, year]} }
        ]
      }, {
        fundOriginatorAccount: 0, 
        WebhookAcknowledgement:0
      }).sort({createdAt: -1})

      return {creditTransactions, debitTransactions}
    } catch (error: any) {
      console.log(translateError(error))
      throw new Error(translateError(error)[0] || 'Unable to retrieve transactions')
    }
  }

  public async getYearlyTransactions(year: number, userId: string): Promise<any> {
    try {
      if(year > (new Date).getFullYear()) throw new Error("Invalid year")

      const debitTransaction = await walletModel.aggregate([
        {
          $match: {
            fundOriginatorAccount: new mongoose.Types.ObjectId(userId),
            // status: "success",
            $expr: { $eq: [{$year: "$createdAt"}, Number(year)] },
          }
        },
        {
          $project: {
            amount: 1,
            month: { $month: "$createdAt" }
          }
        },
        {
          $group: {
            "_id": "$month",
            "totalDebit": {"$sum": "$amount"}
          }
        },
        {
          $sort: { _id: 1 }
        }
      ])

      const creditTransaction = await walletModel.aggregate([
        {
          $match: {
            fundRecipientAccount: new mongoose.Types.ObjectId(userId),
            // status: "success",
            $expr: { $eq: [{$year: "$createdAt"}, Number(year)] },
          }
        },
        {
          $project: {
            amount: 1,
            month: { $month: "$createdAt" }
          }
        },
        {
          $group: {
            "_id": "$month",
            "totalCredit": {"$sum": "$amount"}
          }
        },
        {
          $sort: { _id: 1 }
        }
      ])
      
      return {debitTransaction, creditTransaction}
    } catch (error) {
      console.log(translateError(error))
      throw new Error(translateError(error)[0] || 'Unable to retrieve yearly analytics')
    }
  }

  public async getTransactionDetails(userId: string, reference: string): Promise<IWallet | any> {
    try {
      const transaction = await walletModel.aggregate([
        {
          $match: {
            referenceId: reference
          }
        }, 
        {
          $lookup: {
            from: "users",
            let: { "fundRecipientAccount": "$fundRecipientAccount"},
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$fundRecipientAccount"]
                  }
                }
              }, {
                $project: {
                  _id: 0,
                  firstname: 1,
                  lastname: 1,
                  middlename: 1,
                  "profilePhoto" :1,
                  username: 1
                }
              }
            ],
            as: "FundRecipientDetails"
          }
        },
        {
          $lookup: {
            from: "users",
            let: { "fundOriginatorAccount": "$fundOriginatorAccount"},
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: ["$_id", "$$fundOriginatorAccount"]
                  }
                }
              }, {
                $project: {
                  _id: 0,
                  firstname: 1,
                  lastname: 1,
                  middlename: 1,
                  "profilePhoto" :1,
                  username: 1
                }
              }
            ],
            as: "FundOriginatorDetails"
          }
        }
      ])

      if(!transaction) throw new Error("Transaction not found.")
      
      if(transaction[0].fundRecipientAccount != userId && transaction[0].fundOriginatorAccount != userId) throw new Error("Unauthorized")

      return transaction[0]
    } catch (error: any) {
      console.log(translateError(error))
      throw new Error(translateError(error)[0] || 'Unable to retrieve transaction')
    }
  }

  public async calculateWalletBalance(userId: string): Promise<number> {
    try {
      const credits = await walletModel.aggregate([
        // { $match: { fundRecipientAccount: new mongoose.Types.ObjectId(userId), status: 'success'} },
        { $match: { fundRecipientAccount: new mongoose.Types.ObjectId(userId)} },
        { $group: { _id: null, totalCredits: { $sum:'$amount'} } }
      ])

      const debits = await walletModel.aggregate([
        // { $match: { fundOriginatorAccount: new mongoose.Types.ObjectId(userId), status: 'success'} },
        { $match: { fundOriginatorAccount: new mongoose.Types.ObjectId(userId)} },
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

  public async getAccountBalance(referenceId: string, k_token: string, userId: string): Promise<any> {
    try {

      const foundUser = await userModel.findOne({referenceId})
      if(!foundUser?.nubanAccountDetails) throw new Error("You don't have an account number yet. Kindly create a nuban account to get started.")
      // const response = await axios({
      //   method: 'POST',
      //   url: 'http://kuda-openapi-uat.kudabank.com/v2.1',
      //   data: {
      //       ServiceType :"RETRIEVE_VIRTUAL_ACCOUNT_BALANCE",
      //       RequestRef: v4(),
      //       data: {
      //         trackingReference: referenceId,
      //       }
      //   },
      //   headers: {
      //       Authorization: `Bearer ${k_token}`
      //   }
      // })

      // const data = response.data
      // console.log(data)

      // if(!data.status) throw new Error(data.message)

      // return data.data.availableBalance

      return this.calculateWalletBalance(userId)
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
  ): Promise<any> {
    try {
      
      //find recipient account
      const foundRecipient = await userModel.findOne({
        username: fundRecipientAccountTag,
      })

      console.log(foundRecipient)
      if (!foundRecipient) throw new Error("Invalid recipient account.")

      //If intended recipient doesn't have a nuban account created yet
      if(!foundRecipient?.nubanAccountDetails?.nuban) throw new Error("Unable to process transaction.")

      const foundUser = await userModel.findById(userId).select("firstname lastname")
      if(!foundUser) throw new Error('Unable to process transaction.')


      // If user tries to transfer to their own account lol.
      if(foundRecipient._id == userId) throw new Error("Unable to process transaction.")
  
      //calculate users wallet balance
      // if ((await this.calculateWalletBalance(fundOriginatorAccount)) <= Number(amount) + 100 ) throw new Error("Transafer failed - Insufficient funds")
  
      if (!await this.validatePin(formPin, userId)) throw new Error("Transfer failed - Incorrect transaction pin")

      // await redisClient.connect()

      // const response = await axios({
      //     method: 'post',
      //     url: 'https://kuda-openapi-uat.kudabank.com/v2.1',
      //     data: {
      //       "serviceType": "VIRTUAL_ACCOUNT_FUND_TRANSFER",
      //       "requestRef": v4(),
      //       data: {
      //         trackingReference: referenceId, //Unique identifier of user with Kuda
      //         beneficiaryAccount: foundRecipient?.nubanAccountDetails?.nuban,
      //         amount: amount * 100, //amount in Kobo
      //         narration: comment,
      //         beneficiaryBankCode: await redisClient.get("kudaBankCode") || '999129',
      //         beneficiaryName,
      //         senderName: foundUser.lastname + ' ' + foundUser.firstname,
      //       }
      //     },
      //     headers: {
      //       "Authorization": `Bearer ${k_token}`
      //     }
      //   })

      //   await redisClient.disconnect();
  
      //   const data = response.data
      //   console.log(data)
            
      //   //if axios call is successful but kuda status returns failed e'g 400 errors
      //   if(!data.status) {
      //     const { responseCode } = data

      //     switch (responseCode) {
      //       case '06' : throw new Error('Transfer failed - processng error.')
      //         break;
      //       case '52' : throw new Error('Transfer failed - Inactive recipient account.')
      //         break;
      //       case '23' : throw new Error('Transfer failed - A PND is active on your account. Kindly contact support.')
      //         break;
      //       case '51' : throw new Error('Transfer failed - Insufficient funds on account.')
      //         break;
      //       case '93' : throw new Error('Transfer failed - Cash limit exceeded for your account tier.')
      //         break;
      //       case 'k91' : throw new Error('Transfer error - Transaction timeout, Kindly contact support to confirm transaction status.')
      //         break;
      //       default: throw new Error(data.message)
      //     }
      //   }


        //Log new transaction
        const newTransaction = await walletModel.create({
          fundRecipientAccount: foundRecipient._id,
          fundOriginatorAccount: userId,
          amount,
          transactionType: 'transfer',
          status: 'pending',
          // referenceId: process.env.NODE_ENV == 'development' ? v4() : data.transactionReference,
          referenceId: 'test-transfer' + v4(),
          comment,
          recepientTag: fundRecipientAccountTag,
          senderTag,
          // responseCode: data.responseCode,
          beneficiaryName,
          currency: 'NGN',
          processingFees: 5,
        });
            
        return {
          amount, 
          // transactionId: data.transactionReference,
          transactionId: newTransaction.referenceId,
          fundRecipientAccountTag,
          transactionType: 'Transfer',
          createdAt: newTransaction?.createdAt
        }

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
    beneficiaryBank: string,
    beneficiaryName: string, 
    nameEnquiryId: string,
    k_token: string ): Promise<IWallet |  any>
    {
      try {
        const foundUser = await userModel.findById(userId).select("firstname lastname")
        if(!foundUser) throw new Error("Unable to process transaction.")

        if (await this.validatePin(formPin, userId) == false) throw new Error("Transfer failed - Incorrect transaction pin")

        // const response = await axios({
        //   method: 'post',
        //   url: 'https://kuda-openapi-uat.kudabank.com/v2.1',
        //   data: {
        //     "serviceType": "VIRTUAL_ACCOUNT_FUND_TRANSFER",
        //     "requestRef": v4(),
        //     data: {
        //       trackingReference: referenceId, //Unique identifier of user with Kuda
        //       beneficiaryAccount,
        //       amount: amount * 100, //amount in Kobo
        //       narration: comment,
        //       beneficiaryBankCode,
        //       beneficiaryName,
        //       senderName: foundUser.lastname + ' ' + foundUser.firstname,
        //       nameEnquiryId,
        //     }
        //   },
        //   headers: {
        //     "Authorization": `Bearer ${k_token}`
        //   }
        // })
  
        // const data = response.data
        // console.log(data)
            
        // //if axios call is successful but kuda status returns failed e'g 400 errors
        // if(!data.status) {
        //   const { responseCode } = data

        //   switch (responseCode) {
        //     case '-1' : throw new Error('Transfer failed - Transaction cancelled.')
        //       break;
        //     case '-2' : throw new Error('Transfer failed.')
        //       break;
        //     case '-3' : throw new Error('Transfer failed - Unable to process transaction')
        //       break;
        //     case '91' : throw new Error('Transfer failed - Request timeout.')
        //       break;
        //     default: throw new Error('Unable to process transaction')
        //   }
        // }

        const newTransaction = await walletModel.create({
          fundOriginatorAccount: userId,
          amount,
          transactionType: 'withdrawal',
          status: 'pending',
          referenceId: 'test-withdrawal' + v4(),
          // referenceId: process.env.NODE_ENV == 'development' ? v4() : data.transactionReference,
          processingFees: 20,
          comment,
          beneficiaryBankCode, 
          beneficiaryBank,
          beneficiaryName,
          nameEnquiryId,
          beneficiaryAccount,
          // responseCode: data.responseCode,
          currency: 'NGN'
        });
    
        return {
          amount, 
          // transactionId: data.transactionReference,
          transactionId: newTransaction.referenceId,
          beneficiaryName, 
          beneficiaryBank,
          transactionType: 'Withdrawal',
          createdAt: newTransaction?.createdAt
        }

      } catch (error) {
        console.log(error)
        throw new Error(translateError(error)[0] || 'Transfer failed - Unable to process transfer.')
      }
  }

  public async getTransactionStatus(userId: string, k_token: string, transactionReference: string): Promise<any> {
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
      if(!data.status) throw new Error(data.responseCode == 'k25' ? 'Record not found' : data.message)

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
        const foundRecipient = await userModel.findOne({username}).select('nubanAccountDetails transferPermission lastname firstname middlename isIdentityVerified profilePhoto')
        console.log(foundRecipient)

        /*Check if user exists and has created a nuban to recieve funds in else throw error*/
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

        const { beneficiaryName } = data.data
        const { lastname, firstname, middlename, isIdentityVerified, profilePhoto } = foundRecipient

        return {
          lastname, 
          firstname, 
          middlename,
          isIdentityVerified,
          profilePhoto,
          beneficiaryName
        }

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

  //KUDA WEBHOOK SERVICES

  public async recieveFunds(payingBank: string,  amount: string, transactionReference: string, narrations: string, accountName: string, accountNumber: string, transactionType: string, senderName: string, recipientName: string, sessionId: string): Promise<void> {
    try {
      const foundRecipient = await userModel.findOne({'nubanAccountDetails.nuban': accountNumber})
      console.log(foundRecipient)
      if(!foundRecipient) throw new Error('No account with that nuban found')

      /* 
        When this webhook is fired, it is due to either a retro wallet user sent funds to the recipient or it's a transfer from an external bank (wallet funding).
        If the transaction is from a retro wallet user, then there is no need to create/log a new transacrion object, because we already do that when the sender sends the funds,
        what should be done it to acknowledge that the recipient has recieved the funds and update the status of the transaction.
      */
      const updatedTransaction = await walletModel.findOneAndUpdate(
        { referenceId: transactionReference }, 
        { $set: { fundsReceivedbyRecipient: true }, status: 'success' },
        { new: true }
      )

      // If paying bank isn't kuda bank, charge a NGN100 deposit fee
      if(!payingBank.includes('kuda')) {
        await redisClient.connect()

        const response = await axios({
            method: 'post',
            url: 'https://kuda-openapi-uat.kudabank.com/v2.1',
            data: {
              "serviceType": "WITHDRAW_VIRTUAL_ACCOUNT",
              "requestRef": v4(),
              data: {
                trackingReference: foundRecipient.referenceId, //Unique identifier of user with Kuda
                amount: 100 * 100, //amount in Kobo
                narration: 'Retro Wallet deposit processing fee.',
              }
            },
            headers: {
              "Authorization": `Bearer ${await redisClient.get('K_TOKEN')}`
            }
          })

          await redisClient.disconnect();

          // Log transaction if it is a funding transaction
          const newTransaction = await walletModel.create({
              fundRecipientAccount: foundRecipient._id,
              amount: (Number(amount)/100), //convert from kobo
              transactionType: 'fund',
              status: 'success',
              referenceId: process.env.NODE_ENV == 'development' ? v4() : transactionReference,
              comment: narrations,
              beneficiaryName: accountName,
              beneficiaryAccount: accountNumber,
              currency: 'NGN',
              senderName,
              processingFees: 100
          })
          console.log(newTransaction)
      }

    } catch (error) {
      console.log(error)
      //LogSnag call here
    }
  }

  //Aknowledge that funds have left senders account, and kuda is processing transfer
  public async acknowledgeFundsTransfer(amount: string, transactionReference: string, sessionId: string): Promise<void> {
    try {
      const transaction = await walletModel.findOneAndUpdate(
        { referenceId: transactionReference }, 
        { $set: { WebhookAcknowledgement: true }, status: 'success' },
        { new: true }
      )
      console.log(transaction)
    } catch (error) {
      console.log(error)
      //LogSnag call here
    }
  }
} 


export default WalletService

import userModel from "../user/user.model";
import axios from "axios";
import { v4 } from "uuid";
import translateError from "@/helpers/mongod.helper";
import Bill from "./bill.interface";
import generateOtp from "@/services/otp";
import billModel from "./bill.model";
import { redisClient, logsnag } from "../../server";
import IBill from "./bill.interface";
import IUser from "../user/user.interface";


class BillService {
  /**
   * retrieves the list of all billers by Kuda
   */
  public async getBillProviders(
    k_token: string,
    billCategory: string
  ): Promise<object[]> {
    try {
      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production" //change back to prod
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "GET_BILLERS_BY_TYPE",
          RequestRef: v4(),
          Data: {
            BillTypeName: billCategory,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      if (!data.status)
        throw new Error(
          "We were unable to get the bill providers, please try again."
        );

      return data.data;
    } catch (error) {
      throw new Error(
        translateError(error)[0] ||
        "We were unable to get the bill providers, please try again."
      );
    }
  }

  /**
   * 
   * @param k_token 
   * @param referenceId 
   * @param KudaBillItemIdentifier 
   * @param CustomerIdentification 
   * @returns customer information, if verification request is successful, customer's identity has been verified
   */
  public async verifyCustomer(k_token: string, referenceId: string, KudaBillItemIdentifier: string, CustomerIdentification: string) {
    try {
      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "VERIFY_BILL_CUSTOMER",
          RequestRef: v4(),
          Data: {
            trackingReference: referenceId,
            KudaBillItemIdentifier,
            CustomerIdentification
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      if (!data.status)
        throw new Error(
          "We were unable to verify the bill recipient, please try again."
        );

      return data.data;
    } catch (error) {
      throw new Error(
        translateError(error)[0] ||
        "We were unable to verify the bill recipient, please try again."
      );
    }
  }

  /**
   * 
   * @param formPin 
   * @param userId 
   * @returns true if pin is correct and false if pin is incorrect
   */
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

  /**
   * Purchase all bill types
   * @param userId 
   * @param formPin 
   * @param k_token 
   * @param referenceId 
   * @param phoneNumber 
   * @param amount 
   * @param KudaBillItemIdentifier 
   * @param CustomerIdentification 
   * @returns 
   */
  public async purchaseBill(userId: string, formPin: string, k_token: string, billCategory: string, referenceId: string, phoneNumber: string, amount: number, KudaBillItemIdentifier: string, CustomerIdentification: string) {
    try {

      if (!(await this.validatePin(formPin, userId)))
        throw new Error("Transfer failed - Incorrect transaction pin");

      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "PURCHASE_BILL",
          // RequestRef: v4(),
          RequestRef: generateOtp(25),
          Data: {
            TrackingReference: referenceId,
            Amount: amount * 100,
            BillItemIdentifier: KudaBillItemIdentifier,
            PhoneNumber: phoneNumber || CustomerIdentification || "",
            CustomerIdentifier: CustomerIdentification
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      //  implement error message based on status codes
      if (!data.status) {
        const { responseCode } = data

        switch (String(responseCode)) {
          case 'k11' || '11': throw new Error('Bill payment failed.')
            break;
          case '06': throw new Error('Bill payment failed.')
            break;
          case 'k12': throw new Error('Your bill payment is currently pending.')
            break;
          case '51' || 'k51': throw new Error('Payment failed - Insufficient funds on account.')
            break;
          case 'k25' || 'k09': throw new Error('Bill payment failed - invalid customer ID or Phone number.')
            break;
          case 'k26': throw new Error('Bill payment failed - Please try again.')
            break;
          default: throw new Error("Bill payment failed")
        }
      }

      //save bill transaction
      const newBillPurchase = await billModel.create({
        fundOriginatorAccount: userId,
        amount: amount,  //amount in naira
        billItemIdentifier: KudaBillItemIdentifier,
        phoneNumber,
        customerIdentifier: CustomerIdentification,
        transactionReference: data.data.reference,
        status: "pending",
        billCategory
      })

      return {
        amount: newBillPurchase.amount,
        phoneNumber,
        customerIdentifier: CustomerIdentification,
        transactionReference: newBillPurchase.transactionReference,
      }

      // return data.data;
    } catch (error) {
      throw new Error(
        translateError(error)[0] ||
        "We're were unable to process your bill purchase, Please try again"
      );
    }
  }

  public async updateBillPurchase(k_token: string, payingBank: string, transactionReference: string, narrations: string, instrumentNumber: string): Promise<any> {
    try {
      //Get bill purchase status
      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "BILL_TSQ",
          RequestRef: v4(),
          Data: {
            BillResponseReference: transactionReference
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;
      console.log(data)


      const transaction: IBill | null = await billModel.findOneAndUpdate(
        { transactionReference },
        {
          narrations,
          payingBank,
          instrumentNumber, status: data.data.HasBeenReserved ? 'reversed' : "success"
        }, { new: true })

      if (!transaction) throw new Error('Bill purchase record not found')

      const billPurchaser: IUser | null = await userModel.findById(transaction.fundOriginatorAccount)

      return {
        transactionType: 'BillPurchase',
        id: billPurchaser?.referenceId,
        amount: transaction.amount,
        oneSignalPlayerId: billPurchaser?.oneSignalDeviceId,
        narrations,
        payingBank,
        createdAt: transaction.createdAt,
        status: transaction.status
      }
    } catch (error) {
      throw new Error(`Unable to process update bill purchase webhook. error: ${error}`);
    }
  }

  public async getBillHistoryById(userId: string, billCategory: string): Promise<IBill[]> {
    try {
      const billHistory: IBill[] = await billModel.find({fundOriginatorAccount: userId, billCategory, $or: [{status: 'success'}, {status: 'reversed'}]}).select("amount narrations billItemIdentifier payingBank createdAt transactionReference")

      if(!billHistory) throw new Error("Failed to retrieve bill history, please try again.")
      
      return billHistory;
    } catch (error) {
      throw new Error(`Unable to process update bill purchase webhook. error: ${error}`)
    }
  }
}

export default BillService;

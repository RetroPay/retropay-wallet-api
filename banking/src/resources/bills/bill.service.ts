import userModel from "../user/user.model";
import axios from "axios";
import { v4 } from "uuid";
import translateError from "@/helpers/mongod.helper";
import Bill from "./bill.interface";

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

      console.log(response);
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
    
          console.log(response);
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

  public async purchaseBill(k_token: string, referenceId: string, phoneNumber: string, amount: number, KudaBillItemIdentifier: string, CustomerIdentification: string) {
    try {
        const response = await axios({
            method: "POST",
            url:
              process.env.NODE_ENV == "production"
                ? "https://kuda-openapi.kuda.com/v2.1"
                : "https://kuda-openapi-uat.kudabank.com/v2.1",
            data: {
              ServiceType: "PURCHASE_BILL",
              // requestref: v4(),
              RequestRef: "",
              Data: {
                TrackingReference: referenceId,
                Amount: amount,
                BillItemIdentifier: KudaBillItemIdentifier,
                // PhoneNumber: phoneNumber || "",
                CustomerIdentifier: CustomerIdentification
              },
            },
            headers: {
              Authorization: `Bearer ${k_token}`,
            },
          });
    
          console.log(response);
          const data = response.data;
          
        //  implement error message based on status codes
          if (!data.status)
            throw new Error(
              "Bill payment failed"
            );
    
          return data.data;
    } catch (error) {
        throw new Error(
            translateError(error)[0] ||
              "Bill payment failed"
          );
    }
  }
}

export default BillService;

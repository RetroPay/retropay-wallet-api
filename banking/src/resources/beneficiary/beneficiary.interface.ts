import { ObjectId } from "mongoose";

export default interface IBeneficiary {
  userId: ObjectId | any;
  currency: "USD" | "NGN" | "NGN_X" | "GHS" | "KES" | "XAF";
  accountName: string;
  accountNumber?: string;
  bankName?: string;
  bankCode?: string;
  address?: string;
  phoneNumber?: string;
}

import { InferSchemaType, Schema, model } from "mongoose";
import IBeneficiary from "./beneficiary.interface";

const { ObjectId } = Schema.Types;

const beneficiarySchema = new Schema(
  {
    userId: {
      type: ObjectId,
      ref: "User",
    },
    currency: {
      type: String,
      enum: ["USD", "NGN", "NGN_X", "GHS", "KES", "XAF"],
    },
    accountName: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    bankName: {
      type: String,
      trim: true,
    },
    bankCode: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    phoneNumber: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export type TBeneficiary = InferSchemaType<typeof beneficiarySchema>;

export default model<IBeneficiary & TBeneficiary>(
  "Beneficiary",
  beneficiarySchema
);

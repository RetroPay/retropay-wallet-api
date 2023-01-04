import { Schema, model } from "mongoose"
import IWallet from "./wallet.interface";

const WalletSchema = new Schema(
  {
    transactionType: {
      type: String,
      trim: true,
      enum: ['deposit', 'withdrawal', 'transfer'],
      required: true
    },
    currency: String,
    accessCode: { type: String },
    fundRecipientAccount: { type: Schema.Types.ObjectId, ref: 'User' },
    fundOriginatorAccount: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      trim: true,
      default: 'pending',
      enum: ['pending', 'success', 'failed', 'abandoned', 'reversed'],
      required: true
    },
    processingFees: { type: Number, default: 0 },
    amount: {
      type: Number,
      required: true
    },
    referenceId: { type: String, unique: true, required: true },
    comment: { type: String },
    recepientTag: { type: String },
    senderTag: { type: String },
    responseCode: String,
    beneficiaryBankCode: { type: String },
    beneficiaryBank: String,
    beneficiaryName: { type: String },
    nameEnquiryId: { type: String },
    beneficiaryAccount: { type: String },
  },
  {
    timestamps: true
  }
);

export default model<IWallet>('wallet', WalletSchema)

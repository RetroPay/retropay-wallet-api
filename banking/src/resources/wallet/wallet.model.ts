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
    operationType: {
      type: String,
      trim: true,
      enum: ['credit', 'debit'],
      required: true
    },
    fundRecipientAccount: { type: Schema.Types.ObjectId, ref: 'User' },
    fundOriginatorAccount: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      trim: true,
      default: 'pending',
      enum: ['pending', 'success', 'failed', 'abandoned'],
      required: true
    },
    processingFees: { type: Number, default: 0 },
    amount: {
      type: Number,
      required: true
    },
    referenceId: { type: String, unique: true, required: true },
    authorization: { type: Object },
    comment: { type: String },
    recepientTag: { type: String },
    senderTag: { type: String },
    withdrawalRecipientBankDetails: { type: Object },
    fullDepositData: { type: Object }
  },
  {
    timestamps: true
  }
);

export default model<IWallet>('wallet', WalletSchema)

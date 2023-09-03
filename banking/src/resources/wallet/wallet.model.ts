import { Schema, model } from "mongoose"
import IWallet from "./wallet.interface";

// Transaction schema

const WalletSchema = new Schema(
  {
    transactionType: {
      type: String,
      trim: true,
      enum: ['funding', 'withdrawal', 'transfer', 'swap'],
      required: true
    },
    currency: {type: String, enum: ['NGN', 'USD', 'GHS', 'KES', 'XAF', "NGN_X"]},
    fundRecipientAccount: { type: Schema.Types.ObjectId, ref: 'User' },
    fundOriginatorAccount: { type: Schema.Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      trim: true,
      default: 'pending',
      enum: ['pending', 'success', 'failed', 'reversed'],
      required: true
    },
    processingFees: { type: Number, default: 0 },
    amount: {
      type: Number,
      required: true
    },
    scheme: { type: String, enum: ["DOM", "MOBILEMONEY", "BANK"] },
    referenceId: { type: String, unique: true, required: true },
    comment: { type: String },
    recepientTag: { type: String },
    senderTag: { type: String },
    responseCode: String,
    beneficiaryBankCode: { type: String },
    beneficiaryBank: String,
    senderName: {type: String},
    senderBank: { type: String },   
    beneficiaryName: { type: String },
    nameEnquiryId: { type: String },
    beneficiaryAccount: { type: String },
    senderWebhookAcknowledgement: {type: Boolean, default: false},
    fundsReceivedbyRecipient: {type: Boolean, default: false},
    instrumentNumber: String,
    senderProfile: String,
    recipientProfile: String,
    isBudgetTransaction: {
      type: Boolean,
      default: false
    },
    budgetUniqueId: { type: String },
    budgetItemId: String,
    swapQuoteReference: { type: String }
  },
  {
    timestamps: true
  }
);

export default model<IWallet>('wallet', WalletSchema)

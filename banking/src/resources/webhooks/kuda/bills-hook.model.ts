import { Schema, model } from "mongoose"

const webhookSchema = new Schema(
  {
    payingBank: { type: String },
    amount: String,
    transactionReference: String,
    transactionDate: Date,
    narrations: String,  
    accountName: String,
    accountNumber: String,
    transactionType: String,
    recipientName: String,
    instrumentNumber: String,
    sessionId: String,
  },
  {
    timestamps: true
  }
);

export default model('bill-webhook', webhookSchema)

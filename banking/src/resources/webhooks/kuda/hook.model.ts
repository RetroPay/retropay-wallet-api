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
    senderName: String,
    recipientName: String,
    instrumentNumber: String,
    sessionId: String,
    event: String
  },
  {
    timestamps: true
  }
);

export default model('kuda-webhook', webhookSchema)

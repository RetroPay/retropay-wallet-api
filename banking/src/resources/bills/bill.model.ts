import mongoose, { Schema, model } from 'mongoose'
import IBill from './bill.interface'

const billSchema = new Schema({
    fundOriginatorAccount: { type: Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number, required: true },
    billItemIdentifier: { type: String, required: true },
	phoneNumber: { type: String },
	customerIdentifier: { type: String,  },
    transactionReference: { type: String, required: true, unique: true },
    narrations: { type: String },
    instrumentNumber: { type: String },
    status: { type: String, enum: ["success", "pending", "reversed"]},
    billCategory: { type: String, required: true },
    payingBank: { type: String },
    billerName: { type: String },
    billerImageUrl: { type: String },
}, {
    timestamps: true
});

export default model<IBill>('bill', billSchema)
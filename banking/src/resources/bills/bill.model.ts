import mongoose, { Schema, model } from 'mongoose'
import IBill from './bill.interface'

const billSchema = new Schema({
    referenceId: { type: String, required: true },
    amount: { type: Number, required: true },
    billItemIdentifier: { type: String, required: true },
	phoneNumber: { type: String, required: true },
	customerIdentifier: { type: String, required: true },
    transactionReference: { type: String, required: true },
}, {
    timestamps: true
})
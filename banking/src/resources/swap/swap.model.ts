import { boolean } from "joi";
import { Schema, model, SchemaTypes } from "mongoose";
import ISwap from "./swap.interface";

const SwapSchema = new Schema({
  reference: {
    type: String,
    required: true,
  },
  source: {
    currency: {
      type: String,
      enum: ["USD", "NGN", "NGN_X", "GHS", "KES", "XAF"],
    },
    amount: Number,
    human_readable_amount: Number,
  },
  target: {
    currency: {
      type: String,
      enum: ["USD", "NGN", "NGN_X", "GHS", "KES", "XAF"],
    },
    amount: Number,
    human_readable_amount: Number,
  },
  isInitiated: {
    type: Boolean,
    default: false
  },
  userId: {
    type: SchemaTypes.ObjectId, 
    ref: 'User'
  }
});


export default model<ISwap>('swap', SwapSchema)

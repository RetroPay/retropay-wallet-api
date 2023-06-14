import { number } from "joi";
import { Schema, model } from "mongoose";
import IBudget from "./budget.interface";

const budgetModel = new Schema(
  {
    budgetName: {
      type: String,
      required: true,
    },
    budgetOwnerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    totalBudgetAmount: {
      type: Number, // currency smallest unit. e.g kobo for NGN, cent for USD
      required: true,
      default: 0
    },
    budgetAmountRemaining: {
      type: Number,
      required: true,
      default: 0
    },
    currency: {
      type: String,
      enum: ["NGN", "USD", "GHC", "KSH", "XAF"],
      required: true
    },
    budgetItems: [
      {
        budgetItemAmount: {
          type: Number,
          default: 0,
        },
        budgetItemAmountRemaining: {
          type: Number,
          default: 0,
        },
        budgetItemName: {
          type: String,
        },
      },
    ],
    budgetMonth: {
      type: String,
      enum: [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ],
    },
    budgetYear: {
      type: String,
    },
    budgetUniqueId: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true,
  }
);

export default model<IBudget>('budget', budgetModel)
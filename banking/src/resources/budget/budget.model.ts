import { number } from "joi";
import { Schema, model } from "mongoose";
import IBudget from "./budget.interface";

const budgetModel = new Schema(
  {
    budgetName: {
      type: String,
      required: true,
    },
    budgetIcon: {
      type: String,
    },
    budgetOwnerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    initialBudgetAmount: {
      type: Number,
      required: true,
      // default: 0
    },
    totalBudgetAmount: {
      type: Number, // currency smallest unit. e.g kobo for NGN, cent for USD
      required: true,
      default: 0
    },
    // isExceeded: {
    //   type: Boolean,
    //   required: true,
    //   default: false
    // },
    budgetAmountSpent: {
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
        budgetItemAmountSpent: {
          type: Number,
          default: 0,
        },
        budgetItemName: {
          type: String,
        },
        budgetItemIcon: {
          type: String,
        },
        isExceeded: {
          type: Boolean,
          default: false
        },
        topUpHistory: [
          {
            date: Date,
            topUpAmount: Number
          }
        ]
      },
    ],
    endDate: {
      type: Date,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    budgetUniqueId: {
      type: String,
      required: true,
      unique: true
    }
  },
  {
    timestamps: true,
  }
);

export default model<IBudget>('budget', budgetModel)
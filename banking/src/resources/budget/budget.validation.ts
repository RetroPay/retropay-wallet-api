import joi from "joi";

export const createBudget = joi.object({
  budgetIcon: joi.string(),
  budgetAmount: joi.number().required(),
  startDate: joi.date().required(),
  endDate: joi.date().required(),
  budgetName: joi.string().required(),
  budgetItems: joi.array().required(),
  currency: joi.string().valid("NGN", "USD", "GHC", "KSH", "XAF").required(),
});

export const addFundsToBudget = joi.object({
  amount: joi.number().required(),
  budgetUniqueId: joi.string().required(),
  budgetItemId: joi.string().required(),
});

export const transferFromBudget = joi.object({
  budgetUniqueId: joi.string().required(),
  amount: joi.number().required(),
  budgetItemId: joi.string().required(),
  pin: joi.string().required().min(4).max(4),
  recipientTag: joi.string().required(),
  comment: joi.string().required(),
  beneficiaryName: joi.string().required(),
});

export const withdrawFromBudget = joi.object({
  budgetUniqueId: joi.string().required(),
  amount: joi.number().required(),
  budgetItemId: joi.string().required(),
  pin: joi.string().required().min(4).max(4),
  comment: joi.string().required(),
  beneficiaryName: joi.string().required(),
  beneficiaryBankCode: joi.string().required(),
  beneficiaryBank: joi.string().required(),
  beneficiaryAccount: joi.string().required(),
  nameEnquiryId: joi.string().required(),
});

export const editBudget = joi.object({
  budgetIcon: joi.string(),
  budgetName: joi.string(),
});

export default {
  createBudget,
  addFundsToBudget,
  transferFromBudget,
  withdrawFromBudget,
  editBudget,
};

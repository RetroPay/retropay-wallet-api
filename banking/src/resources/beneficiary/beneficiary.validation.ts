import joi from "joi";

export const createBeneficiary = joi.object({
  userId: joi.string(),
  currency: joi.string().valid("NGN", "USD", "GHS", "KSH", "XAF").required(),
  accountName: joi.string().required(),
  accountNumber: joi.string(),
  bankName: joi.string(),
  bankCode: joi.string(),
  address: joi.string(),
  phoneNumber: joi.string(),
});

export default {
  createBeneficiary,
};

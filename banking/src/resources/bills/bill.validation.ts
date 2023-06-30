import Joi from "joi";

const billPurchase = Joi.object({
  amount: Joi.number().required(),
  kudaBillItemIdentifier: Joi.string().required(),
  customerIdentification: Joi.string().required(),
  phoneNumber: Joi.string(),
  pin: Joi.string().required().max(4).min(4),
  billCategory: Joi.string().valid(
    "airtime",
    "betting",
    "internet Data",
    "electricity",
    "cableTv"
  ),
  billerName: Joi.string().required(),
  billerImageUrl: Joi.string().required(),
  narrations: Joi.string().required()
});

const verifyBillCustomer = Joi.object({
  kudaBillItemIdentifier: Joi.string().required(),
  customerIdentification: Joi.string().required(),
});

export default {
  verifyBillCustomer,
  billPurchase,
};

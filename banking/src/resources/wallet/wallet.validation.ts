import Joi from "joi";

const fundWallet = Joi.object({
  amount: Joi.number().required(),
});

const transferFunds = Joi.object({
  pin: Joi.string().required().min(4).max(4),
  amount: Joi.number().required(),
  comment: Joi.string().required(),
  recipientTag: Joi.string().required(),
  beneficiaryName: Joi.string().required(),
});

const resolveAccount = Joi.object({
  bankCode: Joi.string().required(),
  accountNumber: Joi.string().required(),
  currency: Joi.string()
});

const resolveAccountTag = Joi.object({
  accountTag: Joi.string().required(),
});

const withdrawFunds = Joi.object({
  pin: Joi.string().required().min(4).max(4),
  amount: Joi.number().required(),
  beneficiaryAccount: Joi.string().required(),
  comment: Joi.string().required(),
  beneficiaryBankCode: Joi.string().required(),
  beneficiaryName: Joi.string().required(),
  nameEnquiryId: Joi.string().required(),
  beneficiaryBank: Joi.string().required(),
});

const withdrawFundsV2 = Joi.object({
  currency: Joi.string().required().valid("NGN", "XAF", "USD", "KES", "GHS"),
  pin: Joi.string().required().min(4).max(4),
  amount: Joi.number().required(),
  beneficiaryAccount: Joi.string().required(),
  comment: Joi.string().required(),
  beneficiaryBankCode: Joi.string().required(),
  beneficiaryName: Joi.string().required(),
  nameEnquiryId: Joi.string(),
  beneficiaryBank: Joi.string().required(),
  recipientInfo: Joi.object({
    first_name: Joi.string(),
    last_name: Joi.string(),
    address: Joi.string(),
    phone_number: Joi.string(),
    country: Joi.string(),
    name: Joi.string()
  })
});

const createCurrencyAccount = Joi.object({
  currency: Joi.string().required().valid("NGN", "USD", "GHS", "KES", "XAF", "NGN_X"),
  meta: Joi.object({
    occupation: Joi.string(),
    utility_bill: Joi.string(), //image url or file
    bank_statement: Joi.string(), //pdf url or file
    identity_type: Joi.string(), // only passport can be used right now
    identity_image: Joi.string(), // passport photo url or file
    identity_number: Joi.string(), //passport number
    identity_issued_date: Joi.date(), //passport issuance date. Format: YYYY-MM-DD,
    identity_expiration: Joi.date(),
  }),
});

export default {
  fundWallet,
  transferFunds,
  resolveAccount,
  withdrawFunds,
  resolveAccountTag,
  createCurrencyAccount,
  withdrawFundsV2,
};

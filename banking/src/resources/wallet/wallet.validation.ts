import Joi from "joi"

const fundWallet = Joi.object({
    amount: Joi.number().required()
})

const transferFunds = Joi.object({
    pin: Joi.string().required().min(4).max(4),
    amount: Joi.number().required(),
    comment: Joi.string().required(),
    recipientTag: Joi.string().required()
})

const resolveAccount= Joi.object({
    bankCode: Joi.string().required(),
    accountNumber: Joi.string().required()
})

const withdrawFunds = Joi.object({
    pin: Joi.string().required(),
    amount: Joi.number().required(),
    beneficiaryAccount: Joi.string().required(),
    comment: Joi.string().required(), 
    beneficiaryBankCode: Joi.string().required(), 
    beneficiaryName: Joi.string().required(), 
    nameEnquiryId: Joi.string().required(),
})


export default {
    fundWallet,
    transferFunds,
    resolveAccount,
    withdrawFunds
}
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


export default {
    fundWallet,
    transferFunds,
    resolveAccount
}
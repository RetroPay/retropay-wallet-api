import Joi from 'joi'

const billPurchase = Joi.object({
    amount: Joi.number().required(),
    kudaBillItemIdentifier: Joi.string().required(),
    customerIdentification: Joi.string().required(),
    phoneNumber: Joi.string()
})

const verifyBillCustomer = Joi.object({
    kudaBillItemIdentifier: Joi.string().required(),
    customerIdentification: Joi.string().required()
})

export default {
    verifyBillCustomer,
    billPurchase
}
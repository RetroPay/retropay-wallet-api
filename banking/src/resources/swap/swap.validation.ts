import Joi from 'joi';

const swapQuote = Joi.object({
    sourceCurrency: Joi.string().required().valid("NGN_X", "XAF", "USD", "KES", "GHS"),
    targetCurrency: Joi.string().required().valid("NGN_X", "XAF", "USD", "KES", "GHS"),
    amount: Joi.number().required()
})

const swapFunds = Joi.object({
    quoteReference: Joi.string().required()
})

export default {
    swapQuote,
    swapFunds
}
import Joi from 'joi'

export const createMonthBudget = Joi.object({
    budgetAmount: Joi.number().required(),
    budgetMonth: Joi.string().required(),
    budgetYear: Joi.string().required(),
    budgetName: Joi.string().required(),
    budgetItems: Joi.array(),
})

export default { 
    createMonthBudget
}
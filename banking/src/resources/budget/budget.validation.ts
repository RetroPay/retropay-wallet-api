import joi from 'joi'

export const createMonthBudget = joi.object({
    budgetAmount: joi.number().required(),
    budgetMonth: joi.string().required(),
    budgetYear: joi.string().required(),
    budgetName: joi.string().required(),
    budgetItems: joi.array(),
})


export const createGoalBudget = joi.object({
    budgetAmount: joi.number().required(),
    budgetName: joi.string().required()
})

export const addFundsToBudget = joi.object({
    amount: joi.number().required(),
    budgetUniqueId: joi.string().required(),
    budgetItemId: joi.string()
})

export default { 
    createMonthBudget,
    createGoalBudget,
    addFundsToBudget
}
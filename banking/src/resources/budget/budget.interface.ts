interface IBudget {
    budgetName: string
    budgetOwnerId: string
    budgetTheme?: string
    budgetEmoji?: string
    budgetItems: {
        _id: string
        budgetItemAmount: number
        budgetItemAmountSpent: number
        budgetItemName: string
    }[]
    totalBudgetAmount: number
    budgetAmountSpent: number
    currency: string
    startDate: string
    endDate: string
    createdAt: string
    budgetUniqueId: string
    id: string
    budgetType: string
    budgetBalance: number
}

export default IBudget
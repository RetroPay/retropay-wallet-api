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
        isExceeded: boolean
        topUpHistory: {
            date: string
            topUpAmount: number
        }[]
    }[]
    totalBudgetAmount: number
    budgetAmountSpent: number
    currency: string
    startDate: string
    endDate: string
    createdAt: string
    budgetUniqueId: string
    initialBudgetAmount: number
    id: string
    budgetType: string
    budgetBalance: number,
    isExceeded: boolean
}

export default IBudget
interface IBudget {
    budgetName: string
    budgetOwnerId: string
    budgetTheme?: string
    budgetEmoji?: string
    budgetItems?: {
        budgetItemAmount: number
        budgetItemAmountRemaining: number
        budgetItemName: string
    }[]
    totalBudgetAmount: number
    budgetAmountRemaining: number
    currency: string
    budgetMonth?: string
    budgetYear?: string
    createdAt: string
    budgetUniqueId: string
    id: string
}

export default IBudget
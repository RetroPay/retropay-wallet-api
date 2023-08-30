interface ISwap {
    reference: string
    source: {
        currency: string
        amount: number
        human_readable_amount: number
    }
    target: {
        currency: string
        amount: number
        human_readable_amount: number
    }
    isInitiated: boolean
    userId: string
}

export default ISwap;
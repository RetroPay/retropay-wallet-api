export default interface IBill {
    referenceId: string,
    amount: string
    billItemIdentifier: string
	phoneNumber: string
	customerIdentifier: string
    transactionReference: string
    fundOriginatorAccount: string
    narrations: string
    instrumentNumber: string
    status: string
    billCategory: string
    createdAt: string
}
export default interface IBill {
    referenceId: string,
    amount: string
    billItemIdentifier: string
	phoneNumber: string
	customerIdentifier: string
    transactionReference: string
}
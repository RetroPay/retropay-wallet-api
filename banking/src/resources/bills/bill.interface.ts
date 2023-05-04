export default interface IBill {
    trackingReference: string,
    amount: string
    billItemIdentifier: string
	phoneNumber: string
	customerIdentifier: string
    transactionReference: string
}
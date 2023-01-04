export default interface IWallet {
    transactionType: string
    accessCode?: string
    operationType: string
    fundRecipientAccount?: string
    fundOriginatorAccount?: string
    status: string
    processingFees?: number
    amount: number,
    referenceId: string
    authorization?: object
    comment?: string
    recepientTag?: string
    senderTag?: string
    currency?: string
    responseCode?: string
    beneficiaryBankCode?: string
    beneficiaryBank?: string
    beneficiaryName?: string
    nameEnquiryId?: string
    beneficiaryAccount?: string
    createdAt?: string
}
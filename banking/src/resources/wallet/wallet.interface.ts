export default interface IWallet {
    transactionType: string
    operationType: string
    fundRecipientAccount?: string
    fundOriginatorAccount?: string
    status: string
    processingFees?: number
    amount: number,
    referenceId: string
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
    senderPicture?: string
    recipientProfile?: string
}
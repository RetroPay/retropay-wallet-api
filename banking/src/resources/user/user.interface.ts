import { Date, Document } from "mongoose";

export default interface IUser {
    _id: any;
    firstname: string
    lastname: string
    middlename?: string
    password: string
    referenceId: string
    email: string
    dateOfBirth: string
    profilePhoto?: {
        url: string
    }
    phoneNumber: string
    bankAccounts?: object
    pin?: number
    username?: string
    isPhoneVerified?: boolean
    isEmailVerified?: boolean
    phoneVerification?: object
    emailVerification: object
    isIdentityVerified?: boolean
    identityVerificationStatus: object
    transferPermission?: boolean
    withdrawPermission?: boolean
    fundPermission?: boolean
    passwordReset?: object,
    customerCode? : string,
    nubanAccountDetails?: {
        nuban: string
    }
    favoritedRecipients?: string[]
    isAccountActive: boolean
    oneSignalDeviceId: string
    verificationInformation: {
        country: string
        documentType: string
        documentNumber: string
        documentFrontPicture: string
        documentBackPicture: string
        address: string
    }
    currencyAccounts: 
        {
            bankName: string
            accountNumber: string
            accountName: string
            currency:  string
            isActive: Boolean
            status: string
            address: string,
            bankShortCode: string,
            bankSwiftCode: string,
            checkNumber: string,
            iBan: string,
            reference: string,
            sortCode: string,
            creationDate: Date,
            referenceId: string,
            reason: string
        }[]
    
    isValidPassword(password: string): Promise<Error | boolean>
    isValidPin(pin: string): Promise<Error | boolean>
}
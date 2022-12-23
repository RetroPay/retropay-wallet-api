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
    profilePhoto?: object
    phoneNumber?: string
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
    nubanAccountDetails?: object
    favoritedRecipients?: string[]

    isValidPassword(password: string): Promise<Error | boolean>
    isValidPin(pin: string): Promise<Error | boolean>
}
import IUser from "./user.interface"
import userModel from "./user.model"
import translateError from "@/helpers/mongod.helper"
import bcrypt from "bcrypt"
import { createToken } from "@/utils/token"
import generateOtp from "@/services/otp"
import moment from "moment"
import ICloudinaryResponse from "@/utils/interfaces/cloudinaryResponse.interface"
import MailService from "@/services/sendEmails";
// const Paystack = require("paystack-api")(process.env.GATEWAY_SECRET_KEY)
const Flutterwave = require('flutterwave-node-v3');
const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY)
// import MessageBroker from "@/utils/broker"
// import app from '../../server'
import App from "../../app"
import amqplib from 'amqplib'
import MessageBroker from '@/utils/broker'

class UserService {
    public async handleSubscribedEvents(payload: any): Promise<void> {
        payload = JSON.parse(payload)
        const { data, event } = payload

        switch (event) {
            case 'USER_INITIALISE_FUND_WALLET': console.log("User just initialised wallet funding")
                break;
        
            default:
                break;
        }
    }

    public async register(reqData: IUser): Promise<any | Error> {
        try {
            const { firstname, lastname, email, password } = reqData
            const newUser: IUser = await userModel.create({
                firstname,
                lastname, 
                email, 
                password,
                username: email,
            })

            const { 
                username, isPhoneVerified, isEmailVerified, 
                isIdentityVerified, transferPermission, withdrawPermission, 
                fundPermission, favoritedRecipients, _id
            } = newUser

            return { token: createToken(newUser), user: {
                firstname, lastname, email,
                username, isPhoneVerified, isEmailVerified,
                isIdentityVerified, transferPermission, withdrawPermission, 
                fundPermission, favoritedRecipients, _id
            } }

        } catch (error: any) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to sign up')
        }
    }

    public async login(reqData: {emailOrUsername: string, password: string }): Promise<string | Error> {
        try {
            const foundUser = await userModel.findOne({ $or: [{email: reqData.emailOrUsername }, {username: reqData.emailOrUsername }] }).select("_id username password")

            if(!foundUser) throw new Error(`${process.env.NODE_ENV == 'development' ? 'Email does not exists' : 'Incorrect userame or password'}`);

            if (await foundUser.isValidPassword(reqData.password)) return createToken(foundUser)
            
            throw new Error("Incorrect username or pasword")
        } catch (error: any) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to login')
        }
    }

    public async changePassword(reqData: { oldPassword: string, newPassword: string }, user: string): Promise<IUser | Error> {
        try {
            const foundUser: any = await userModel.findOne({_id: user})

            if(!foundUser) throw new Error("Unable to update password")

            if(!await foundUser.isValidPassword(reqData.oldPassword)) throw new Error("Incorrect password.")
            
            const updatedUser = await userModel.findOneAndUpdate({ _id: user }, {password: await bcrypt.hash(reqData.newPassword, 10) }, { new: true})
                
            if(updatedUser) {
               return updatedUser 
            } else {
                throw new Error("Unable to update password")
            }
        } catch (error: any) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to updated password.')
        }
    }

    public async setTransactionPin(userId: string, pin: string, confirmPin: string): Promise<IUser | null> {
        try {
            if(pin !== confirmPin) throw new Error("Pin does not match.")
            const updatedUser = await userModel.findByIdAndUpdate(userId, { pin: await bcrypt.hash(pin, 10)}, { new: true})
            if(!updatedUser) throw new Error("Unable to set transaction pin.")

            return updatedUser
        } catch (error) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to set transaction pin.')
        }
    }

    public async forgotPassword(reqData: { email: string }): Promise<object | null> {
        try {
            const foundUser: any = await userModel.findOne({email: reqData.email})
            if(foundUser) {
                const passwordReset = {
                    token: generateOtp(5),
                    expires: moment(new Date).add(5, 'm').toDate(),
                }
                console.log(passwordReset)

                const updatedUser = await userModel.findOneAndUpdate({email: foundUser.email}, { $push: { passwordReset }}, { new: true })
                
                if(!updatedUser) throw new Error("Unable to send reset password mail")

                return  { otp: passwordReset.token, firstname: updatedUser.firstname }
            } else {
                throw new Error("Unable to send reset password mail")
            }
        } catch (error) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to send reset password mail.')
        }
    }

    public async resetPassword(reqData: {email: string, newPassword: string, token: string}): Promise<IUser | null> {
        try {
            const foundUser: IUser | any = await userModel.findOne({ email: reqData.email }).select("passwordReset")
            if(!foundUser) throw new Error("Unable to update password.")
    
            const { passwordReset } = foundUser
            const latestReset = passwordReset[passwordReset.length - 1];
    
            if((Date.now() > new Date(latestReset.expires).getTime()) || latestReset.token != reqData.token) {
                throw new Error("Invalid or expired token.")
            }
    
            const updatedUser = await userModel.findOneAndUpdate({ email: reqData.email }, 
                { password: await bcrypt.hash(reqData.newPassword, 10)}, {new: true}
            )
            
            return updatedUser
        } catch (error) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to update password.')
        }
    }

    public async generateEmailToken(email: string): Promise<object | null> {
        try {
            const emailVerification = {
                token: generateOtp(5),
                expires: moment(new Date).add(5, 'm').toDate(),
            }
    
            const updatedUser: any = await userModel.findOneAndUpdate({email}, { emailVerification }, { new: true })
            if(!updatedUser) throw new Error("Unable to send verification mail.")
    
            return  { otp: emailVerification.token, firstname: updatedUser.firstname }
        } catch (error: any) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to send verification mail.')
        }
    }

    public async getUserByEmail(reqData: { email: string }): Promise<IUser | null> {
        try {
           const foundUser: IUser | null = await userModel.findOne({email: reqData.email})
            return foundUser
        } catch (error) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to updated password.')
        }
    }

    public async verifyEmail(userId: string, token: string): Promise<IUser | null> {
        try {
            const foundUser: any = await userModel.findById(userId)
            console.log(foundUser, "found user")
            if(!foundUser) throw new Error("Unable to verify email.")
            if(foundUser.isEmailVerified == true) throw new Error("Email already verified")

            const { emailVerification } = foundUser
            if((Date.now() > new Date(emailVerification.expires).getTime()) || emailVerification.token != token) {
                throw new Error("Invalid or expired token.")
            }

            const updatedUser = await userModel.findByIdAndUpdate(userId, { $set: 
                { isEmailVerified: true }
            }, { new: true })     
            console.log(updatedUser, "updated")
            return updatedUser
        } catch (error) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to verify email.')
        }
    }

    public async generatePhoneToken(userId: string, phoneNumber: string): Promise<object | null> {
        try {
            const foundUser = await userModel.findById(userId).select("firstname lastname email isPhoneVerified")
            if(!foundUser) throw new Error("Unable to send verification sms.")
            if(foundUser.isPhoneVerified == true) throw new Error("Phone number already verified")

            const payload = {
                "length": 5,
                "customer": { 
                    "name": foundUser.firstname + ' ' + foundUser.lastname, 
                    "email": foundUser.email, 
                    "phone": phoneNumber
                },
                "sender": "RetroPay Wallet",
                "send": true,
                "medium": [
                    "email",
                    // "sms"
                ],
                "expiry": 5
            }
            const response = await flw.Otp.create(payload)

            if(!response) throw new Error("Unable to send verification sms.")

            console.log(response)
            const phoneVerification = {
                token: response.data[0].otp,
                expires: moment(new Date).add(5, 'm').toDate(),
            }

            const updatedUser: IUser | null = await userModel.findByIdAndUpdate(userId, { phoneVerification, phoneNumber }, { new: true })
            console.log(updatedUser)
            if(!updatedUser) throw new Error("Unable to send verification sms.")
    
            return { otp: phoneVerification.token, firstname: updatedUser.firstname, phoneNumber }
        } catch (error: any) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to send verification sms.')
        }
    }

    public async verifyPhoneNumber(userId: string, token: string): Promise<IUser | null> {
        try {
            const foundUser: any = await userModel.findById(userId).select("phoneVerification email firstname lastname phoneNumber isPhoneVerified")
            console.log(foundUser)
            if(!foundUser) throw new Error("Unable to verify phone nummber.")

            if(foundUser.isPhoneVerified == true) throw new Error("Phone number already verified")

            const { phoneVerification } = foundUser
            if((Date.now() > new Date(phoneVerification.expires).getTime()) || phoneVerification.token != token) {
                throw new Error("Invalid or expired token.")
            }
            // const createdCustomer = await Paystack.customer.create({
            //     email: email,
            //     first_name: firstname,
            //     last_name: lastname,
            //     phone: '+' + phoneNumber,
            // })
            // console.log(createdCustomer)
            const updatedUser = await userModel.findByIdAndUpdate(userId, {$set: {
                    isPhoneVerified: true,
                // customerCode: createdCustomer.data.customer_code 
                }
            }, { new: true })
            return updatedUser
        } catch (error) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to verify phone number.')
        }
    }

    public async chackTagAvailability(username: string): Promise<boolean> {
        try {
            const foundUser = await userModel.findOne({ username }).select("username")
            //If there is no existing user found with that username, that means it's available
            if(!foundUser) {
                return true
            } else {
                return false
            }
        } catch(error) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable verify available username.')
        }
    }

    public async setUsername(username: string, id: string): Promise<IUser | null> {
        try {
            //Still check if username already exists
            if(await userModel.findOne({username})) throw new Error('Username already exists')

            const updatedUser = await userModel.findByIdAndUpdate(id, { username }, { new: true }).select("username");
            if (!updatedUser) throw new Error('Unable to update username') 
              
              return updatedUser
        } catch (error: any) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || "Unable to update username")
        }
    }

    public async setPhotoUrl(id: string, uploadResponse: ICloudinaryResponse): Promise<IUser | null> {
        try {

            const updatedUser = await userModel.findOneAndUpdate({ id },
                { profilePhoto: { url: uploadResponse.secure_url, publicIid: uploadResponse.public_id } },
                { new: true }
            )

            if (!updatedUser) throw new Error('Unable to upload profile photo.')

            return updatedUser
        } catch (error: any) {
            console.log(translateError(error))
            throw new Error("Unable to upload profile photo.")
        }
    }

    public async resolveUserByAccountTag(username: string): Promise<IUser | null> {
        try {
            const user = await userModel.findOne({ username }).select("firstname lastname profilePhoto.url")
            if(!user) throw new Error("Invalid recipient.")
            return user
        } catch (error: any) {
            console.log(translateError(error))
            throw new Error("Unable to resolve account details.")
        }
    }

    public async addToFavoritedRecipients(userId: string, username: string): Promise<IUser | null> {
        try {
            const foundRecipient = await userModel.findOne({ username })
            if(!foundRecipient) throw new Error("Invalid recipient tag.")
            console.log(foundRecipient)

            const checkId: any = await userModel.findById(userId)
            const { favoritedRecipients } = checkId

            if(favoritedRecipients && favoritedRecipients.includes(foundRecipient.id)) throw new Error("Recipient already added to favorites.")

            const updatedUser = await userModel.findByIdAndUpdate(userId, {$push: { favoritedRecipients: foundRecipient.id }}, { new: true})
            if(!updatedUser) throw new Error("Unable to add to favourites.")

            //return ID of favorited recipient
            return foundRecipient.id
        } catch (error: any) {
            throw new Error(translateError(error)[0] || 'Unable to add to favourites.')
        }
    }

    public async deactivateUserAccount(userId: string): Promise<void> {
        try {
            const foundUser = await userModel.findByIdAndUpdate(userId, {$set: {isAccountActive: false}}, { new: true })
            console.log(foundUser)
            if(!foundUser) throw new Error("Unable to delete user account.")
        } catch (error: any) {
            throw new Error(translateError(error)[0] || 'Unable to add to favourites.')
        }
    }

    //user services for identity verification webhook events
    public async updateIdentityVerificationStatus(webhookRes: { customer_id: string, email: string, reason?: string }, status: string): Promise<void> {
        try {
            if(status == 'failed'){
                const updatedUser = await userModel.findOneAndUpdate(
                    { id: webhookRes.customer_id }, 
                    { identityerificationStatus: 
                        { status, reason: webhookRes.reason || "Verification failed. That's all we know for now. Please contact support." }}, 
                    { new: true });
                console.log(updatedUser)
                //Notify User of verification status
                if(updatedUser) {
                    const mailService = MailService.getInstance();
                    mailService.sendMail({
                        to: updatedUser.email,
                        subject: 'RetroPay - Identity Verification Failed.',
                        text: `Hey There, Your identity verification failed. Try again or contact support`,
                        html: `<h3> Hey There, Your identity verification failed. </h3> <br> Try again or contact support if the issue persists. <br><br> Failure Reason: ${ webhookRes.reason || "Verification failed. That's all we know for now."}`,
                    });
                }
            }

            if(status == 'success'){
                const updatedUser = await userModel.findOneAndUpdate(
                    { id: webhookRes.customer_id }, 
                    { identityerificationStatus:  { status, },
                        isIdentityVerified: true,
                        fundPermission: true,
                        withdrawPermission: true,
                        transferPermission: true
                    }, 
                    { new: true }
                );

                console.log(updatedUser)
                //Notify User of verification status
                if(updatedUser) {
                    const mailService = MailService.getInstance();
                    mailService.sendMail({
                        to: updatedUser.email,
                        subject: 'RetroPay - Identity Verification Successful.',
                        text: `Hey There, Your identity verification was successful.`,
                        html: `Hey There, Your identity verification was succesful. Head over to your Retro Pay Wallet and complete your account setup. Welcome aboard Retro Payer!`,
                    });
                }
            }
        } catch (error: any) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || "Unable to verify identity")
        }
    }    
    
    // public async verifyIdentity(reqData: { accountNumber: string, BVN: string, bankCode: string }, id: string): Promise<any> {
    //     try {
    //         const foundUser = await userModel.findById(id).exec()

    //         if(!foundUser) throw new Error("unable to verify user identity.")

    //         const result = await Paystack.customer.validate({
    //             country: "NG",
    //             type: "bank_account",
    //             account_number: reqData.accountNumber,
    //             bvn: reqData.BVN,
    //             bank_code: reqData.bankCode,
    //             first_name: foundUser.firstname,
    //             last_name: foundUser.lastname,
    //             id: foundUser.customerCode,
    //             value: id
    //         })
    //         if(!result) throw new Error("unable to verify user identity.")

    //         return result
            
    //     } catch (error: any) {
    //         console.log(translateError(error.error))
    //         throw new Error(translateError(error.error)[0] || translateError(error)[0] || 'unable to verify user identity.')
    //     }
    // }
}

export default UserService
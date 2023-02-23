import IUser from "./user.interface"
import userModel from "./user.model"
import translateError from "@/helpers/mongod.helper"
import bcrypt from "bcrypt"
import { createToken } from "@/utils/token"
import generateOtp from "@/services/otp"
import moment from "moment"
import ICloudinaryResponse from "@/utils/interfaces/cloudinaryResponse.interface"
const Flutterwave = require('flutterwave-node-v3');
const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY)
import axios from 'axios'
import { v4 } from "uuid"

class UserService {
    public async handleSubscribedEvents(payload: any): Promise<void> {
        try {
            payload = JSON.parse(payload)
            const { data, event } = payload

            if(!data || !event) throw new Error('==== Invalid Payload ====')

            switch (event) {
                case 'QUEUE_NOTIFICATION': await this.queueNotification(data);
                    break;
                default: console.log("== invalid event == ")
                    break;
            }
        } catch (error) {
            console.log(error)
        }
        
    }

    public async queueNotification(reqData: {id: string, trType: string, amount: number, recipientTag: string, senderTag: string, timestamp: Date, senderBankInfo: string, recipientBankInfo: string}): Promise<void> {
        try {
            const { id, trType, amount, recipientTag, senderBankInfo, senderTag, recipientBankInfo, timestamp } = reqData;
            
            const notification = {
                amount,
                trType,
                recipientTag,
                senderTag,
                senderBankInfo,
                recipientBankInfo,
                timestamp,
            }

            const updated = await userModel.findByIdAndUpdate(id, { 
                $push: { 
                    notifications: notification
                }
            }, { new: true })
            console.log(updated)

        } catch (error: any) {
            console.error(error)
        }
    }

    public async getUser(id: string): Promise<IUser | Error> {
        try {
            const user = await userModel.findById(id, {'_id': 0, 'firstname': 1}).select('firstname lastname profilePhoto email username phoneNumber isIdentityVerified verificationStatus transferPermission nubanAccountDetails isEmailVerified isPhoneVerified')
            
            if(!user) throw new Error("Unable to retrieve details")

            return user
        } catch (error) {
            console.log(translateError(error))
            throw new Error('Unable to retrieve user details.')
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

            if(!newUser) throw new Error('Unable to create user account.')

            const { 
                username, isPhoneVerified, isEmailVerified, 
                isIdentityVerified, transferPermission, withdrawPermission, 
                fundPermission, _id
            } = newUser

            return { token: createToken(newUser), user: {
                firstname, lastname, email,
                username, isPhoneVerified, isEmailVerified,
                isIdentityVerified, transferPermission, withdrawPermission, 
                fundPermission, _id
            } }

        } catch (error: any) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to sign up')
        }
    }

    public async login(reqData: {emailOrUsername: string, password: string }): Promise<any | Error> {
        try {
            const foundUser = await userModel.findOne({ $or: [{email: reqData.emailOrUsername }, {username: reqData.emailOrUsername }] })

            if(!foundUser) throw new Error('Incorrect username or password');
            if(foundUser.isAccountActive == false) throw new Error("Account is disabled. Contact support")

            const { 
                username, isPhoneVerified, isEmailVerified, 
                isIdentityVerified, transferPermission, withdrawPermission, 
                fundPermission, favoritedRecipients, _id,
                firstname, lastname, email, profilePhoto,
                verificationStatus, nubanAccountDetails
            } = foundUser

            if (await foundUser.isValidPassword(reqData.password)) { 
                return { 
                    token: createToken(foundUser), 
                    // user: {
                    //     firstname, lastname, email,
                    //     username, isPhoneVerified, isEmailVerified,
                    //     isIdentityVerified, transferPermission, withdrawPermission, 
                    //     fundPermission, profilePhoto, nubanAccountDetails,
                    //     verificationStatus
                    // } 
                }
            }
            
            throw new Error("Incorrect username or password.")
        } catch (error: any) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to sign you in, Please try again.')
        }
    }

    public async changePassword(reqData: { oldPassword: string, newPassword: string }, user: string): Promise<IUser | Error> {
        try {
            const foundUser: any = await userModel.findOne({_id: user})

            if(!foundUser) throw new Error("Unable to update password")

            if(!await foundUser.isValidPassword(reqData.oldPassword)) throw new Error("Incorrect password.")
            
            const updatedUser = await userModel.findOneAndUpdate({ _id: user }, {password: await bcrypt.hash(reqData.newPassword, 10) }, { new: true})

            if(!updatedUser) throw new Error("Unable to update password") 
            
            return updatedUser 
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

    public async changePin(userId: string, oldPin: string, newPin: string, confirmPin: string): Promise<IUser> {
        try{
            if(newPin !== confirmPin) throw new Error("Pin does not match.")

            if(!await this.validatePin(oldPin, userId)) throw new Error('Incorrect transaction pin.')

            const updatedUser = await userModel.findByIdAndUpdate(userId, { pin: await bcrypt.hash(newPin, 10)}, {new: true})
            if(!updatedUser) throw new Error('Unable to change transaction pin.')

            return updatedUser
        } catch(error: any){
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to set transaction pin.')
        }
    }

    public async forgotPin(userId: string, password: string, newPin: string, confirmPin: string): Promise<IUser> {
        try{
            if(newPin !== confirmPin) throw new Error("Pin does not match.")

            const foundUser = await userModel.findById(userId)

            if(!foundUser) throw new Error("Unable to change transaction pin.")

            if(!await foundUser.isValidPassword(password)) throw new Error('Incorrect password.')

            const updatedUser = await userModel.findByIdAndUpdate(userId, { pin: await bcrypt.hash(newPin, 10)}, {new: true})
            
            if(!updatedUser) throw new Error('Unable to change transaction pin.')

            return updatedUser
        } catch(error: any){
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to change transaction pin.')
        }
    }

    public async authenticateWithPin(userId: string, pin: string): Promise<IUser | any> {
        try {
            const foundUser = await userModel.findById(userId)
            if(!foundUser) throw new Error('Unable to validate your pin')

            if(!await foundUser.isValidPin(pin)) throw new Error('Incorrect transaction pin.')

            return createToken(foundUser)
        } catch (error) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Request failed, Try signing in.')
        }
    }

    private async validatePin(formPin: string, userId: string):Promise<boolean> {
        try {
          const foundUser = await userModel.findById(userId)

          if(!foundUser) throw new Error("Error validating your pin")

          if(!foundUser.pin) throw new Error("Create a transaction pin to continue")
          
          if (await foundUser.isValidPin(formPin)) {
            return true;
          }
          return false;
          
        } catch (error) {
          console.log(error)
          throw new Error('Unable to validate pin.')
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
                "sender": "Retro Wallet by Retrostack",
                "send": true,
                "medium": [
                    "email",
                    // "sms"
                ],
                "expiry": 5
            }
            const response = await flw.Otp.create(payload)

            if(response.status == 'error') throw new Error("Unable to send verification sms.")

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

            const updatedUser = await userModel.findByIdAndUpdate(userId, {$set: {
                    isPhoneVerified: true,
                }
            }, { new: true })
            return updatedUser
        } catch (error) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to verify phone number.')
        }
    }

    public async createNubanAccount(userId: string, k_token: string): Promise<IUser | null> {
        try {
            const foundUser = await userModel.findById(userId).select("email firstname lastname phoneNumber middlename nubanAccountDetails")
            if(!foundUser) throw new Error("Unable to create nuban.")

            if(foundUser.nubanAccountDetails) throw new Error("Nuban has already been created")
            const { email, firstname, lastname, middlename, phoneNumber, id } = foundUser
            
            /* Phone numbers are stored with their respective country codes e.g +234, 
            the following line of code removes the country code which is the first 4 characters */
            const formatPhoneNumber = '0' + phoneNumber?.substring(4)
            console.log(formatPhoneNumber)

            const response = await axios({
                method: 'POST',
                url: 'http://kuda-openapi-uat.kudabank.com/v2.1',
                data: {
                    ServiceType :"ADMIN_CREATE_VIRTUAL_ACCOUNT",
                    RequestRef: v4(),
                    data: {
                        email,
                        phoneNumber: formatPhoneNumber,
                        lastName: lastname,
                        firstName: firstname,
                        middleName: middlename || '',
                        trackingReference: id
                    }
                },
                headers: {
                    Authorization: `Bearer ${k_token}`
                }
              })

            const data = response.data
            
            //if axios call is successful but kuda status returns failed e'g 400 errors
            if(!data.status) throw new Error(data.message)

            await userModel.findByIdAndUpdate(userId, {
                nubanAccountDetails: { nuban: data.data.accountNumber },
                $set: { transferPermission: true }
            })

            return data.data
        } catch (error) {
            throw new Error(translateError(error)[0] || 'Unable to create nuban.')
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
            if(await userModel.findOne({username})) throw new Error('Username already exists')

            const updatedUser = await userModel.findByIdAndUpdate(id, { username }, { new: true }).select("username");
            if (!updatedUser) throw new Error('Unable to update username') 
              
            return updatedUser
        } catch (error: any) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || "Unable to update username")
        }
    }

    public async setPhotoUrl(id: string, uploadResponse: ICloudinaryResponse): Promise<IUser | any> {
        try {

            const updatedUser = await userModel.findByIdAndUpdate(id,
                { $set: {profilePhoto: { url: uploadResponse.secure_url, publicIid: uploadResponse.public_id }}},
                { new: true }
            )
            console.log(updatedUser)

            if (!updatedUser) throw new Error('Unable to upload profile photo.')

            return updatedUser?.profilePhoto
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

    public async removeFavoritedRecicpient(userId: string, username: string): Promise<IUser | null> {
        try {
            const foundRecipient = await userModel.findOne({ username })
            if(!foundRecipient) throw new Error("Invalid recipient tag.")
            console.log(foundRecipient)

            const updatedUser = await userModel.findByIdAndUpdate(userId, {$pull: {favoritedRecipients: foundRecipient.id }}, { new: true })

            console.log(updatedUser)
            return foundRecipient.id
        } catch (error: any) {
            throw new Error(translateError(error)[0] || 'Unable to unfavourite this recipient.')
        }
    }

    public async retrieveFavorites(userId: string): Promise<IUser[]> {
        try {
            const foundUser = await userModel.findById(userId).select("favoritedRecipients")

            if(!foundUser) throw new Error("Unable to retrieve favorites")

            const favorites = await userModel.find({_id: {$in: foundUser.favoritedRecipients }}, { _id: 0, firstname: 1 }).select("firstname lastname isIdentityVerified profilePhoto.url username")
            return favorites
        } catch (error) {
            throw new Error(translateError(error)[0] || 'Unable to retrieve favorites.')
        }
    }

    public async getNotifications(userId: string): Promise<IUser | null> {
        try {
            const notifications: any = await userModel.findById(userId).select('notifications')
            return notifications.notifications.reverse();
        } catch (error) {
            throw new Error('Unable to retrieve notifications.')
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

    public async getUserVerificationStatus(userId: string): Promise<any> {
        try {
            const userStatus = await userModel.findById(userId, {_id: 0, verificationStatus: 1, isIdentityVerified: 1})
            console.log(userStatus)
            if(!userStatus) throw new Error("Unable to retrieve verification status.")
            return userStatus
        } catch (error: any) {
            throw new Error(translateError(error)[0] || 'Unable to retrieve verification status.')
        }
    }

   //user services for identity verification webhook events
   public async startUserVerification(accountTag: string): Promise<void> {
    try {
        await userModel.findOneAndUpdate({username: accountTag}, { verificationStatus: 'pending' })
    } catch (error) {
        console.log(error)
        //LogSnag call here
    }
   }

   public async updateUserVerification(accountTag: string, status: string): Promise<void> {
    try {
        switch(status) {
            case 'rejected': 
            case 'reviewNeeded': await userModel.findOneAndUpdate({username: accountTag}, {verificationStatus: status == "reviewNeeded" ? "in review" : status})
                break;
            case 'verified': await userModel.findOneAndUpdate({username: accountTag}, {verificationStatus: status, $set: { isIdentityVerified: true }})
                break;
        }
    } catch (error: any) {
        console.log(error)
        //LogSnag call here
    }
   }
}

export default UserService
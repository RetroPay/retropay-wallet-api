import IUser from "./user.interface"
import userModel from "./user.model"
import translateError from "@/helpers/mongod.helper"
import bcrypt from "bcrypt"
import { createToken } from "@/utils/token"
import generateOtp from "@/services/otp"
import moment from "moment"
import ICloudinaryResponse from "@/utils/interfaces/cloudinaryResponse.interface"
import MailService from "@/services/sendEmails";
const Paystack = require("paystack-api")(process.env.GATEWAY_SECRET_KEY)
const Flutterwave = require('flutterwave-node-v3');
const flw = new Flutterwave(process.env.FLW_PUBLIC_KEY, process.env.FLW_SECRET_KEY)
import MessageBroker from "@/utils/broker"

class UserService {

    public async handleSubscribedEvents(payload: any): Promise<void> {
        payload = JSON.parse(payload)
        const { data, event } = payload

        switch (event) {
            case 'NEW_USER_CREATED': await this.register(data)
                break;
            case 'USERNAME_UPDATED': await this.setUsername(data)
                break;
            case 'USER_CREATE_PIN': await this.setTransactionPin(data)
                break;
            case 'DEACTIVATE_USER_ACOUNT': await this.deactivateUserAccount(data)
                break;
            case 'ADD_FAVORITE_RECIPIENT': await this.addToFavoritedRecipients(data)
                break;
            case 'USER_NUBAN_CREATED': await this.updateNubanDetails(data)
                break;
            case 'DELETE_FAVORITE_RECIPIENT': await this.deleteFavoritedRecipient(data)
                break;
            default: throw new Error("=== Invalid event ===")
                break;
        }
    }
    
    public async register(reqData: IUser): Promise<void> {
        try {
            const { firstname, lastname, email, username, _id } = reqData

            await userModel.create({
                firstname, 
                lastname, 
                email,
                username,
                referenceId: _id
            })
            console.log("== new user logged ==")
        } catch (error: any) {
            console.log("== error logging new user ==")
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to sign up')
        }
    }

    public async setTransactionPin(reqData: { id: string, pin: string }): Promise<void> {
        try {
            const { id, pin } = reqData

            const updated = await userModel.findOneAndUpdate({referenceId: id}, { pin }, { new: true})
            console.log(updated)
        } catch (error) {
            console.log(translateError(error))
            throw new Error(translateError(error)[0] || 'Unable to set transaction pin.')
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

    public async setUsername(reqData: IUser): Promise<void | Error> {
        try {
            const { _id, username } = reqData 
            const updatedUser = await userModel.findOneAndUpdate({referenceId: _id}, { username }, { new: true }).select("username")
            if(updatedUser) console.log("== username updated ==")
        } catch (error: any) {
            console.log(translateError(error))
            throw new Error("Unable to update username")
        }
    }

    public async addToFavoritedRecipients(reqData: { id: string, recipientId: string }): Promise<void> {
        try {
            const updatedUser = await userModel.findOneAndUpdate({referenceId: reqData.id}, {$push: {favoritedRecipients: reqData.recipientId}})
            if(!updatedUser) throw new Error("Unable to add to favourites.")
        } catch (error: any) {
            throw new Error(translateError(error)[0] || 'Unable to add to favourites.')
        }
    }

    public async deactivateUserAccount(reqData: { id: string }): Promise<void> {
        try {
            const { id } = reqData
            const foundUser = await userModel.findOneAndUpdate({ referenceId: id }, {$set: {isAccountActive: false}}, { new: true })
            console.log(foundUser)
            if(!foundUser) throw new Error("Unable to delete user account.")
        } catch (error: any) {
            throw new Error(translateError(error)[0] || 'Unable to add to favourites.')
        }
    }
    public async updateNubanDetails(reqData: {id: string, accountNumber: string}): Promise<void> {
        try {
            const { id, accountNumber } = reqData
            const updateUser = await userModel.findOneAndUpdate({ referenceId: id }, {nubanAccountDetails: { nuban: accountNumber }},{ new: true })
            console.log(updateUser)
            if(!updateUser) throw new Error("Unable to delete user account.")
        } catch (error) {
            throw new Error(translateError(error)[0] || 'Unable to add update nuban details.')
        }
    }

    public async deleteFavoritedRecipient(reqData: {id: string, recipientId: string}): Promise<void> {
        try {
            const { id, recipientId } = reqData

            const updatedUser = await userModel.findOneAndUpdate({ referenceId: id }, { $pull: {favoritedRecipients: recipientId } }, { new: true })
            console.log(updatedUser)
            if(!updatedUser) throw new Error("Unable to delete recipient.")
        } catch (error) {
            throw new Error(translateError(error)[0] || 'Unable to delete recipient.')
        }
    }
}

export default UserService
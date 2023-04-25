import IUser from "./user.interface"
import userModel from "./user.model"
import translateError from "@/helpers/mongod.helper"
import { Console } from "console"

class UserService {
    
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
        } catch (error: any) {
            throw new Error(translateError(error)[0] || 'Unable to sign up')
        }
    }

    public async setTransactionPin(reqData: { id: string, pin: string }): Promise<void> {
        try {
            const { id, pin } = reqData

            const updated = await userModel.findOneAndUpdate({referenceId: id}, { pin }, { new: true})
          
        } catch (error) {
            throw new Error(translateError(error)[0] || 'Unable to set transaction pin.')
        }
    }

    public async getUserByEmail(reqData: { email: string }): Promise<IUser | null> {
        try {
           const foundUser: IUser | null = await userModel.findOne({email: reqData.email})
            return foundUser
        } catch (error) {
            throw new Error(translateError(error)[0] || 'Unable to updated password.')
        }
    }

    public async setUsername(reqData: IUser): Promise<void | Error> {
        try {
            const { _id, username } = reqData 
            const updatedUser = await userModel.findOneAndUpdate({referenceId: _id}, { username }, { new: true }).select("username")
        } catch (error: any) {
            throw new Error("Unable to update username")
        }
    }

    public async addToFavoritedRecipients(reqData: { id: string, recipientId: string }): Promise<void> {
        try {
            const updatedUser = await userModel.findOneAndUpdate({referenceId: reqData.id}, {$push: {favoritedRecipients: reqData.recipientId}})
            if(!updatedUser) throw new Error("Unable to add to favorites.")
        } catch (error: any) {
            throw new Error(translateError(error)[0] || 'Unable to add to favorites.')
        }
    }

    public async deactivateUserAccount(reqData: { id: string }): Promise<void> {
        try {
            const { id } = reqData
            const foundUser = await userModel.findOneAndUpdate({ referenceId: id }, {$set: {isAccountActive: false}}, { new: true })
          
            if(!foundUser) throw new Error("Unable to delete user account.")
        } catch (error: any) {
            throw new Error(translateError(error)[0] || 'Unable to add to favorites.')
        }
    }
    public async updateNubanDetails(reqData: {id: string, accountNumber: string}): Promise<void> {
        try {
            const { id, accountNumber } = reqData
            const updateUser = await userModel.findOneAndUpdate({ referenceId: id }, 
                {nubanAccountDetails: { nuban: accountNumber }, 
                $set: { transferPermission: true }},
                { new: true }
            )
            if(!updateUser) throw new Error("'Unable to update nuban details.")
        } catch (error) {
            throw new Error(translateError(error)[0] || 'Unable to update nuban details.')
        }
    }

    public async deleteFavoritedRecipient(reqData: {id: string, recipientId: string}): Promise<void> {
        try {
            const { id, recipientId } = reqData

            const updatedUser = await userModel.findOneAndUpdate({ referenceId: id }, { $pull: {favoritedRecipients: recipientId } }, { new: true })
       
            if(!updatedUser) throw new Error("Unable to delete recipient.")
        } catch (error) {
            throw new Error(translateError(error)[0] || 'Unable to delete recipient.')
        }
    }

    public async setProfilePhoto(reqData: {id: string, profilePhoto: string}): Promise<void> {
        try {
            const { id, profilePhoto } = reqData
            const updatedUser = await userModel.findOneAndUpdate({referenceId: id}, { profilePhoto }, { new: true })

          
            if(!updatedUser) throw new Error("Unable to upload profile photo.")
        } catch (error: any) {
            throw new Error(translateError(error)[0] || 'Unable to upload profile photo.')
        }
    }

    public async updateUserVerification(reqData: {username: string, status: string}): Promise<void> {
        try {
            const { status, username } = reqData

            switch(status) {
                case 'rejected': 
                case 'reviewNeeded': await userModel.findOneAndUpdate({username}, {verificationStatus: status == "reviewNeeded" ? "in review" : status})
                    break;
                case 'verified': await userModel.findOneAndUpdate({username}, {verificationStatus: "verified", $set: { isIdentityVerified: true, withdrawPermission: true }})
                    break;
            }
        } catch (error: any) {
            throw new Error(translateError(error)[0] || 'Unable to update identity status.')
            //LogSnag call here
        }
       }
}

export default UserService
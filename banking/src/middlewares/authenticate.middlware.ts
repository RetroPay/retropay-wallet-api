import { Request, Response, NextFunction } from 'express'
import token from '@/utils/token'
import UserModel from '@/resources/user/user.model'
import Token from '@/utils/interfaces/token.interface'
import HttpException from '@/utils/exceptions/http.exception'
import jwt from 'jsonwebtoken'
import axios from 'axios'

async function authenticatedMiddleware(
    req: Request | any,
    res: Response,
    next: NextFunction
): Promise<Response | void> {
    const bearer = req.headers.authorization

    if (!bearer || !bearer.startsWith('Bearer ')) {
        return next(new HttpException(401, 'Unauthorized'))
    }

    const accessToken = bearer.split('Bearer ')[1].trim()
    try {
        const payload: Token | jwt.JsonWebTokenError = await token.verifyToken(
            accessToken
        )

        if (payload instanceof jwt.JsonWebTokenError) {
            return next(new HttpException(401, 'Your session has expired. Login again'))
        }


        /**
         * This is a very expensive work around for the unreliability issues faced
         * with the message broker.
         * 
         * Implementation process
         * 
         * decode token
         * call account service to get latest info
         * check banking db based on referenceId
         * if it exists just update record if it doesn't create record immediately
        */

        try {
            const response = await axios({
                method: 'GET',
                url: process.env.NODE_ENV == "production" ? 'https://api.retropay.app/account/user/sync-info' : 'http://localhost:4000/account/user/sync-info',
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            })
            const userData = response.data.data.user

            console.log(userData, "searched user info from accDB")


            const user = await UserModel.findOne({ referenceId: payload.id }).select('username email referenceId nubanAccountDetails').exec()
            console.log(user, "current user from banking db")

            if (user == null || user == undefined || !user) {
                const { firstname, lastname, email, _id, pin, username, isIdentityVerified, verificationStatus,
                    transferPermission,
                    withdrawPermission,
                    nubanAccountDetails,
                    favoritedRecipients,
                    isAccountActive,
                    profilePhoto, phoneNumber } = userData

                // update user variable, with saved data record 
                const newUser = await UserModel.create({
                    firstname,
                    lastname,
                    email,
                    referenceId: _id,
                    pin,
                    username,
                    isIdentityVerified,
                    transferPermission,
                    withdrawPermission,
                    nubanAccountDetails,
                    favoritedRecipients,
                    verificationStatus,
                    isAccountActive,
                    profilePhoto: profilePhoto.url,
                    phoneNumber
                })

                console.log(newUser, "new user created on banking db, didn't exit before")

                if (newUser.isAccountActive == false) return next(new HttpException(401, 'Your account is suspended, contact support.'))

                req.user = newUser.id
                req.referenceId = newUser.referenceId
                req.username = newUser.username
                req.email = newUser.email

                return next()
            } else {
                const { 
                    firstname, lastname, 
                    email, pin, username, 
                    isIdentityVerified, 
                    verificationStatus,
                    transferPermission,
                    withdrawPermission,
                    nubanAccountDetails,
                    favoritedRecipients,
                    isAccountActive,
                    profilePhoto, phoneNumber } = userData

                const updatedUser = await UserModel.findOneAndUpdate({ referenceId: payload.id }, {
                    firstname, lastname, 
                    email, pin, username, 
                    isIdentityVerified, 
                    verificationStatus,
                    transferPermission,
                    withdrawPermission,
                    nubanAccountDetails,
                    favoritedRecipients,
                    isAccountActive,
                    profilePhoto: profilePhoto.url, 
                    phoneNumber
                }, { new: true })

                console.log(updatedUser, "user already exists, updates banking db record")

                if (!updatedUser) return next(new HttpException(401, "Unauthorized"))

                if (updatedUser.isAccountActive == false) return next(new HttpException(401, 'Your account is suspended, contact support.'))

                req.user = updatedUser.id
                req.referenceId = updatedUser.referenceId
                req.username = updatedUser.username
                req.email = updatedUser.email

                return next()
            }

        } catch (error) {
            return next(new HttpException(401, "Unauthorized"))
        }
    } catch (error: any) {
        console.log(error)
        return next(new HttpException(401, error.message || error || 'Unauthorized'))
    }
}

export default authenticatedMiddleware
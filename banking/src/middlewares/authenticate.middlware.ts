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

        let user = await UserModel.findOne({ referenceId: payload.id }).select('username email referenceId nubanAccountDetails').exec()
        console.log(user, "user before search/lookup")

        if (!user) {
            try {
                const response = await axios({
                    method: 'GET',
                    url: process.env.NODE_ENV == "production" ? 'https://api.retropay.app/account/user/sync-info' : 'http://localhost:4001/account/user/sync-info',
                    headers: {
                        Authorization: `Bearer ${accessToken}`
                    }
                })

                console.log(response.data, "response from search/lookup")

                const { firstname, lastname, email, _id, pin, username, isIdentityVerified, verificationStatus,
                    transferPermission,
                    withdrawPermission,
                    nubanAccountDetails,
                    favoritedRecipients,
                    isAccountActive,
                    profilePhoto, phoneNumber } = response.data.data.user

                // update user variable, with saved data record 
                user = await UserModel.create({
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

                console.log(user, "updated user after search")

            } catch (error) {
                console.log(error, "user not found after lookup")
                return next(new HttpException(401, "Unauthorized"))
            }
        }

        //if account is suspended or deactivated
        if (user.isAccountActive == false) return next(new HttpException(401, 'Your account is suspended, contact support.'))

        req.user = user.id
        req.referenceId = user.referenceId
        req.username = user.username
        req.email = user.email

        return next()
    } catch (error: any) {
        return next(new HttpException(401, error.message || error || 'Unauthorized'))
    }
}

export default authenticatedMiddleware
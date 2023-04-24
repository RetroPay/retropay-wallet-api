import { Request, Response, NextFunction } from 'express'
import token from '@/utils/token'
import UserModel from '@/resources/user/user.model'
import Token from '@/utils/interfaces/token.interface'
import HttpException from '@/utils/exceptions/http.exception'
import jwt from 'jsonwebtoken'

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

        const user = await UserModel.findById(payload.id).select('username email').exec()

        if (!user) {
            return next(new HttpException(401, 'Unauthorized'))
        }


        //if account is suspended or deactivated
        if(user.isAccountActive == false) return next(new HttpException(401, 'Your account is suspended, contact support.'))

        req.user = user.id
        req.username = user.username
        req.email = user.email

        return next()
    } catch (error: any) {
        return next(new HttpException(401, error.message || error || 'Your session has expired. Login again'))
    }
}

export default authenticatedMiddleware
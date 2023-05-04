import { Request, Response, NextFunction } from 'express'
import { redisClient, logsnag } from '../server'
import axios from 'axios'
import HttpException from '@/utils/exceptions/http.exception'

async function kudaTokenHandler(
    req: Request | any,
    res: Response,
    next: NextFunction
): Promise<Response | void> {
    try {
        let k_token = await redisClient.get("K_TOKEN")

        if(!k_token) {
            const response = await axios({
                method: 'POST',
                url: process.env.NODE_ENV == "production" ? 'https://kuda-openapi.kuda.com/v2/Account/GetToken' : 'http://kuda-openapi-uat.kudabank.com/v2/Account/GetToken',
                data: {
                    email: process.env.KUDA_MAIL,
                    apiKey: process.env.KUDA_PRIVATE_KEY
                }
              })
            
            const accessToken = response.data
            k_token = accessToken
            await redisClient.setEx('K_TOKEN', 720, `${accessToken}`)
        }

        console.log(k_token)
        req.k_token = k_token
        next()
    } catch (error) {
        await logsnag.publish({
            channel: "server",
            event: "Banking Service - Kuda Token fetch failed",
            description: `Service Downtime error: ${error}`,
            icon: "💥"
        })
        return next(new HttpException(500, 'An error occurred. Try again later'))
    }
}

export default kudaTokenHandler
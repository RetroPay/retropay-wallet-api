import { Request, Response, NextFunction } from 'express'
import { redisClient } from '../server'
import axios from 'axios'
import HttpException from '@/utils/exceptions/http.exception'

async function kudaTokenHandler(
    req: Request | any,
    res: Response,
    next: NextFunction
): Promise<Response | void> {
    try {
        await redisClient.connect()
        let k_token = await redisClient.get("K_TOKEN")
        if(!k_token) {
            const response = await axios({
                method: 'POST',
                url: 'http://kuda-openapi-uat.kudabank.com/v2/Account/GetToken',
                data: {
                    email: process.env.KUDA_MAIL,
                    apiKey: process.env.KUDA_PRIVATE_KEY
                }
              })
            
            const accessToken = response.data
            k_token = accessToken
            await redisClient.setEx('K_TOKEN', 720, `${accessToken}`)
        }

        req.k_token = k_token
        await redisClient.disconnect();
        next()
    } catch (error) {
        await redisClient.disconnect();
        return next(new HttpException(500, 'An error occured. Try again later'))
    }
}

export default kudaTokenHandler
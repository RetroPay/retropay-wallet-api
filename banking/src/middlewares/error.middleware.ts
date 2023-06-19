import { Request, Response, NextFunction } from "express"
import HttpException from '@/utils/exceptions/http.exception'

function ErrorMiddleware(
    error: HttpException,
    req: Request,
    res: Response,
    next: NextFunction
):void {
    const statusCode = error.status || 500
    const message = error.message || 'Oops something went wrong.'

    res.status(statusCode).send({
        success: false,
        statusCode,
        errors: message,
    })
}
export default ErrorMiddleware
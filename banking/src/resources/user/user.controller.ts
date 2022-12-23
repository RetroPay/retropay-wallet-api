import { Router, Request, Response, NextFunction } from "express"
import IUser from "@/resources/user/user.interface"
import IController from "@/utils/interfaces/controller.interface";
import validate from "@/resources/user/user.validation"
import UserService  from "@/resources/user/user.service"
import validationMiddleware from "@/middlewares/validation.middleware";
import HttpExeception from "@/utils/exceptions/http.exception";
import MailService from "@/services/sendEmails";
import authenticatedMiddleware from "@/middlewares/authenticate.middlware";
import translateError from "@/helpers/mongod.helper";
import welcomeEmail from "@/templates/welcome.template";
import passwordResetEmail from "@/templates/passwordReset.template";
import verifyEmailTemplate from "@/templates/verifyEmail.template";
// import smsService from "@/services/sms.service";
import cloudinaryUpload from "@/services/cloudinary.service";
import formidable from "formidable"
import channel from "../../server"
import { subscribeMessage, publishMessage} from "@/utils/broker"

class UserController implements IController {
    public path = ''
    public router = Router()
    private UserService = new UserService

    constructor() {
        this.subscribeBroker()
    }
    
    public async subscribeBroker () {
        await subscribeMessage(await channel, `${process.env.BANKING_BINDING_KEY}`, this.UserService)
    }
}

export default UserController
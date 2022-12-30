import { Router, Request, Response, NextFunction } from "express"
import IUser from "@/resources/user/user.interface"
import IController from "@/utils/interfaces/controller.interface";
import validate from "@/resources/user/user.validation"
import UserService  from "@/resources/user/user.service"
import validationMiddleware from "@/middlewares/validation.middleware";
import HttpExeception from "@/utils/exceptions/http.exception";
import MailService from "@/services/sendEmails";
import authenticatedMiddleware from "@/middlewares/authenticate.middlware";
import kudaTokenHandler from "@/middlewares/kudaToken.middleware";
import translateError from "@/helpers/mongod.helper";
import welcomeEmail from "@/templates/welcome.template";
import passwordResetEmail from "@/templates/passwordReset.template";
import verifyEmailTemplate from "@/templates/verifyEmail.template";
// import smsService from "@/services/sms.service";
import cloudinaryUpload from "@/services/cloudinary.service";
import formidable from "formidable"
import { brokerChannel } from "../../server"
import { subscribeMessage, publishMessage} from "@/utils/broker"

class UserController implements IController {
    public path = ''
    public router = Router()
    private UserService = new UserService()

    constructor() {
        this.initialiseRoutes()
        this.subscribeBroker()
    }

    private async subscribeBroker(): Promise<void> {
        await subscribeMessage(await brokerChannel, `${process.env.ACCOUNT_BINDING_KEY}`, this.UserService)
    }

    private initialiseRoutes(): void {
        //Auth routes
        this.router.post('/auth/user/signup', validationMiddleware(validate.register), this.register)
        this.router.post('/auth/user/login', validationMiddleware(validate.login), this.login)
        this.router.post('/auth/user/forgot-password', validationMiddleware(validate.forgotPassword), this.forgotPassword)
        this.router.patch('/auth/user/reset-password', validationMiddleware(validate.resetPassword), this.resetPassword)
        this.router.patch('/auth/user/change-password', authenticatedMiddleware, validationMiddleware(validate.changePassword) ,this.changePassword)

        //Profile routes
        this.router.post('/user/profile/send-email-token', authenticatedMiddleware, this.sendVerifyEmailToken)
        this.router.patch('/user/profile/verify-email', authenticatedMiddleware, validationMiddleware(validate.verifyEmail), this.verifyEmail)
        this.router.post('/user/profile/send-phone-token', authenticatedMiddleware, validationMiddleware(validate.phoneVerification), this.sendVerifyPhoneToken)
        this.router.patch('/user/profile/verify-phone', authenticatedMiddleware, validationMiddleware(validate.verifyPhone), this.verifyPhone)
        this.router.get('/user/profile/account-tag/verify/:username', authenticatedMiddleware, this.verifyAvailableAccountTag)
        this.router.patch('/user/profile/account-tag/setup', authenticatedMiddleware, validationMiddleware(validate.setupUsername), this.setupUsername)
        this.router.put('/user/profile/upload-photo', authenticatedMiddleware, this.uploadProfilePhoto)

        this.router.put('/user/pin/set', authenticatedMiddleware, validationMiddleware(validate.sertPin), this.setPin)
        this.router.get("/user/:username/resolve", authenticatedMiddleware, this.resolveAccountTag)
        this.router.post("/user/profile/favorite-recipients/add", authenticatedMiddleware, validationMiddleware(validate.addFavorites), this.favoriteRecipient)

        this.router.delete("/user/deactivate", authenticatedMiddleware, this.softDeleteUserAccount)

        //NUBAN verification and creation
        // this.router.post('/user/profile/verify-identity', authenticatedMiddleware, validationMiddleware(validate.verifyIdentity), this.verifyUserIdentity)
        this.router.post('/user/nuban/create', authenticatedMiddleware, kudaTokenHandler, this.createNubanAccount)

    }

    private register = async (req: Request, res: Response, next: NextFunction): Promise<IUser | void> => {
        try {
            const user = await this.UserService.register(req.body)
            console.log(user)
            if(user) {
                const emailTemplate = welcomeEmail(req.body.firstname)
                const mailService = MailService.getInstance();
                mailService.sendMail({
                    to: req.body.email,
                    subject: 'Welcome to RetroPay!',
                    text: emailTemplate.text,
                    html: emailTemplate.html,
                });
            }
            
            const { firstname, lastname, email, username, _id } = user.user
            //Notify banking service
            publishMessage(await brokerChannel, `${process.env.BANKING_BINDING_KEY}`, JSON.stringify({
                event: 'NEW_USER_CREATED',
                data: {
                    firstname, 
                    lastname, 
                    email, 
                    username, 
                    _id
                }
            }));

            //Remove _id before responding to client
            delete user.user._id

            res.status(201).json({
                success: true,
                message: "Signup successful",
                data: {
                    token: user.token,
                    user: user.user
                }
            })
        } catch (error: any) {
            console.log(error)
            return next(new HttpExeception(400, error.message))
        }
    }

    private login = async (req: Request, res: Response, next: NextFunction): Promise<IUser | void> => {
        try {
            const token = await this.UserService.login(req.body)
            res.status(200).json({
                success: true,
                message: "Login successful",
                data: {
                    token
                }
            })
        } catch (error: any) {
            console.log(error)
            return next(new HttpExeception(400, error.message))
        }
    }

    private setPin = async (req: Request | any, res: Response, next: NextFunction): Promise<IUser | void> => {
        try {
            const updatedUser: IUser | any = await this.UserService.setTransactionPin(req.user, req.body.pin, req.body.confirmPin)
            publishMessage(await brokerChannel, `${process.env.BANKING_BINDING_KEY}`, JSON.stringify({
                event: 'USER_CREATE_PIN',
                data: {
                    id: req.user,
                    pin: updatedUser.pin
                }
            }));
            res.status(201).json({
                success: true,
                message: "Transaction pin set successfully",
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private changePassword = async (req: Request | any, res: Response, next: NextFunction): Promise<IUser | void> => {
        try {
            await this.UserService.changePassword(req.body, req.user)
            res.status(200).json({
                success: true,
                message: "Password changed successfully",
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private forgotPassword = async (req: Request | any, res: Response, next: NextFunction):Promise<IUser | void> => {
        try {
            const result: any = await this.UserService.forgotPassword(req.body)
            if(result.otp) {
                const emailTemplate = passwordResetEmail(result.firstname, result.otp)
                const mailService = MailService.getInstance();
                mailService.sendMail({
                    to: req.body.email,
                    subject: 'RetroPay Wallet - Password Reset.',
                    text: emailTemplate.text,
                    html: emailTemplate.html,
                });
            }
            res.status(200).json({
                success: true,
                message: "Resest password email sent",
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private resetPassword = async (req: Request | any, res: Response, next: NextFunction): Promise<IUser | void> => {
        try {
            const updatedUser = await this.UserService.resetPassword(req.body)
            console.log(updatedUser)
            res.status(200).json({
                success: true,
                message: "Password reset succesful",
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private sendVerifyEmailToken = async (req: Request | any, res: Response, next: NextFunction): Promise<IUser | void> => {
        try {
            const result: any = await this.UserService.generateEmailToken(req.email)
            if(result.otp) {
                const emailTemplate = verifyEmailTemplate(result.firstname, result.otp)
                const mailService = MailService.getInstance();
                mailService.sendMail({
                    to: req.email,
                    subject: 'RetroPay Wallet - Verify Your Email.',
                    text: emailTemplate.text,
                    html: emailTemplate.html,
                });
            }
            res.status(200).json({
                success: true,
                message: "Email verification token sent.",
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private verifyEmail = async (req: Request | any, res: Response, next: NextFunction): Promise<IUser | void> => {
        try {
            const updatedUser = await this.UserService.verifyEmail(req.user, req.body.token)
            res.status(200).json({
                success: true,
                message: "Email verification succesful",
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private sendVerifyPhoneToken = async (req: Request | any, res: Response, next: NextFunction): Promise<IUser | void> => {
        try {
            const result = await this.UserService.generatePhoneToken(req.user, req.body.phoneNumber)
            if(result) {
                console.log(result)
                // const smsInstance = new smsService
                // await smsInstance.sendSms(result.phoneNumber, `Hi There, here's a one-time code to use to verify your phone number. Code: ${result.otp}. \n`)
            }
            res.status(200).json({
                success: true,
                message: "Phone verification token sent.",
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message || 'Unable to send verification sms.'))
        }
    }

    private verifyPhone = async (req: Request | any, res: Response, next: NextFunction): Promise<IUser | void> => {
        try {
            const updatedUser = await this.UserService.verifyPhoneNumber(req.user, req.body.token)
            res.status(200).json({
                success: true,
                message: "Phone number verification succesful",
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private verifyAvailableAccountTag = async (req: Request | any, res: Response, next: NextFunction): Promise<IUser | void> => {
        try {
            if (req.params.username === undefined) {
                return next(new HttpExeception(400, 'Invalid request. Include account tag'))
            }
            const { username } = req.params

            const isAvailable: boolean = await this.UserService.chackTagAvailability(username)

            if(!isAvailable) {
                return next(new HttpExeception(400, 'Username is unavailable'))
            }
            res.status(200).json({
                success: true,
                message: 'Username is available'
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private setupUsername = async(req: Request | any, res: Response, next: NextFunction): Promise<IUser | void> => {
        try {
            const updatedUser = await this.UserService.setUsername(req.body.username, req.user)
            // if(updatedUser) {}
            publishMessage(await brokerChannel, `${process.env.BANKING_BINDING_KEY}`, JSON.stringify({
                event: 'USERNAME_UPDATED',
                data: updatedUser
            }));
            res.status(200).json({
                success: true,
                message: 'Username setup succesful',
                data: {
                    user: updatedUser
                }
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private uploadProfilePhoto = async (req: Request | any, res: Response, next: NextFunction): Promise<IUser | void> => {
        try {
            console.log(req)
            //Parse multi-part form data with formidable
            const form = formidable({ multiples: true });

            form.parse(req, async (err, fields, files) => {
                if (err) {
                    console.log(err)
                    return next(new HttpExeception(400, 'Unable to upload photo.'))
                }
                // get image file (object)
                const { profilePhoto }: any = files

                if(profilePhoto == undefined) {
                    return next(new HttpExeception(400, 'Invald request - profilePhoto not found.'))
                }

                //upload image to cloud, returns uploadResponse (object)
                const uploadResponse: any = await cloudinaryUpload(profilePhoto.filepath)

                if(!uploadResponse) {
                    return next(new HttpExeception(400, 'Unable to upload photo.'))
                }

                //store uploaded image info
                const updatedUser = await this.UserService.setPhotoUrl(req.user, uploadResponse)

                res.status(200).json({
                    success: true,
                    message: 'Profile upload succesful',
                    data: {
                        profilePhoto: updatedUser?.profilePhoto
                    }
                })
            
            });
        } catch (error :any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private softDeleteUserAccount = async(req: Request | any, res: Response, next: NextFunction): Promise<IUser | void> => {
        try {
            await this.UserService.deactivateUserAccount(req.user)

            publishMessage(await brokerChannel, `${process.env.BANKING_BINDING_KEY}`, JSON.stringify({
                event: 'DEACTIVATE_USER_ACOUNT',
                data: {
                    id: req.user
                }
            }));

            res.status(204).json({
                success: true,
                message: "User account deactivated.",
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    // private verifyUserIdentity = async (req: Request | any, res: Response, next: NextFunction): Promise<void> => {
    //     try {
    //         const verificationStatus = await this.UserService.verifyIdentity(req.body, req.user)
    //         console.log(verificationStatus)
    //         res.status(200).json({
    //             success: true,
    //             message: verificationStatus.message,
    //         })
    //     } catch (error: any) {
    //         return next(new HttpExeception(400, error.message))
    //     }
    // }

    public resolveAccountTag = async (req: Request | any, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = await this.UserService.resolveUserByAccountTag(req.params.username)
            res.status(200).json({
                success: true,
                message: "Account details resolved succesfully.",
                data: {
                    user
                }
            })
        } catch (error: any) {
            console.log(error)
            return next(new HttpExeception(400, error.message))
        }
    }

    public favoriteRecipient = async (req: Request | any, res: Response, next: NextFunction): Promise<void> => {
        try {
            const recipientId = await this.UserService.addToFavoritedRecipients(req.user, req.body.recipientTag)

            publishMessage(await brokerChannel, `${process.env.BANKING_BINDING_KEY}`, JSON.stringify({
                event: 'ADD_FAVORITE_RECIPIENT',
                data: {
                    id: req.user,
                    recipientId: recipientId
                }
            }));

            res.status(200).json({
                success: true,
                message: "Recipient added to favorites succesfully.", 
            })
        } catch (error: any) {
            return next(new HttpExeception(400, error.message))
        }
    }

    private createNubanAccount = async (req: Request | any, res: Response, next: NextFunction): Promise<void> => {
        try {
            const createdAccount: any = await this.UserService.createNubanAccount(req.user, req.k_token)
            console.log(createdAccount)

            //Notify banking service
            publishMessage(await brokerChannel, `${process.env.BANKING_BINDING_KEY}`, JSON.stringify({
                event: 'USER_NUBAN_CREATED',
                data: {
                    id: req.user,
                    accountNumber: createdAccount.accountNumber
                }
            }));
            res.status(200).json({
                success: true,
                message: "Succesfully created nuban account",
                data: createdAccount
            })
        } catch (error: any) {
            console.log(error)
            return next(new HttpExeception(400, error.message))
        }
    }
}

export default UserController
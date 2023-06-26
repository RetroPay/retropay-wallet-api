import { Router, Request, Response, NextFunction } from "express";
import IUser from "@/resources/user/user.interface";
import IController from "@/utils/interfaces/controller.interface";
import validate from "@/resources/user/user.validation";
import UserService from "@/resources/user/user.service";
import validationMiddleware from "@/middlewares/validation.middleware";
import HttpExeception from "@/utils/exceptions/http.exception";
import MailService from "@/services/sendEmails";
import authenticatedMiddleware from "@/middlewares/authenticate.middlware";
import kudaTokenHandler from "@/middlewares/kudaToken.middleware";
import passwordResetEmail from "@/templates/passwordReset.template";
import verifyEmailTemplate from "@/templates/verifyEmail.template";
import cloudinaryUpload from "@/services/cloudinary.service";
import formidable from "formidable";
import { logsnag } from "../../server";
import logger from "@/utils/logger";

class UserController implements IController {
    public path = "";
    public router = Router();
    private UserService = new UserService();

    constructor() {
        this.initialiseRoutes();
    }

    private initialiseRoutes(): void {
        //Auth routes
        this.router.post(
            "/auth/user/signup",
            validationMiddleware(validate.register),
            this.register
        );
        this.router.post(
            "/auth/user/login",
            validationMiddleware(validate.login),
            this.login
        );
        this.router.post(
            "/auth/user/reauthenticate",
            validationMiddleware(validate.authByPin),
            authenticatedMiddleware,
            this.authenticateWithPin
        );
        this.router.post(
            "/auth/user/forgot-password",
            validationMiddleware(validate.forgotPassword),
            this.forgotPassword
        );
        this.router.patch(
            "/auth/user/reset-password",
            validationMiddleware(validate.resetPassword),
            this.resetPassword
        );
        this.router.patch(
            "/auth/user/change-password",
            authenticatedMiddleware,
            validationMiddleware(validate.changePassword),
            this.changePassword
        );
        this.router.get("/user/sync-info", authenticatedMiddleware, this.getUser);

        //Profile routes
        this.router.post(
            "/user/profile/send-email-token",
            authenticatedMiddleware,
            this.sendVerifyEmailToken
        );
        this.router.patch(
            "/user/profile/verify-email",
            authenticatedMiddleware,
            validationMiddleware(validate.verifyEmail),
            this.verifyEmail
        );
        this.router.post(
            "/user/profile/send-phone-token/voice",
            authenticatedMiddleware,
            validationMiddleware(validate.phoneVerification),
            this.sendVerifyPhoneTokenVoice
        );
        this.router.post(
            "/user/profile/send-phone-token",
            authenticatedMiddleware,
            validationMiddleware(validate.phoneVerification),
            this.sendVerifyPhoneTokenSms
        );
        this.router.patch(
            "/user/profile/verify-phone",
            authenticatedMiddleware,
            validationMiddleware(validate.verifyPhone),
            this.verifyPhone
        );
        this.router.get(
            "/user/profile/account-tag/verify/:username",
            authenticatedMiddleware,
            this.verifyAvailableAccountTag
        );
        this.router.patch(
            "/user/profile/account-tag/setup",
            authenticatedMiddleware,
            validationMiddleware(validate.setupUsername),
            this.setupUsername
        );
        this.router.put(
            "/user/profile/upload-photo",
            authenticatedMiddleware,
            this.uploadProfilePhoto
        );
        this.router.put(
            "/user/profile/custom-categories",
            validationMiddleware(validate.addCustomCategory),
            authenticatedMiddleware,
            this.addCustomCategory
        );
        this.router.get(
            "/user/profile/custom-categories",
            authenticatedMiddleware,
            this.retrieveCustomCategories
        );
        this.router.post(
            "/user/profile/kyc",
            authenticatedMiddleware,
            this.uploadVerificationDocumentInfo
        );

        // Verification
        this.router.get(
            "/user/verification/status",
            authenticatedMiddleware,
            this.getVerificationStatus
        );
        this.router.post(
            "/user/verification/cancelled",
            authenticatedMiddleware,
            this.kycVerificationCanceled
        );

        // Notification
        this.router.put(
            "/user/profile/deviceId/set",
            authenticatedMiddleware,
            validationMiddleware(validate.saveDeviceId),
            this.setDeviceId
        );
        this.router.get(
            "/user/notifications",
            authenticatedMiddleware,
            this.getNotifications
        );

        // Pin
        this.router.put(
            "/user/pin/set",
            authenticatedMiddleware,
            validationMiddleware(validate.setPin),
            this.setPin
        );
        this.router.patch(
            "/user/pin/change",
            authenticatedMiddleware,
            validationMiddleware(validate.changePin),
            this.changeTransactionPin
        );
        this.router.patch(
            "/user/pin/forgot",
            authenticatedMiddleware,
            validationMiddleware(validate.forgotPin),
            this.forgotTransactionPin
        );

        // Favorites
        this.router.get(
            "/user/:username/resolve",
            authenticatedMiddleware,
            this.resolveAccountTag
        );
        this.router.post(
            "/user/profile/favorite-recipients/add",
            authenticatedMiddleware,
            validationMiddleware(validate.addFavorites),
            this.favoriteRecipient
        );
        this.router.delete(
            "/user/profile/favorite-recipients/delete",
            authenticatedMiddleware,
            validationMiddleware(validate.removeFavorite),
            this.unfavoriteRecipient
        );
        this.router.get(
            "/user/profile/favorite-recipients/list",
            authenticatedMiddleware,
            this.getFavoriteRecipients
        );

        this.router.get(
            "/user/profile",
            authenticatedMiddleware,
            this.getUserDetails
        );
        this.router.delete(
            "/user/deactivate",
            authenticatedMiddleware,
            this.softDeleteUserAccount
        );

        //NUBAN verification and creation
        this.router.post(
            "/user/nuban/create",
            authenticatedMiddleware,
            kudaTokenHandler,
            this.createNubanAccount
        );
    }

    private register = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const user = await this.UserService.register(req.body);

            //Remove _id before responding to client
            delete user.user._id;

            await logsnag.publish({
                channel: "user-actions",
                event: "User Signup",
                icon: "🎉",
                notify: true,
            });

            res.status(201).json({
                success: true,
                message: "Signup successful",
                data: {
                    token: user.token,
                    user: user.user,
                },
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private getUserDetails = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const user = await this.UserService.getUser(req.user);

            res.status(200).json({
                success: true,
                message: "Details retrieved",
                data: {
                    user,
                },
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private getUser = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const user = await this.UserService.getUserById(req.user);

            res.status(200).json({
                success: true,
                message: "Details retrieved",
                data: {
                    user,
                },
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private login = async (
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const user = await this.UserService.login(req.body);
            res.status(200).json({
                success: true,
                message: "Login successful",
                data: {
                    user,
                },
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private authenticateWithPin = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const token: IUser = await this.UserService.authenticateWithPin(
                req.user,
                req.body.pin
            );
            res.status(200).json({
                success: true,
                message: "Authentication successful",
                data: {
                    token,
                },
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private setPin = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const updatedUser: IUser | any = await this.UserService.setTransactionPin(
                req.user,
                req.body.pin,
                req.body.confirmPin
            );

            res.status(201).json({
                success: true,
                message: "Transaction pin set successfully",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private changeTransactionPin = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const { oldPin, newPin, confirmNewPin } = req.body;
            const updatedUser = await this.UserService.changePin(
                req.user,
                oldPin,
                newPin,
                confirmNewPin
            );

            res.status(201).json({
                success: true,
                message: "Transaction pin changed successfully",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private forgotTransactionPin = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const { password, newPin, confirmNewPin } = req.body;
            const updatedUser = await this.UserService.forgotPin(
                req.user,
                password,
                newPin,
                confirmNewPin
            );

            res.status(201).json({
                success: true,
                message: "Transaction pin changed successfully",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private changePassword = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            await this.UserService.changePassword(req.body, req.user);
            res.status(200).json({
                success: true,
                message: "Password changed successfully",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private forgotPassword = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const result: {
                otp: string;
                firstname: string;
            } | null = await this.UserService.forgotPassword(req.body);

            if (result.otp) {
                const emailTemplate = passwordResetEmail(result.firstname, result.otp);
                const mailService = MailService.getInstance();
                mailService.sendMail({
                    to: req.body.email,
                    subject: "Retro Wallet - Password Reset.",
                    text: emailTemplate.text,
                    html: emailTemplate.html,
                });
            }
            res.status(200).json({
                success: true,
                message: "Reset password email sent",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private resetPassword = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const updatedUser = await this.UserService.resetPassword(req.body);

            res.status(200).json({
                success: true,
                message: "Password reset successful",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private addCustomCategory = async (req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const { name, icon }: { name: string, icon: string } = req.body;

            const updatedUser = await this.UserService.addCustomCategory(
                req.user,
                icon,
                name
            ) 
            logger(updatedUser)

            res.status(200).json({
                success: true,
                message: "Custom category created successfully.",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    }

    private retrieveCustomCategories = async (req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const { name, icon }: { name: string, icon: string } = req.body;

            const categories = await this.UserService.retrieveCustomCategories(
                req.user
            )
            
            delete categories._id
            logger(categories)

            res.status(200).json({
                success: true,
                message: "Custom category retrieved successfully.",
                data: categories
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    }

    private sendVerifyEmailToken = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const result: any = await this.UserService.generateEmailToken(req.email);
            if (result.otp) {
                const emailTemplate: { html: string, text: string } = verifyEmailTemplate(result.firstname, result.otp);
                const mailService = MailService.getInstance();
                mailService.sendMail({
                    to: req.email,
                    subject: "Retro Wallet - Verify Your Email.",
                    text: emailTemplate.text,
                    html: emailTemplate.html,
                });
            }
            res.status(200).json({
                success: true,
                message: "Email verification token sent.",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private verifyEmail = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const updatedUser = await this.UserService.verifyEmail(
                req.user,
                req.body.token
            );
            res.status(200).json({
                success: true,
                message: "Email verification successful",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private sendVerifyPhoneTokenSms = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            await this.UserService.generatePhoneTokenSms(
                req.user,
                req.body.phoneNumber
            );
            res.status(200).json({
                success: true,
                message: "Phone verification token sent. Expires in 10 minutes",
            });
        } catch (error: any) {
            return next(
                new HttpExeception(
                    400,
                    error.message || "Unable to send verification sms."
                )
            );
        }
    };

    private sendVerifyPhoneTokenVoice = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            await this.UserService.generatePhoneTokenVoice(
                req.user,
                req.body.phoneNumber
            );
            res.status(200).json({
                success: true,
                message: "Phone verification token sent. Expires in 10 minutes",
            });
        } catch (error: any) {
            return next(
                new HttpExeception(
                    400,
                    error.message || "Unable to send verification sms."
                )
            );
        }
    };

    private verifyPhone = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const updatedUser = await this.UserService.verifyPhoneNumber(
                req.user,
                req.body.token
            );
            res.status(200).json({
                success: true,
                message: "Phone number verification successful",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private verifyAvailableAccountTag = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            if (req.params.username === undefined) {
                return next(
                    new HttpExeception(400, "Invalid request. Include account tag")
                );
            }
            const { username } = req.params;

            const isAvailable: boolean = await this.UserService.checkTagAvailability(
                username
            );

            if (!isAvailable) {
                return next(new HttpExeception(400, "Username is unavailable"));
            }

            res.status(200).json({
                success: true,
                message: "Username is available",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private setupUsername = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            const updatedUser = await this.UserService.setUsername(
                req.body.username,
                req.user
            );

            res.status(200).json({
                success: true,
                message: "Username setup successful",
                data: {
                    user: updatedUser,
                },
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private uploadProfilePhoto = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            //Parse multi-part form data with formidable
            const form = formidable({ multiples: false });

            form.parse(req, async (err, fields, files) => {
                if (err) {
                    return next(new HttpExeception(400, "Unable to upload photo."));
                }

                // get image file (object)
                const { profilePhoto }: any = files;

                if (profilePhoto == undefined) {
                    return next(
                        new HttpExeception(400, "Invalid request - profilePhoto not found.")
                    );
                }

                //upload image to cloud, returns uploadResponse (object)
                const uploadResponse: any = await cloudinaryUpload(
                    profilePhoto.filepath
                );

                if (!uploadResponse) {
                    return next(new HttpExeception(400, "Unable to upload photo."));
                }

                //store uploaded image info
                const updatedUser = await this.UserService.setPhotoUrl(
                    req.user,
                    uploadResponse
                );

                res.status(200).json({
                    success: true,
                    message: "Profile upload successful",
                    data: {
                        profilePhoto: updatedUser,
                    },
                });
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private softDeleteUserAccount = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<IUser | void> => {
        try {
            await this.UserService.deactivateUserAccount(req.user);

            res.status(204).json({
                success: true,
                message: "User account deactivated.",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private getVerificationStatus = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const verificationStatus =
                await this.UserService.getUserVerificationStatus(req.user);

            res.status(200).json({
                success: true,
                message: "Verification status retrieved",
                data: {
                    verificationStatus,
                },
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    public resolveAccountTag = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const user = await this.UserService.resolveUserByAccountTag(
                req.params.username
            );
            res.status(200).json({
                success: true,
                message: "Account details resolved successfully.",
                data: {
                    user,
                },
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    public favoriteRecipient = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const recipientId = await this.UserService.addToFavoritedRecipients(
                req.user,
                req.body.recipientTag
            );

            res.status(201).json({
                success: true,
                message: "Recipient added to favorites succesfully.",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    public unfavoriteRecipient = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { recipientTag } = req.body;
            const recipientId = await this.UserService.removeFavoritedRecicpient(
                req.user,
                recipientTag
            );

            res.status(200).json({
                success: true,
                message: "Recipient removed from favorites successfully.",
            });
        } catch (error) { }
    };

    public getFavoriteRecipients = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const favorites = await this.UserService.retrieveFavorites(req.user);
            res.status(200).json({
                success: true,
                message: "Favorite recipients retrieved successfully.",
                data: { favorites },
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    public getNotifications = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const notifications = await this.UserService.getNotifications(req.user);
            res.status(200).json({
                success: true,
                message: "Notifications retrieved successfully.",
                data: { notifications },
            });
        } catch (error: any) {
            return next(new HttpExeception(500, error.message));
        }
    };

    private createNubanAccount = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const createdAccount: any = await this.UserService.createNubanAccount(
                req.user,
                req.k_token
            );

            res.status(200).json({
                success: true,
                message: "Successfully created nuban account",
                data: createdAccount,
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private kycVerificationCanceled = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            await this.UserService.cancelKyc(req.user);

            res.status(200).json({
                success: true,
                message: "Verification canceled",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private setDeviceId = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const { oneSignalId }: { oneSignalId: string } = req.body;

            await this.UserService.saveUserDeviceId(req.user, oneSignalId);

            res.status(200).json({
                success: true,
                message: "Notification enabled successfully",
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };

    private uploadVerificationDocumentInfo = async (
        req: Request | any,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        try {
            const form = formidable({ multiples: true });

            form.parse(req, async (err, fields, files) => {
                if (err) {
                    return next(new HttpExeception(400, "Unable to upload photo."));
                }

                console.log(files, fields);
                // get image file (object)
                const { frontPicture, backPicture }: any = files;
                const { country, documentType, documentNumber }: any = fields;

                if (frontPicture === undefined || backPicture === undefined) {
                    return next(
                        new HttpExeception(400, "Invalid request - profilePhoto not found.")
                    );
                }

                //upload image to cloud, returns uploadResponse (object)
                const frontPictureResponse: any = await cloudinaryUpload(
                    frontPicture.filepath
                );
                const backPictureResponse: any = await cloudinaryUpload(
                    backPicture.filepath
                );

                if (!frontPictureResponse && !backPictureResponse) {
                    return next(new HttpExeception(400, "Unable to upload photo."));
                }

                //store uploaded image info
                const updatedUser = await this.UserService.uploadVerificationDocument(
                    req.user,
                    country,
                    documentType,
                    documentNumber,
                    frontPictureResponse.secure_url,
                    backPictureResponse.secure_url
                );

                await logsnag.publish({
                    channel: "user-actions",
                    event: "new verification document uploaded",
                    icon: "🎉",
                    notify: true,
                });

                res.status(200).json({
                    success: true,
                    message: "Verification documents uploaded successfully",
                });
            });
        } catch (error: any) {
            return next(new HttpExeception(400, error.message));
        }
    };
}

export default UserController;

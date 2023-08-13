import IUser from "./user.interface";
import userModel from "./user.model";
import translateError from "@/helpers/mongod.helper";
import bcrypt from "bcrypt";
import { createToken } from "@/utils/token";
import generateOtp from "@/services/otp";
import moment from "moment";
import ICloudinaryResponse from "@/utils/interfaces/cloudinaryResponse.interface";
import axios from "axios";
import { v4 } from "uuid";
import logger from "@/utils/logger";
import { isValidEmail } from "@/utils/emailPolicy";

class UserService {
  public async queueNotification(reqData: {
    id: string;
    trType: string;
    amount: number;
    recipientTag?: string;
    senderTag?: string;
    timestamp: Date;
    senderBankInfo?: string;
    recipientBankInfo?: string;
  }): Promise<void> {
    try {
      const {
        id,
        trType,
        amount,
        recipientTag,
        senderBankInfo,
        senderTag,
        recipientBankInfo,
        timestamp,
      } = reqData;

      const notification = {
        amount,
        trType,
        recipientTag,
        senderTag,
        senderBankInfo,
        recipientBankInfo,
        timestamp,
      };

      const updated = await userModel.findByIdAndUpdate(
        id,
        {
          $push: {
            notifications: notification,
          },
        },
        { new: true }
      );
    } catch (error: any) {
      throw new Error("Unable to queue save transaction.");
    }
  }

  public async getUser(id: string): Promise<IUser | Error> {
    try {
      const user = await userModel
        .findById(id, { _id: 0, firstname: 1 })
        .select(
          "firstname lastname profilePhoto email username phoneNumber isIdentityVerified verificationStatus transferPermission nubanAccountDetails isEmailVerified isPhoneVerified isUsernameSet isPinSet oneSignalDeviceId isPushNotificationAllowed"
        );

      if (!user) throw new Error("Unable to retrieve details");

      return user;
    } catch (error) {
      throw new Error("Unable to retrieve user details.");
    }
  }

  public async getUserById(id: string): Promise<IUser | Error> {
    try {
      const user = await userModel
        .findById(id)
        .select(
          "-notifications -password -passwordReset -phoneVerification -emailVerification -isUsernameSet -isPinSet"
        );

      if (!user) throw new Error("Unable to retrieve details");

      return user;
    } catch (error) {
      throw new Error("Unable to retrieve user details.");
    }
  }

  public async register(reqData: IUser): Promise<any | Error> {
    try {
      const { firstname, lastname, email, password } = reqData;

      if (!(await this.validatePasswordPolicy(password)))
        throw new Error(
          "Password is not secure. Include at least one uppercase, lowercase, special character and number."
        );
      
        if(!await isValidEmail(email)) throw new Error("Invalid email, please try signing up with a different email")

      const newUser: IUser = await userModel.create({
        firstname,
        lastname,
        email: email.toLowerCase(),
        password,
        username: email,
      });

      if (!newUser) throw new Error("Unable to create user account.");

      const {
        username,
        isPhoneVerified,
        isEmailVerified,
        isIdentityVerified,
        transferPermission,
        withdrawPermission,
        fundPermission,
        _id,
      } = newUser;

      return {
        token: createToken(newUser),
        user: {
          firstname,
          lastname,
          email,
          username,
          isPhoneVerified,
          isEmailVerified,
          isIdentityVerified,
          transferPermission,
          withdrawPermission,
          fundPermission,
          _id,
        },
      };
    } catch (error: any) {
      throw new Error(translateError(error)[0] || "Unable to sign up");
    }
  }

  public async login(reqData: {
    emailOrUsername: string;
    password: string;
  }): Promise<any | Error> {
    try {
      const foundUser = await userModel.findOne({
        $or: [
          { email: reqData.emailOrUsername },
          { username: reqData.emailOrUsername },
        ],
      });

      if (!foundUser) throw new Error("Incorrect username or password");

      if (foundUser.isAccountActive == false)
        throw new Error("Account is disabled. Contact support");

      if (await foundUser.isValidPassword(reqData.password)) {
        return {
          token: createToken(foundUser),
        };
      }

      throw new Error("Incorrect username or password.");
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to sign you in, Please try again."
      );
    }
  }

  public async changePassword(
    reqData: { oldPassword: string; newPassword: string },
    user: string
  ): Promise<IUser | Error> {
    try {
      if (!(await this.validatePasswordPolicy(reqData.newPassword)))
        throw new Error(
          "Password is not secure. Include at least one uppercase, lowercase, special character and number."
        );

      const foundUser: any = await userModel.findOne({ _id: user });

      if (!foundUser) throw new Error("Unable to update password");

      if (!(await foundUser.isValidPassword(reqData.oldPassword)))
        throw new Error("Incorrect password.");

      const updatedUser = await userModel.findOneAndUpdate(
        { _id: user },
        { password: await bcrypt.hash(reqData.newPassword, 10) },
        { new: true }
      );

      if (!updatedUser) throw new Error("Unable to update password");

      return updatedUser;
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to updated password."
      );
    }
  }

  public async setTransactionPin(
    userId: string,
    pin: string,
    confirmPin: string
  ): Promise<IUser | null> {
    try {
      if (pin !== confirmPin) throw new Error("Pin does not match.");
      const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        { pin: await bcrypt.hash(pin, 10), isPinSet: true },
        { new: true }
      );
      if (!updatedUser) throw new Error("Unable to set transaction pin.");

      return updatedUser;
    } catch (error) {
      throw new Error(
        translateError(error)[0] || "Unable to set transaction pin."
      );
    }
  }

  public async changePin(
    userId: string,
    oldPin: string,
    newPin: string,
    confirmPin: string
  ): Promise<IUser> {
    try {
      if (newPin !== confirmPin) throw new Error("Pin does not match.");

      if (!(await this.validatePin(oldPin, userId)))
        throw new Error("Incorrect transaction pin.");

      const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        { pin: await bcrypt.hash(newPin, 10) },
        { new: true }
      );
      if (!updatedUser) throw new Error("Unable to change transaction pin.");

      return updatedUser;
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to set transaction pin."
      );
    }
  }

  public async forgotPin(
    userId: string,
    password: string,
    newPin: string,
    confirmPin: string
  ): Promise<IUser> {
    try {
      if (newPin !== confirmPin) throw new Error("Pin does not match.");

      const foundUser = await userModel.findById(userId);

      if (!foundUser) throw new Error("Unable to change transaction pin.");

      if (!(await foundUser.isValidPassword(password)))
        throw new Error("Incorrect password.");

      const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        { pin: await bcrypt.hash(newPin, 10) },
        { new: true }
      );

      if (!updatedUser) throw new Error("Unable to change transaction pin.");

      return updatedUser;
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to change transaction pin."
      );
    }
  }

  public async authenticateWithPin(
    userId: string,
    pin: string
  ): Promise<IUser | any> {
    try {
      const foundUser = await userModel.findById(userId);
      if (!foundUser) throw new Error("Unable to validate your pin");

      if (!(await foundUser.isValidPin(pin)))
        throw new Error("Incorrect transaction pin.");

      return createToken(foundUser);
    } catch (error) {
      throw new Error(
        translateError(error)[0] || "Request failed, Try signing in."
      );
    }
  }

  private async validatePin(formPin: string, userId: string): Promise<boolean> {
    try {
      const foundUser = await userModel.findById(userId);

      if (!foundUser) throw new Error("Error validating your pin");

      if (!foundUser.pin)
        throw new Error("Create a transaction pin to continue");

      if (await foundUser.isValidPin(formPin)) {
        return true;
      }
      return false;
    } catch (error) {
      throw new Error("Unable to validate pin.");
    }
  }

  private async validatePasswordPolicy(password: string): Promise<Boolean> {
    try {
      /**
       * Method to validate user password against password policy.
       *
       * Password Policy: Password must be minimum length of 8 and maximum of 64,
       * password should contain atleast one valid special character, uppercase letter, lowercase letter and digit.
       */
      const REQUIRED_CHARACTER_CLASSES = 4;

      const characterClasses: Record<string, RegExp> = {
        uppercase: /[A-Z]/,
        lowercase: /[a-z]/,
        digit: /\d/,
        special: /[^\w\s]/,
      };

      let count = 0;

      for (const [name, regex] of Object.entries(characterClasses)) {
        if (regex.test(password)) {
          count += 1;
        }
      }

      if (count < REQUIRED_CHARACTER_CLASSES) {
        return false;
      }

      return true;
    } catch (error) {
      throw new Error(
        translateError(error)[0] || "Unable to validate password security"
      );
    }
  }

  public async forgotPassword(reqData: {
    email: string;
  }): Promise<{ otp: string; firstname: string } | undefined> {
    try {
      const foundUser: any = await userModel.findOne({ email: reqData.email });

      if (!foundUser) return; // Email doesn't exist, but don't throw error.

      const passwordReset = {
        token: generateOtp(5),
        expires: moment(new Date()).add(5, "m").toDate(),
      };

      const updatedUser = await userModel.findOneAndUpdate(
        { email: foundUser.email },
        { $push: { passwordReset } },
        { new: true }
      );

      if (!updatedUser) throw new Error("Unable to send reset password mail. Please try again");

      return { otp: passwordReset.token, firstname: updatedUser.firstname };
    } catch (error) {
      throw new Error(
        translateError(error)[0] || "Unable to send reset password mail. Try again."
      );
    }
  }

  public async resetPassword(reqData: {
    email: string;
    newPassword: string;
    token: string;
  }): Promise<IUser | null> {
    try {
      if (!(await this.validatePasswordPolicy(reqData.newPassword)))
        throw new Error(
          "Password is not secure. Include atleast one uppercase, lowercase, special character and number."
        );

      const foundUser: IUser | any = await userModel
        .findOne({ email: reqData.email })
        .select("passwordReset");
      if (!foundUser) throw new Error("Unable to update password.");

      const { passwordReset } = foundUser;
      const latestReset = passwordReset[passwordReset.length - 1];

      if (
        Date.now() > new Date(latestReset.expires).getTime() ||
        latestReset.token != reqData.token
      ) {
        throw new Error("Invalid or expired token.");
      }

      const updatedUser = await userModel.findOneAndUpdate(
        { email: reqData.email },
        { password: await bcrypt.hash(reqData.newPassword, 10) },
        { new: true }
      );

      return updatedUser;
    } catch (error) {
      throw new Error(translateError(error)[0] || "Unable to update password.");
    }
  }

  public async generateEmailToken(email: string): Promise<object | null> {
    try {
      const emailVerification = {
        token: generateOtp(5),
        expires: moment(new Date()).add(5, "m").toDate(),
      };

      const updatedUser: any = await userModel.findOneAndUpdate(
        { email: email.toLowerCase() },
        { emailVerification },
        { new: true }
      );
      if (!updatedUser) throw new Error("Unable to send verification mail.");

      return { otp: emailVerification.token, firstname: updatedUser.firstname };
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to send verification mail."
      );
    }
  }

  public async getUserByEmail(reqData: {
    email: string;
  }): Promise<IUser | null> {
    try {
      const foundUser: IUser | null = await userModel.findOne({
        email: reqData.email,
      });
      return foundUser;
    } catch (error) {
      throw new Error(
        translateError(error)[0] || "Unable to updated password."
      );
    }
  }

  public async verifyEmail(
    userId: string,
    token: string
  ): Promise<IUser | null> {
    try {
      const foundUser: any = await userModel.findById(userId);

      if (!foundUser) throw new Error("Unable to verify email.");
      if (foundUser.isEmailVerified == true)
        throw new Error("Email already verified");

      const { emailVerification } = foundUser;
      if (
        Date.now() > new Date(emailVerification.expires).getTime() ||
        emailVerification.token != token
      ) {
        throw new Error("Invalid or expired token.");
      }

      const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        {
          $set: { isEmailVerified: true },
        },
        { new: true }
      );
      return updatedUser;
    } catch (error) {
      throw new Error(translateError(error)[0] || "Unable to verify email.");
    }
  }

  public async generatePhoneTokenSms(
    userId: string,
    phoneNumber: string
  ): Promise<object | null> {
    try {
      const foundUser = await userModel
        .findById(userId)
        .select("firstname lastname email isPhoneVerified phoneVerification");
      if (!foundUser) throw new Error("Unable to verify phone number.");

      if (foundUser.isPhoneVerified == true)
        throw new Error("Your Phone number has already been verified.");

      // Generate token of length 5
      const token = generateOtp(5);

      const termiiPayload = {
        api_key: process.env.TERMII_API_KEY,
        to: phoneNumber,
        from: process.env.TERMII_SENDER_ID,
        channel: "generic",
        type: "plain",
        sms: `
          Hi ${foundUser.firstname},Here's your Retro Wallet pass ${token}.  Built by Retrostack
        `,
      };

      const response = await axios({
        method: "POST",
        url: "https://api.ng.termii.com/api/sms/send",
        data: termiiPayload,
      });

      if (response.data.code !== "ok")
        throw new Error(
          "We were unable to send a verification token, please try again."
        );

      const phoneVerification = {
        token,
        expires: moment(new Date()).add(10, "m").toDate(),
      };

      const updatedUser: IUser | null = await userModel.findByIdAndUpdate(
        userId,
        { phoneVerification, phoneNumber },
        { new: true }
      );

      if (!updatedUser)
        throw new Error(
          "We were unable to send a verification token, please try again."
        );

      return {
        otp: phoneVerification.token,
        firstname: updatedUser.firstname,
        phoneNumber,
      };
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] ||
          "We were unable to send a verification token, please try again."
      );
    }
  }

  public async generatePhoneTokenVoice(
    userId: string,
    phoneNumber: string
  ): Promise<void> {
    try {
      const foundUser = await userModel
        .findById(userId)
        .select("firstname lastname email isPhoneVerified phoneVerification");
      if (!foundUser) throw new Error("Unable to verify phone number.");

      if (foundUser.isPhoneVerified == true)
        throw new Error("Your Phone number has already been verified.");

      // Generate token of length 5
      const token = generateOtp(5);

      const termiiPayload = {
        api_key: process.env.TERMII_API_KEY,
        phone_number: phoneNumber,
        code: Number(token),
      };

      const response = await axios({
        method: "POST",
        url: "https://api.ng.termii.com/api/sms/otp/call",
        data: termiiPayload,
      });

      if (response.data.code !== "ok")
        throw new Error(
          "We were unable to send a verification token, please try again."
        );

      const phoneVerification = {
        token,
        expires: moment(new Date()).add(10, "m").toDate(),
      };

      const updatedUser: IUser | null = await userModel.findByIdAndUpdate(
        userId,
        { phoneVerification, phoneNumber },
        { new: true }
      );

      if (!updatedUser)
        throw new Error(
          "We were unable to send a verification token, please try again."
        );
    } catch (error) {
      throw new Error(
        translateError(error)[0] ||
          "We were unable to send a verification token, please try again."
      );
    }
  }

  public async verifyPhoneNumber(
    userId: string,
    token: string
  ): Promise<IUser | null> {
    try {
      const foundUser: any = await userModel
        .findById(userId)
        .select(
          "phoneVerification email firstname lastname phoneNumber isPhoneVerified"
        );

      if (!foundUser) throw new Error("Unable to verify phone number.");

      if (foundUser.isPhoneVerified == true)
        throw new Error("Phone number already verified");

      const { phoneVerification } = foundUser;
      if (
        Date.now() > new Date(phoneVerification.expires).getTime() ||
        phoneVerification.token != token
      ) {
        throw new Error("Invalid or expired token.");
      }

      const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        {
          $set: {
            isPhoneVerified: true,
          },
        },
        { new: true }
      );
      return updatedUser;
    } catch (error) {
      throw new Error(
        translateError(error)[0] || "Unable to verify phone number."
      );
    }
  }

  public async createNubanAccount(
    userId: string,
    k_token: string
  ): Promise<IUser | null> {
    try {
      const foundUser = await userModel
        .findById(userId)
        .select(
          "email firstname referenceId lastname phoneNumber nubanAccountDetails isIdentityVerified"
        );
      if (!foundUser) throw new Error("Unable to create nuban.");

      if (!foundUser.isIdentityVerified)
        throw new Error("Kindly verify your identity to proceed.");

      if (foundUser.nubanAccountDetails)
        throw new Error("Nuban has already been created");
      const {
        email,
        firstname,
        lastname,
        middlename,
        phoneNumber,
        referenceId,
      } = foundUser;

      /* Phone numbers are stored with their respective country codes e.g +234, 
            strip away the country code which is the first 4 characters */
      const formatPhoneNumber = "0" + phoneNumber?.substring(4);

      const response = await axios({
        method: "POST",
        url:
          process.env.NODE_ENV == "production"
            ? "https://kuda-openapi.kuda.com/v2.1"
            : "https://kuda-openapi-uat.kudabank.com/v2.1",
        data: {
          ServiceType: "ADMIN_CREATE_VIRTUAL_ACCOUNT",
          RequestRef: v4(),
          data: {
            email,
            phoneNumber: formatPhoneNumber,
            lastName: lastname.replace(" ", "-"),
            firstName: firstname.replace(" ", "-"),
            middleName: middlename?.replace(" ", "-") || "",
            trackingReference: referenceId,
          },
        },
        headers: {
          Authorization: `Bearer ${k_token}`,
        },
      });

      const data = response.data;

      //if axios call is successful but kuda status returns failed e'g 400 errors
      if (!data.status) throw new Error(data.message);

      await userModel.findByIdAndUpdate(userId, {
        nubanAccountDetails: { nuban: data.data.accountNumber },
        $set: { transferPermission: true },
      });

      return data.data;
    } catch (error) {
      throw new Error(translateError(error)[0] || "Unable to create nuban.");
    }
  }

  public async checkTagAvailability(username: string): Promise<boolean> {
    try {
      const foundUser = await userModel
        .findOne({ username })
        .select("username");

      if (!foundUser) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      throw new Error(
        translateError(error)[0] || "Unable verify available username."
      );
    }
  }

  public async setUsername(
    username: string,
    id: string
  ): Promise<IUser | null> {
    try {
      //check if username only contains alphabet, number, '_' and '.'
      const regex = /^[a-zA-Z0-9_.]+$/;
      if (!regex.test(username))
        throw new Error(
          "Invalid username, username only contains alphabet, number, underscore and dot"
        );

      if (await userModel.findOne({ username }))
        throw new Error("Username already exists");

      const updatedUser = await userModel
        .findByIdAndUpdate(id, { username, isUsernameSet: true }, { new: true })
        .select("username");
      if (!updatedUser) throw new Error("Unable to update username");

      return updatedUser;
    } catch (error: any) {
      throw new Error(translateError(error)[0] || "Unable to update username");
    }
  }

  public async setPhotoUrl(
    id: string,
    uploadResponse: ICloudinaryResponse
  ): Promise<IUser | any> {
    try {
      const updatedUser = await userModel.findByIdAndUpdate(
        id,
        {
          $set: {
            profilePhoto: {
              url: uploadResponse.secure_url,
              publicIid: uploadResponse.public_id,
            },
          },
        },
        { new: true }
      );

      if (!updatedUser) throw new Error("Unable to upload profile photo.");

      return updatedUser?.profilePhoto;
    } catch (error: any) {
      throw new Error("Unable to upload profile photo.");
    }
  }

  public async resolveUserByAccountTag(
    username: string
  ): Promise<IUser | null> {
    try {
      const user = await userModel
        .findOne({ username })
        .select("firstname lastname profilePhoto.url");
      if (!user) throw new Error("Invalid recipient.");
      return user;
    } catch (error: any) {
      throw new Error("Unable to resolve account details.");
    }
  }

  public async addToFavoritedRecipients(
    userId: string,
    username: string
  ): Promise<IUser | null> {
    try {
      const foundRecipient = await userModel.findOne({ username });
      if (!foundRecipient) throw new Error("Invalid recipient tag.");

      const checkId: any = await userModel.findById(userId);
      const { favoritedRecipients } = checkId;

      if (
        favoritedRecipients &&
        favoritedRecipients.includes(foundRecipient.id)
      )
        throw new Error("Recipient has been already added to your favorites.");

      const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        { $push: { favoritedRecipients: foundRecipient.id } },
        { new: true }
      );
      if (!updatedUser) throw new Error("Unable to add to favorite.");

      // return ID of favorited recipient
      return foundRecipient.id;
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to add to favorites."
      );
    }
  }

  public async removeFavoritedRecicpient(
    userId: string,
    username: string
  ): Promise<IUser | null> {
    try {
      const foundRecipient = await userModel.findOne({ username });
      if (!foundRecipient) throw new Error("Invalid recipient tag.");

      const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        { $pull: { favoritedRecipients: foundRecipient.id } },
        { new: true }
      );

      return foundRecipient.id;
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to unfavorite this recipient."
      );
    }
  }

  public async retrieveFavorites(userId: string): Promise<IUser[]> {
    try {
      const foundUser = await userModel
        .findById(userId)
        .select("favoritedRecipients");

      if (!foundUser) throw new Error("Unable to retrieve favorites");

      const favorites = await userModel
        .find(
          {
            $or: [
              { referenceId: { $in: foundUser.favoritedRecipients } },
              { _id: { $in: foundUser.favoritedRecipients } },
            ],
          },
          { _id: 0, firstname: 1 }
        )
        .select(
          "firstname lastname isIdentityVerified profilePhoto.url username"
        );
      return favorites;
    } catch (error) {
      throw new Error(
        translateError(error)[0] || "Unable to retrieve favorites."
      );
    }
  }

  public async getNotifications(userId: string): Promise<IUser | any> {
    try {
      const notifications: any = await userModel
        .findById(userId)
        .select("notifications");

      return notifications.notifications.reverse().slice(0, 20);
    } catch (error) {
      throw new Error("Unable to retrieve notifications.");
    }
  }

  public async deactivateUserAccount(userId: string): Promise<void> {
    try {
      const foundUser = await userModel.findByIdAndUpdate(
        userId,
        { $set: { isAccountActive: false } },
        { new: true }
      );

      if (!foundUser) throw new Error("Unable to delete user account.");
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to add to favorites."
      );
    }
  }

  public async getUserVerificationStatus(userId: string): Promise<any> {
    try {
      const userStatus = await userModel.findById(userId, {
        _id: 0,
        verificationStatus: 1,
        isIdentityVerified: 1,
      });

      if (!userStatus)
        throw new Error("Unable to retrieve verification status.");
      return userStatus;
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] || "Unable to retrieve verification status."
      );
    }
  }

  public async cancelKyc(id: string): Promise<void> {
    try {
      const user = await userModel.findByIdAndUpdate(
        id,
        { verificationStatus: "not started" },
        { new: true }
      );
    } catch (error) {
      throw new Error(
        translateError(error)[0] || "Unable to update verification status."
      );
    }
  }

  //user services for identity verification webhook events
  public async startUserVerification(accountTag: string): Promise<void> {
    try {
      await userModel.findOneAndUpdate(
        { username: accountTag },
        { verificationStatus: "pending" }
      );
    } catch (error) {
      //LogSnag call here
    }
  }

  public async updateUserVerification(
    accountTag: string,
    status: string
  ): Promise<void> {
    try {
      switch (status) {
        case "rejected":
          await userModel.findOneAndUpdate(
            { username: accountTag },
            { verificationStatus: "rejected" }
          );
          break;
        case "reviewNeeded":
          await userModel.findOneAndUpdate(
            { username: accountTag },
            { verificationStatus: "in review" }
          );
          break;
        case "verified":
          {
            const updatedUser = await userModel.findOneAndUpdate(
              { username: accountTag },
              {
                $set: {
                  isIdentityVerified: true,
                  withdrawPermission: true,
                  verificationStatus: "verified",
                },
              },
              { new: true }
            );

            const termiiPayload = {
              api_key: process.env.TERMII_API_KEY,
              to: updatedUser?.phoneNumber,
              from: process.env.TERMII_SENDER_ID,
              channel: "generic",
              type: "plain",
              sms: `Hi ${updatedUser?.firstname}, your identity has been verified. login to your retro wallet and create your nuban to get started sending and receiving money the retro way!`,
            };

            const response = await axios({
              method: "POST",
              url: "https://api.ng.termii.com/api/sms/send",
              data: termiiPayload,
            });
          }
          break;
        default:
          break;
      }
    } catch (error: any) {
      //LogSnag call here
    }
  }

  public async saveUserDeviceId(
    id: string,
    oneSignalDeviceId: string
  ): Promise<void> {
    try {
      const updatedUser = await userModel.findByIdAndUpdate(
        id,
        { oneSignalDeviceId, $set: { isPushNotificationAllowed: true } },
        { new: true }
      );

      if (!updatedUser)
        throw new Error("Unable to allow notification, please try again.");

      return;
    } catch (error) {
      throw new Error(
        translateError(error)[0] ||
          "Unable to allow notification, please try again."
      );
    }
  }

  public async uploadVerificationDocument(
    userId: string,
    country: string,
    documentType: string,
    documentNumber: string,
    documentFrontPicture: any,
    documentBackPicture: any
  ): Promise<void> {
    try {
      const updatedUser = await userModel.findByIdAndUpdate(
        userId,
        {
          $set: {
            verificationInformation: {
              country,
              documentType,
              documentNumber,
              documentFrontPicture,
              documentBackPicture,
            },
          },
          verificationStatus: "pending",
          isIdentityVerified: false,
        },
        { new: true }
      );

      if (!updatedUser)
        throw new Error(
          "Verification document upload failed. Please try again"
        );

      logger(updatedUser);
    } catch (error) {
      throw new Error(
        translateError(error)[0] ||
          "Verification document upload failed. Please try again."
      );
    }
  }

  public async addCustomCategory(
    userId: string,
    icon: string,
    categoryName: string
  ): Promise<void> {
    try {
      const newCategory = await userModel
        .findByIdAndUpdate(
          userId,
          { $push: { customCategories: { name: categoryName, icon } } },
          { new: true }
        )
        .select("customCategories");

      if (!newCategory)
        throw new Error("Custom category creation failed, please try again.");

      logger(newCategory);
    } catch (error: any) {
      throw new Error(
        translateError(error)[0] ||
          "Custom category creation failed, please try again."
      );
    }
  }

  public async retrieveCustomCategories(userId: string): Promise<IUser> {
    try {
      const categories = await userModel
        .findById(userId)
        .select("customCategories");

      if (!categories) throw new Error("Unable to retrieve custom categories");

      return categories;
    } catch (error) {
      throw new Error(
        translateError(error)[0] ||
          "Custom category creation failed, please try again."
      );
    }
  }
}

export default UserService;

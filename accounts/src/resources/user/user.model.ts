import { Schema, model } from "mongoose"
import IUser from "./user.interface"
import bcrypt from "bcrypt"

const tokenSchema = new Schema({
    token: { type: String, required: true },
    expires: { type: Date },
}, { timestamps: true})

const photoSchema = new Schema({
    url: { type: String, default: 'https://cdn-icons-png.flaticon.com/512/17/17004.png' },
    publicId: String,
}, { timestamps: true})

const notificationsSchema = new Schema({
    message: { type: String }
}, { timestamps: true})


const UserSchema = new Schema({
    firstname: { type: String, required: true, trim: true },
    lastname: { type: String, required: true, trim: true },
    middlename: { type: String , trim: true },
    password: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, unique: true },
    dateOfBirth: { type: String },
    profilePhoto: photoSchema,
    phoneNumber: { type: String },
    bankAccounts: {
        type: Object
    },
    pin: String,
    username: { type: String, unique: true },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    phoneVerification: tokenSchema,
    emailVerification: tokenSchema,
    passwordReset: [tokenSchema],
    isIdentityVerified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ['pending', 'rejected', 'verified', 'not started', 'in review'], default: 'not started' },
    transferPermission: { type: Boolean, default: false },
    withdrawPermission: { type: Boolean, default: false },
    customerCode: { type: String, },
    nubanAccountDetails: Object,
    favoritedRecipients: { type: Array },
    isAccountActive: { type: Boolean, default: true }, 
    notifications: [],
    isUsernameSet: {
        type: Boolean,
        default: false
    },
    isPinSet: {
        type: Boolean,
        default: false
    }
}, { timestamps: true})

UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();
    }

    const hash = await bcrypt.hash(this.password, 10)

    this.password = hash;

    next();
});

UserSchema.methods.isValidPassword = async function (
    password: string
): Promise<Error | boolean> {
    return await bcrypt.compare(password, this.password)
};

UserSchema.methods.isValidPin = async function (
    pin: string
): Promise<Error | boolean> {
    /**
     * Validate user transaction pin
     * @param pin
     */
    return await bcrypt.compare(pin, this.pin)
};

export default model<IUser>('User', UserSchema)
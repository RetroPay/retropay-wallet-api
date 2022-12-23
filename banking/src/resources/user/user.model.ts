import { Schema, model } from "mongoose"
import IUser from "./user.interface"
import bcrypt from "bcrypt"

const UserSchema = new Schema({
    firstname: { type: String, required: true, trim: true },
    lastname: { type: String, required: true, trim: true },
    middlename: { type: String , trim: true },
    email: { type: String, required: true, trim: true, unique: true },
    dateOfBirth: { type: String },
    referenceId: { type: Schema.Types.ObjectId, required: true, unique: true },
    bankAccounts: {
        type: Object
    },
    pin: String,
    username: { type: String, unique: true },
    isIdentityVerified: { type: Boolean, default: false },
    transferPermission: { type: Boolean, default: false },
    withdrawPermission: { type: Boolean, default: false },
    fundPermission: { type: Boolean, default: false },
    customerCode: { type: String, },
    nubanAccountDetails: Object,
    favoritedRecipients: { type: Array },
}, { timestamps: true})


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
import Joi from "joi"

const register = Joi.object({
    firstname: Joi.string().required(),
    lastname: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
})

const login = Joi.object({
    emailOrUsername: Joi.string().required(),
    password: Joi.string().min(6).required(),
})

const changePassword = Joi.object({
    oldPassword: Joi.string().min(6).required(),
    newPassword: Joi.string().min(6).required(),
})

const forgotPassword = Joi.object({
    email: Joi.string().email().required(),
})

const resetPassword = Joi.object({
    newPassword: Joi.string().min(6).required(),
    token: Joi.string().required(),
    email: Joi.string().email().required()
})

const verifyEmail = Joi.object({
    token: Joi.string().min(5).required(),
})

const verifyPhone = Joi.object({
    token: Joi.string().min(5).required(),
})

const phoneVerification = Joi.object({
    phoneNumber: Joi.string().required()
})

const setupUsername = Joi.object({
    username: Joi.string().required().min(6).max(16)
})

const verifyIdentity = Joi.object({
    accountNumber: Joi.string().required(),
    BVN: Joi.string().required().min(11),
    bankCode: Joi.string().required()
})

const setPin = Joi.object({
    pin: Joi.string().required().min(4).max(4),
    confirmPin: Joi.string().required().min(4).max(4)
})

const changePin = Joi.object({
    oldPin: Joi.string().required().min(4).max(4),
    newPin: Joi.string().required().min(4).max(4),
    confirmNewPin: Joi.string().required().min(4).max(4),
})

const addFavorites = Joi.object({
    recipientTag: Joi.string().required()
})

const removeFavorite = Joi.object({
    recipientTag: Joi.string().required()
})

const forgotPin = Joi.object({
    password: Joi.string().min(6).required(),
    newPin: Joi.string().required().min(4).max(4),
    confirmNewPin: Joi.string().required().min(4).max(4),
})

const authByPin = Joi.object({
    pin: Joi.string().required().min(4).max(4)
})

const saveDeviceId = Joi.object({
    oneSignalId: Joi.string().required()
})

export default { 
    register,
    login,
    authByPin,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    phoneVerification,
    verifyPhone,
    setupUsername,
    verifyIdentity,
    setPin,
    changePin,
    addFavorites,
    removeFavorite,
    forgotPin,
    saveDeviceId
}
import { cleanEnv, str, port, bool } from 'envalid'

function validateEnv(): void {
    cleanEnv(process.env, {
        NODE_ENV: str({
            choices: ['development', 'production']
        }),
        MONGODB_URI_CLOUD: str(),
        PORT: port({default: 5000}),
        JWT_SECRET: str(),
        OTP_DIGITS: str(),
        SMTP_HOST: str(),
        SMTP_USER: str(),
        SMTP_PASSWORD: str(),
        SMTP_TLS: str(),
        SMS_SECRET_KEY: str(),
        SMS_API_KEY: str(),
        CLOUDINARY_CLOUD_NAME: str(),
        CLOUDINARY_API_KEY: str(),
        CLOUDINARY_API_SECRET: str(),
        KUDA_PRIVATE_KEY: str(),
        KUDA_MAIL: str(),
        TERMII_API_KEY: str(),
        TERMII_SECRET_KEY: str(),
        TERMII_SENDER_ID: str(),
        LOG_SNAG_TOKEN: str()
    })
}

export default validateEnv
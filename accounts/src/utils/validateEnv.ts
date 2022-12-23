import { cleanEnv, str, port, bool } from 'envalid'

function validateEnv(): void {
    cleanEnv(process.env, {
        NODE_ENV: str({
            choices: ['development', 'production']
        }),
        MONGODB_URI_CLOUD: str(),
        MONGODB_URI: str(),
        PORT: port({default: 5000}),
        // GATEWAY_SECRET_KEY: str(),
        // GATEWAY_SUB_ACCT: str(),
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
        EXCHANGE_NAME: str(),
        MESSAGE_BROKER_URL: str(),
        ACCOUNT_BINDING_KEY: str(),
        QUEUE_NAME: str()
        // GATEWAY_SPLIT_CODE: str(),
        // FLW_PUBLIC_KEY: str(),
        // FLW_SECRET_KEY: str()
    })
}

export default validateEnv
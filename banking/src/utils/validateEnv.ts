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
        EXCHANGE_NAME: str(),
        MESSAGE_BROKER_URL: str(),
        BANKING_BINDING_KEY: str(),
        BANKING_QUEUE_NAME: str(),
        KUDA_MAIL: str(),
        KUDA_PRIVATE_KEY: str(),
        KUDA_TEST_URI: str(),
        KUDA_TEST_TOKEN_URI: str(),
        KUDA_PROD_URI: str(),
        LOG_SNAG_TOKEN: str()
    })
}

export default validateEnv
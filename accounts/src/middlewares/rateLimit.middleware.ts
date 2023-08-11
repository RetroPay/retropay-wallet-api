import rateLimit from "express-rate-limit"

export const forgotPasswordLimiter = rateLimit({
    windowMs: 24 * 60 * 60 * 1000,
    max: 10, 
})
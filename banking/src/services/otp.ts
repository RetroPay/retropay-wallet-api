//GENERATE RANDOM PASSWORD
const generateRandomPassword = function (len: number): string {
    const randomString =
        'abcdefghijklmnopqrstuvwxyzBCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    let password: string = '';
    for (let index = 0; index < len; index++) {
        password +=
            randomString[Math.ceil(Math.random() * (randomString.length - 1))];
    }

    return password;
};

//GENERATE OTP
function generateOtp (len: number): string {
    const digits = `${process.env.OTP_DIGITS}`;
    let OTP = '';
    for (let i = 0; i < len; i++) {
        OTP += digits[Math.floor(Math.random() * 10)];
    }

    return OTP;
};

//VERIFY GENERATED OTP
// const verifyOtp = async function (
//     userId: any,
//     otp: string,
//     type: string
// ): Promise<any> {
//     let existOtp = await otpMaster.findOne({
//         userId,
//         otp,
//         type,
//     });
//     const currentDate = new Date();
//     if (!existOtp || existOtp.otpExpiration < currentDate) {
//         return null;
//     }

//     return existOtp._id;
// };

export default generateOtp
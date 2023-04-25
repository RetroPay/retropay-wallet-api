import jwt from 'jsonwebtoken';
import IUser from '@/resources/user/user.interface';
import Token from '@/utils/interfaces/token.interface';

export const createToken = (user: IUser): string => {
    return jwt.sign({ id: user._id }, process.env.JWT_SECRET as jwt.Secret, {
        expiresIn: "1hr",
    });
};

export const verifyToken = async (
    token: string
): Promise<jwt.VerifyErrors | Token> => {
    return new Promise((resolve, reject) => {
        jwt.verify(
            token,
            process.env.JWT_SECRET as jwt.Secret,
            (err, payload) => { 
                if (err) return reject('Your session has expired. Please login to continue ');
                resolve(payload as Token);
            }
        );
    });
};

export default { createToken, verifyToken };
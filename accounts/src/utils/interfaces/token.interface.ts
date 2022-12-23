import { Schema } from 'mongoose';

interface Token extends Object {
    exp: number;
    id: Schema.Types.ObjectId;
    // expiresIn: number;
}

export default Token;
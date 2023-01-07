import { Schema, model } from "mongoose"

const webhookSchema = new Schema(
  {
  },
  {
    timestamps: true
  }
);

export default model('metamap-webhook', webhookSchema)

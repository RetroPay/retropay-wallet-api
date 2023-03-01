import 'dotenv/config'
import 'module-alias/register'
import validateEnv from './utils/validateEnv'
import App from './app'
import DemoController from "@/resources/status/status.controller"
import UserController from "@/resources/user/user.controller"
import WalletController from "@/resources/wallet/wallet.controller"
import WebhookController from "@/resources/webhooks/kuda/hook.controller"
import {createChannel} from "@/utils/broker"
import { createClient } from "redis"

validateEnv()

export const brokerChannel = createChannel()

const app = new App([
    new DemoController, 
    new UserController,
    new WalletController,
    new WebhookController
], Number(process.env.PORT) || 4001)


//Connect to DB and run server
app.createConnection()

const url = process.env.REDIS_CONNECTION_STRING
export const redisClient = url != undefined ? createClient({
    url: `${process.env.REDIS_CONNECTION_STRING}`
}) : createClient()
redisClient.connect();


redisClient.on('error', (err) => console.log('Redis Client Error', err));

export default {
    brokerChannel,
    redisClient
}
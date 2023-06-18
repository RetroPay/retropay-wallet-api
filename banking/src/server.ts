import 'dotenv/config'
import 'module-alias/register'
import validateEnv from './utils/validateEnv'
import App from './app'
import DemoController from "@/resources/status/status.controller"
import WalletController from "@/resources/wallet/wallet.controller"
import WebhookController from "@/resources/webhooks/kuda/hook.controller"
import BillController from './resources/bills/bill.controller'
import BudgetController from './resources/budget/budget.controller'
import { createClient } from "redis"
import { LogSnag } from "logsnag"

validateEnv()

const app = new App([
    new DemoController,
    new WalletController,
    new WebhookController,
    new BillController,
    new BudgetController
], Number(process.env.PORT) || 4001)


//Connect to DB and run server
app.createConnection()

const url = process.env.REDIS_CONNECTION_STRING
export const redisClient = url != undefined ? createClient({
    url: `${process.env.REDIS_CONNECTION_STRING}`
}) : createClient()


export const logsnag = new LogSnag({
    token: `${process.env.LOG_SNAG_TOKEN}`,
    project: 'retro-wallet'
})

redisClient.connect();
redisClient.on('error', async (err) => {
    await logsnag.publish({
        channel: "server",
        event: "Redis client error",
        description: `redis client error: ${err}`
    })
})

export default {
    redisClient,
    logsnag
}
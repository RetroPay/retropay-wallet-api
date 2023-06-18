import 'dotenv/config'
import 'module-alias/register'
import validateEnv from './utils/validateEnv'
import App from './app'
import DemoController from "@/resources/status/status.controller"
import UserController from "@/resources/user/user.controller"
import metaMapWebhookController from './resources/webhooks/metamap/hook.controller'
// import { createChannel } from "@/utils/broker"
import { createClient } from "redis"
import { LogSnag } from "logsnag"

validateEnv()


// export const brokerChannel = createChannel()

const url = process.env.REDIS_CONNECTION_STRING
export const redisClient = url != undefined ? createClient({
    url: `${process.env.REDIS_CONNECTION_STRING}`
}) : createClient()

redisClient.connect();
redisClient.on('error', async (err) => {
    await logsnag.publish({
        channel: "server",
        event: "Redis client error",
        description: `redis client error: ${err}`
    })
})

export const logsnag = new LogSnag({
    token: `${process.env.LOG_SNAG_TOKEN}`,
    project: 'retro-wallet'
})

export default {
    // brokerChannel,
    redisClient,
    logsnag
}

const app = new App([
    new DemoController, 
    new UserController,
    // new metaMapWebhookController
], Number(process.env.PORT) || 4002)

//Connect to DB and run server
app.createConnection()
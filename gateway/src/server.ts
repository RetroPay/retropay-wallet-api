import 'dotenv/config'
import 'module-alias/register'
import App from './app'
import StatusController from './resources/status/status.controller'
import { LogSnag } from "logsnag"

export const logsnag = new LogSnag({
    token: `${process.env.LOG_SNAG_TOKEN}`,
    project: "retro-wallet"
})

export default {
    logsnag
}

const app = new App([new StatusController], 
    Number(process.env.PORT) || 4000)

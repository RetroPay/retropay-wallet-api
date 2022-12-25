import 'dotenv/config'
import 'module-alias/register'
import App from './app'
import StatusController from './resources/status/status.controller'

const app = new App([new StatusController], 
    Number(process.env.PORT) || 4000)

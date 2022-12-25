import 'dotenv/config'
import 'module-alias/register'
import validateEnv from './utils/validateEnv'
import App from './app'
import DemoController from "@/resources/status/status.controller"
import UserController from "@/resources/user/user.controller"
import WalletController from "@/resources/wallet/wallet.controller"
import {createChannel} from "@/utils/broker"

validateEnv()

const brokerChannel = createChannel()
console.log(brokerChannel)
export default brokerChannel

const app = new App([
    new DemoController, 
    new UserController,
    new WalletController
], Number(process.env.PORT) || 4001)


//Connect to DB and run server
app.createConnection()
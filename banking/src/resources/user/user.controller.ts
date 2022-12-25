import { Router, Request, Response, NextFunction } from "express"
import IController from "@/utils/interfaces/controller.interface";
import UserService  from "@/resources/user/user.service"
import channel from "../../server"
import { subscribeMessage, publishMessage} from "@/utils/broker"

class UserController implements IController {
    public path = ''
    public router = Router()
    private UserService = new UserService

    constructor() {
        this.subscribeBroker()
    }
    
    public async subscribeBroker () {
        await subscribeMessage(await channel, `${process.env.BANKING_BINDING_KEY}`, this.UserService)
    }

}

export default UserController
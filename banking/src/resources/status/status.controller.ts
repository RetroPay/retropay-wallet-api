import { Router, Response, Request, NextFunction } from "express"
import IController from "@/utils/interfaces/controller.interface"

class DemoController implements IController {
    public path = '/status'
    public router = Router()

    constructor() {
        this.initialiseRoutes()
    }

    private initialiseRoutes(): void {
        this.router.get(`${this.path}`, this.serverStatus)
    }

    private serverStatus = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
       return res.status(200).json("ok")
    }
}

export default DemoController
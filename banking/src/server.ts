import "dotenv/config";
import "module-alias/register";
import validateEnv from "./utils/validateEnv";
import App from "./app";
import DemoController from "@/resources/status/status.controller";
import WalletController from "@/resources/wallet/wallet.controller";
import WebhookController from "@/resources/webhooks/kuda/hook.controller";
import BillController from "./resources/bills/bill.controller";
import BudgetController from "./resources/budget/budget.controller";
import SwapController from "./resources/swap/swap.controller";
import { createClient } from "redis";
import { LogSnag } from "logsnag";
import logger from "./utils/logger";
import BeneficiaryController from "./resources/beneficiary/beneficiary.controller";

validateEnv();

const app = new App(
  [
    new DemoController(),
    new WalletController(),
    new WebhookController(),
    new BillController(),
    new BudgetController(),
    new SwapController(),
    new BeneficiaryController(),
  ],
  Number(process.env.PORT) || 4001
);

//Connect to DB and run server
app.createConnection();

const url = process.env.REDIS_CONNECTION_STRING;
logger(url);
export const redisClient =
  url != undefined
    ? createClient({
        url: `${process.env.REDIS_CONNECTION_STRING}`,
      })
    : createClient();
logger("Local Redis instance used");

export const logsnag = new LogSnag({
  token: `${process.env.LOG_SNAG_TOKEN}`,
  project: "retro-wallet",
});

redisClient.connect();
redisClient.on("error", async (err) => {
  await logsnag.publish({
    channel: "server",
    event: "Redis client error",
    description: `redis client error: ${err}`,
  });
});

export default {
  redisClient,
  logsnag,
};

import { Router, Response, Request, NextFunction } from "express";
import IController from "@/utils/interfaces/controller.interface";
import webhookModel from "./hook.model";
import WalletService from "@/resources/wallet/wallet.service";
import { logsnag } from "../../../server";
import IWallet from "@/resources/wallet/wallet.interface";
import MailService from "@/services/sendEmails";
import transferInRecieptEmail from "@/templates/transferin-receipt.template";
import transferOutRecieptEmail from "@/templates/transferout.template";
import axios from "axios";
import userModel from "@/resources/user/user.model";
import sendPushNotification from "@/services/sendPushNotification";
import logger from "@/utils/logger";
import crypto from "crypto";

class MapleradWebhookController implements IController {
  public path = "/webhook";
  public router = Router();
  private walletService = new WalletService();

  constructor() {
    this.initialiseRoutes();
  }

  private initialiseRoutes(): void {
    this.router.post(`${this.path}/maplerad`, this.processWebhooks);
  }

  private processWebhooks = async (
    req: Request | any,
    res: Response,
    next: NextFunction
  ): Promise<IWallet | void> => {
    /**
     * Event types
     *
     * 1. collection.successful, collection.failed (NGN_x)
     * 2. account.created.successful, account.created.failed (USD)
     * 3. transfer.successful, transfer.failed
     */
    try {
      await webhookModel.create(req.body);
      logger(req.body);

      // verify signature
      const svixId = req.headers["svix-id"];
      const svixTimestamp = req.headers["svix-timestamp"];
      const svixSignature = req.headers["svix-signature"];

      const signedContent = `${svixId}.${svixTimestamp}.${req.body}`;
      const secret = `${process.env.MAPLEARD_WEBHOOK_SECRET}`; // your webhook secret

      // Need to base64 decode the secret
      const secretBytes = Buffer.from(secret.split("_")[1], "base64");
      const signature = crypto
        .createHmac("sha256", secretBytes)
        .update(signedContent)
        .digest("base64");

      if (signature != svixSignature) return;
      logger(signature);
      logger(svixSignature);

      const { event }: { event: string } = req.body;

      switch (event.toLowerCase()) {

        case "collection.successful": {
            
        }
        break;
      
        default:
            break;
      }

      res.sendStatus(200);
      const { transactionType } = req.body;
      const {
        payingBank,
        amount,
        transactionReference,
        narrations,
        accountName,
        accountNumber,
        senderName,
        recipientName,
        sessionId,
        instrumentNumber,
      } = req.body;

      // Don't process webhooks for transaction fees.
      if (!narrations.toLowerCase().includes("transaction fee")) {
        switch (transactionType) {
          case "Credit":
            {
              const transaction: any = await this.walletService.recieveFunds(
                payingBank,
                amount,
                transactionReference,
                narrations,
                accountName,
                accountNumber,
                transactionType,
                senderName,
                recipientName,
                sessionId
              );

              switch (transaction.transactionType) {
                case "Transfer" || "transfer":
                  {
                    await userModel.findOneAndUpdate(
                      { referenceId: transaction.id },
                      {
                        $push: {
                          notifications: {
                            id: transaction.id, //user reference ID
                            trType: "transfer-in",
                            amount: transaction.amount as Number,
                            senderTag: transaction.senderTag,
                            timestamp: transaction.createdAt,
                          },
                        },
                      },
                      { new: true }
                    );

                    // Send mail notification
                    const emailTemplate = transferInRecieptEmail(
                      transaction.recipientTag,
                      transaction.amount,
                      transaction.senderTag,
                      transaction.transactionId,
                      transaction.createdAt
                    );
                    const mailService = MailService.getInstance();
                    mailService.sendMail({
                      to: transaction.recipientEmail,
                      subject: `Cha-ching 🤑 @${transaction.recipientTag}, you just got credited!`,
                      text: emailTemplate.text,
                      html: emailTemplate.html,
                    });

                    //SMS alert
                    const termiiPayload = {
                      api_key: process.env.TERMII_API_KEY,
                      to: transaction.recipientPhoneNumber,
                      from: process.env.TERMII_SENDER_ID,
                      channel: "generic",
                      type: "plain",
                      sms: `Retro Wallet - Credit Alert. Amount: NGN${(
                        transaction.amount / 100
                      )
                        .toFixed(2)
                        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}. Sender: ${
                        transaction.senderTag
                      }. Date: ${new Date(
                        transaction.createdAt
                      ).toLocaleDateString()} ${new Date(
                        transaction.createdAt
                      ).toLocaleTimeString()}`,
                    };

                    const response = await axios({
                      method: "POST",
                      url: "https://api.ng.termii.com/api/sms/send",
                      data: termiiPayload,
                    });

                    if (transaction.oneSignalPlayerId) {
                      await sendPushNotification(
                        transaction.oneSignalPlayerId,
                        `Amount: NGN${(transaction.amount / 100)
                          .toFixed(2)
                          .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}. Sender: ${
                          transaction.senderTag
                        }.`,
                        "Retro Wallet - Credit Alert"
                      );
                    }
                  }
                  break;
                case "Funding" || "funding":
                  {
                    const payload = {
                      id: transaction.id,
                      trType: "funding",
                      amount: transaction.amount as Number,
                      senderBankInfo: `${transaction.senderName}(${transaction.senderBank})`,
                      timestamp: transaction.createdAt,
                    };

                    await userModel.findOneAndUpdate(
                      { referenceId: transaction.id },
                      {
                        $push: {
                          notifications: payload,
                        },
                      },
                      { new: true }
                    );

                    //Push notification alert
                    if (transaction.oneSignalPlayerId) {
                      await sendPushNotification(
                        transaction.oneSignalPlayerId,
                        `Amount: NGN${(transaction.amount / 100)
                          .toFixed(2)
                          .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}. Sender: ${
                          transaction.senderName
                        }(${transaction.senderBank}).`,
                        "Retro Wallet - Credit Alert"
                      );
                    }

                    const termiiPayload = {
                      api_key: process.env.TERMII_API_KEY,
                      to: transaction.recipientPhoneNumber,
                      from: process.env.TERMII_SENDER_ID,
                      channel: "generic",
                      type: "plain",
                      sms: `Retro Wallet - Credit Alert. Amount: NGN${(
                        transaction.amount / 100
                      )
                        .toFixed(2)
                        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}. Sender: ${
                        transaction.senderName
                      }(${transaction.senderBank}). Date: ${new Date(
                        transaction.createdAt
                      ).toLocaleDateString()} ${new Date(
                        transaction.createdAt
                      ).toLocaleTimeString()}`,
                    };

                    const response = await axios({
                      method: "POST",
                      url: "https://api.ng.termii.com/api/sms/send",
                      data: termiiPayload,
                    });

                    await logsnag.publish({
                      channel: "user-actions",
                      event: "Wallet Funded",
                      description: "User's wallet has been successfully funded",
                      icon: "🤑",
                      notify: true,
                    });
                  }
                  break;
                default:
              }
            }
            break;
          case "Debit":
            /**
             * When an account is debited by kuda, it's either for a transfer(sending money to another wallet user)
             * or withdrawal (sending money to any NGN bank accounts). Code below acknowledges transaction debit and updates stored
             * transaction status to successful.
             */
            {
              const transaction: any =
                await this.walletService.acknowledgeFundsTransfer(
                  amount,
                  transactionReference,
                  narrations,
                  sessionId,
                  instrumentNumber,
                  payingBank,
                  req.k_token
                );
              const { transactionType } = transaction;

              switch (transactionType) {
                case "Transfer":
                  {
                    await userModel.findOneAndUpdate(
                      { referenceId: transaction.id },
                      {
                        $push: {
                          notifications: {
                            id: transaction.id,
                            trType: "transfer-out",
                            amount: transaction.amount,
                            recipientTag: transaction.recipientTag,
                            timestamp: transaction.createdAt,
                          },
                        },
                      },
                      { new: true }
                    );

                    //Push notification alert
                    if (transaction.oneSignalPlayerId) {
                      await sendPushNotification(
                        transaction.oneSignalPlayerId,
                        `Amount: NGN${(transaction.amount / 100)
                          .toFixed(2)
                          .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}. Recipient: ${
                          transaction.recipientTag
                        }.`,
                        "Retro Wallet - Debit Alert"
                      );
                    }

                    // Send email notification
                    const emailTemplate = transferOutRecieptEmail(
                      transaction.senderTag,
                      transaction.amount,
                      transaction.recipientTag,
                      transaction.transactionId,
                      transaction.createdAt
                    );
                    const mailService = MailService.getInstance();
                    mailService.sendMail({
                      to: transaction.senderEmail,
                      subject: `Howdy @${transaction.senderTag}, your transfer was successful! 🚀`,
                      text: emailTemplate.text,
                      html: emailTemplate.html,
                    });

                    //sms notification
                    const termiiPayload = {
                      api_key: process.env.TERMII_API_KEY,
                      to: transaction.senderPhoneNumber,
                      from: process.env.TERMII_SENDER_ID,
                      channel: "generic",
                      type: "plain",
                      sms: `Retro Wallet - Debit Alert. Amount: NGN${(
                        transaction.amount / 100
                      )
                        .toFixed(2)
                        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}. Recipient: ${
                        transaction.recipientTag
                      }. Date: ${new Date(
                        transaction.createdAt
                      ).toLocaleDateString()} ${new Date(
                        transaction.createdAt
                      ).toLocaleTimeString()} `,
                    };

                    const response = await axios({
                      method: "POST",
                      url: "https://api.ng.termii.com/api/sms/send",
                      data: termiiPayload,
                    });
                  }
                  break;
                case "Withdrawal":
                  {
                    await userModel.findOneAndUpdate(
                      { referenceId: transaction.id },
                      {
                        $push: {
                          notifications: {
                            id: transaction.id,
                            trType: "withdrawal",
                            amount: transaction.amount,
                            recipientBankInfo: `${transaction.beneficiaryName}(${transaction.beneficiaryBank}-${transaction.beneficiaryAccount})`,
                            timestamp: transaction.createdAt,
                          },
                        },
                      },
                      { new: true }
                    );

                    //Push notification alert
                    if (transaction.oneSignalPlayerId) {
                      await sendPushNotification(
                        transaction.oneSignalPlayerId,
                        `Amount: NGN${(transaction.amount / 100)
                          .toFixed(2)
                          .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}. Recipient: ${
                          transaction.beneficiaryName
                        }/${transaction.beneficiaryAccount}.`,
                        "Retro Wallet - Debit Alert"
                      );
                    }

                    // Send email notification
                    const emailTemplate = transferOutRecieptEmail(
                      transaction.senderTag,
                      transaction.amount,
                      transaction.beneficiaryName,
                      transaction.transactionId,
                      transaction.createdAt
                    );
                    const mailService = MailService.getInstance();
                    mailService.sendMail({
                      to: transaction.senderEmail,
                      subject: `Howdy @${transaction.senderTag}, your transfer is on its way! 🚀`,
                      text: emailTemplate.text,
                      html: emailTemplate.html,
                    });

                    const termiiPayload = {
                      api_key: process.env.TERMII_API_KEY,
                      to: transaction.senderPhoneNumber,
                      from: process.env.TERMII_SENDER_ID,
                      channel: "generic",
                      type: "plain",
                      sms: `Retro Wallet - Debit Alert. Amount: NGN${(
                        transaction.amount / 100
                      )
                        .toFixed(2)
                        .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}. Recipient: ${
                        transaction.beneficiaryName
                      }/${transaction.beneficiaryAccount}. Date: ${new Date(
                        transaction.createdAt
                      ).toLocaleDateString()} ${new Date(
                        transaction.createdAt
                      ).toLocaleTimeString()} `,
                    };

                    const response = await axios({
                      method: "POST",
                      url: "https://api.ng.termii.com/api/sms/send",
                      data: termiiPayload,
                    });
                  }
                  break;
                case "BillPurchase":
                  {
                    await userModel.findOneAndUpdate(
                      { referenceId: transaction.id },
                      {
                        $push: {
                          notifications: {
                            id: transaction.id,
                            trType: "withdrawal",
                            amount: transaction.amount * 100,
                            recipientBankInfo: `${transaction.payingBank} - ${transaction.narrations}`,
                            timestamp: transaction.createdAt,
                          },
                        },
                      },
                      { new: true }
                    );

                    //Push notification alert
                    if (transaction.oneSignalPlayerId) {
                      await sendPushNotification(
                        transaction.oneSignalPlayerId,
                        `Amount: NGN${transaction.amount
                          .toFixed(2)
                          .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}. Narration: ${
                          transaction.narrations
                        }.`,
                        `Retro Wallet - Bill Purchase ${transaction.status}`
                      );
                    }
                  }
                  break;
                default:
                  break;
              }
            }
            break;
          default:
            break;
        }
      }
    } catch (error) {
      await logsnag.publish({
        channel: "failed-requests",
        event: "Failed to process wallet webhook",
        description: `Webhook process failed. error: ${error}`,
        icon: "😭",
        notify: true,
      });
    }
  };
}

export default MapleradWebhookController;

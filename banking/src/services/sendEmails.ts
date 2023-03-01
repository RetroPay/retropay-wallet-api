import nodemailer, { Transport } from "nodemailer"
import IMailInterface from "@/utils/interfaces/mail.interface";

export default class MailService {
    private static instance: MailService;
    private transporter: any;

    private constructor() {
    }
    //INTSTANCE CREATE FOR MAIL
    static getInstance() {
        if (!MailService.instance) {
            MailService.instance = new MailService();
        }
        return MailService.instance;
    }
    //CREATE CONNECTION FOR LOCAL
    async createLocalConnection() {
        let account = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
            host: account.smtp.host,
            port: account.smtp.port,
            secure: account.smtp.secure,
            auth: {
                user: account.user,
                pass: account.pass,
            },
        });
    }
    //CREATE CONNECTION FOR LIVE
    async createConnection() {
        const options: any = {
            host: `${process.env.SMTP_HOST}`,
            port: process.env.SMTP_PORT,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
        }
        this.transporter = nodemailer.createTransport(options);
    }
    //SEND MAIL
    async sendMail(options: IMailInterface) {
        try {
            return await this.transporter
                .sendMail({ 
                    from: `"Retro Wallet Team" ${process.env.SMTP_USER}`,
                    to: options.to,
                    subject: options.subject,
                    text: options.text,
                    html: options.html,
                })
                .then((info: any) => {
                    return info;
                })
        } catch (err: any) {
            console.error(err.message)
        }
    }
    //VERIFY CONNECTION
    async verifyConnection() {
        return this.transporter.verify();
    }
    //CREATE TRANSPOTER
    getTransporter() {
        return this.transporter;
    }
} 
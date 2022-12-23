// import Vonage from "@vonage/server-sdk"

// export default class smsService {
//     private vonage: any
    
//     constructor(){
//         this.initialiseVonage()
//     }

//     public initialiseVonage() {
//         this.vonage = new Vonage({
//             apiKey: `${process.env.SMS_API_KEY}`,
//             apiSecret: `${process.env.SMS_SECRET_KEY}`
//         })
//     }

//     public async sendSms(to: string, text: string) {
//         try {
//             const info = await this.vonage.message.sendSms("RetroPay", to, text)
//             return info;
//         } catch (error: any) {
//             console.log(error.message)
//         }
//     }
// }
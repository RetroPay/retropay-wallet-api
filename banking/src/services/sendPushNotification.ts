import axios from 'axios'

/**
 * Function to send push notification to a specific user device
 * @param playerId 
 * @param content 
 * @param heading 
 */
export default async function sendPushNotification(playerId: string, content: string, heading: string): Promise<void> {
    try {
        const oneSignalPayload = {
            app_id: process.env.ONESIGNAL_APP_ID,
            contents: { "en": content },
            include_player_ids: [ playerId ],
            headings: {"en": heading },
          };
    
          const result = await axios({
            method: 'POST',
            url: 'https://onesignal.com/api/v1/notifications',
            data: oneSignalPayload,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Authorization": `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
            }
          })

    } catch (error) {
        throw new Error("Failed to send notification")
    }
}
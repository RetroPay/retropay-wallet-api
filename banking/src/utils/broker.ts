import amqplib from 'amqplib'

export const createChannel = async (): Promise<amqplib.Channel> => {
    try {
        const connection = await amqplib.connect(`${process.env.MESSAGE_BROKER_URL}`)
        const channel = await connection.createChannel()
        await channel.assertExchange(`${process.env.EXCHANGE_NAME}`, 'direct')
        return channel
    } catch (error: any) {
        throw new Error(error)
    }
}


export const publishMessage = async (channel: amqplib.Channel, binding_key: string, message: any) => {
    try {
        const published = channel.publish(`${process.env.EXCHANGE_NAME}`, binding_key, Buffer.from(message))

    } catch (error: any) {
        throw new Error(error)
    } 
}

export const subscribeMessage = async (channel: amqplib.Channel, binding_key: string, service: any) => {
    try {
        const appQueue: any = await channel.assertQueue(`${process.env.BANKING_QUEUE_NAME}`);

        channel.bindQueue(appQueue.queue, `${process.env.EXCHANGE_NAME}`, binding_key);

        channel.consume(appQueue.queue, (data: any) => {
            service.handleSubscribedEvents(data.content.toString())
            channel.ack(data)
        })
    } catch (error: any) {
        throw new Error(error)
    }
}

export default {
    createChannel,
    subscribeMessage,
    publishMessage
}

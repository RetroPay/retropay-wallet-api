export const logger = (content: any) => {
    return process.env.NODE_ENV == 'development' || 'local' ? console.log(content) : ''
}

export default logger
export const logger = (content: any): void => {
    process.env.NODE_ENV == 'development' ? console.log(content) : ''
}

export default logger
export default interface IMailInterface {
    from?: string;
    to: string | string[];
    subject: string;
    text: string;
    html: string;
}
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface IEmailTransport {
  send(message: EmailMessage): Promise<void>;
}

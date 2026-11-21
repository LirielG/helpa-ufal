import nodemailer from "nodemailer";
import type { TestAccount, Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import { env } from "@/config/env.js";
import type {
  EmailMessage,
  IEmailTransport,
} from "@/services/email/transport/IEmailTransport.js";

type SmtpConfig = {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
};

type Props = {
  smtp?: SmtpConfig;
};

const DEFAULT_SMTP_PORT = 587;
// Only reachable outside production, where MAIL_FROM is required.
const DEVELOPMENT_DEFAULT_FROM = "Helpa <no-reply@helpa.local>";

// Nodemailer waits up to 2 minutes to connect and 10 minutes on an idle
// socket; a blocked SMTP port must fail fast instead of stalling callers.
const TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
};

// One Ethereal account per process: every instance shares it, so developers
// only need the credentials logged once.
let etherealAccount: Promise<TestAccount> | null = null;

function getEtherealAccount(): Promise<TestAccount> {
  etherealAccount ??= nodemailer.createTestAccount().then(
    (account) => {
      console.info(
        `[email] Ethereal account created — user: ${account.user} pass: ${account.pass}`,
      );
      return account;
    },
    (error: unknown) => {
      etherealAccount = null;
      throw error;
    },
  );
  return etherealAccount;
}

class NodemailerTransport implements IEmailTransport {
  private _smtp: SmtpConfig;
  private _transporter: Promise<
    Transporter<SMTPTransport.SentMessageInfo>
  > | null = null;

  constructor(props?: Props) {
    this._smtp = props?.smtp ?? {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.MAIL_FROM,
    };
  }

  private get _usesEthereal(): boolean {
    return this._smtp.host === undefined;
  }

  public async send(message: EmailMessage): Promise<void> {
    const transporter = await this._getTransporter();
    const info = await transporter.sendMail({
      ...message,
      from: this._smtp.from ?? DEVELOPMENT_DEFAULT_FROM,
    });

    if (this._usesEthereal) {
      console.info(
        `[email] Preview: ${String(nodemailer.getTestMessageUrl(info))}`,
      );
    }
  }

  // Created on the first send, never in the constructor: routers build their
  // services at import time, and creating an Ethereal account then would make
  // starting the server or running the seed reach the network.
  private _getTransporter(): Promise<
    Transporter<SMTPTransport.SentMessageInfo>
  > {
    this._transporter ??= this._createTransporter().catch((error: unknown) => {
      this._transporter = null;
      throw error;
    });
    return this._transporter;
  }

  private async _createTransporter(): Promise<
    Transporter<SMTPTransport.SentMessageInfo>
  > {
    if (this._usesEthereal) {
      const account = await getEtherealAccount();
      return nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
        ...TIMEOUTS,
      });
    }

    const { host, port, secure, user, pass } = this._smtp;
    return nodemailer.createTransport({
      host,
      port: port ?? DEFAULT_SMTP_PORT,
      secure: secure ?? false,
      // Local catchers such as Mailpit accept mail without a login.
      ...(user !== undefined && { auth: { user, pass } }),
      ...TIMEOUTS,
    });
  }
}

export default NodemailerTransport;

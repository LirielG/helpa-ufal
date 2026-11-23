import type { IEmailService } from "@/services/email/IEmailService.js";
import type { IEmailTemplate } from "@/services/email/templates/IEmailTemplate.js";
import {
  emailTemplates,
  type EmailTemplateCode,
  type EmailTemplateVars,
} from "@/services/email/templates/index.js";
import type { IEmailTransport } from "@/services/email/transport/IEmailTransport.js";
import NodemailerTransport from "@/services/email/transport/NodemailerTransport.js";

type Props = {
  transport?: IEmailTransport;
};

class EmailService implements IEmailService {
  private _transport: IEmailTransport;

  constructor(props?: Props) {
    this._transport = props?.transport ?? new NodemailerTransport();
  }

  // Rejects when delivery fails; callers decide whether to wait or just log.
  public async send<K extends EmailTemplateCode>(
    to: string,
    templateCode: K,
    vars: EmailTemplateVars[K],
  ): Promise<void> {
    // TypeScript cannot correlate the indexed template with K's vars.
    const template = emailTemplates[templateCode] as IEmailTemplate<
      EmailTemplateVars[K]
    >;
    const { subject, text, html } = template.render(vars);

    await this._transport.send({ to, subject, text, html });
  }
}

export default EmailService;

import type {
  EmailTemplateCode,
  EmailTemplateVars,
} from "@/services/email/templates/index.js";

export interface IEmailService {
  send<K extends EmailTemplateCode>(
    to: string,
    templateCode: K,
    vars: EmailTemplateVars[K],
  ): Promise<void>;
}

import type { IEmailTemplate } from "@/services/email/templates/IEmailTemplate.js";
import {
  button,
  codeBox,
  layout,
  paragraph,
} from "@/services/email/templates/layout.js";

type PasswordResetCodeVars = {
  firstName: string;
  // Already formatted as XXXX-XXXX.
  code: string;
  resetUrl: string;
};

const SUBJECT = "Seu código para redefinir a senha do Helpa";
const INTRO =
  "Recebemos um pedido para redefinir a senha da sua conta no Helpa. " +
  "Use o código abaixo ou o link a seguir. O código vale por 30 minutos e " +
  "só pode ser usado uma vez.";
const IGNORE =
  "Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.";

const passwordResetCode: IEmailTemplate<PasswordResetCodeVars> = {
  render({ firstName, code, resetUrl }) {
    const greeting = `Olá, ${firstName}!`;

    return {
      subject: SUBJECT,
      text:
        `${greeting} ${INTRO}\n\n` +
        `Código: ${code}\n\n` +
        `Redefinir senha: ${resetUrl}\n\n` +
        IGNORE,
      html: layout({
        title: SUBJECT,
        heading: "Redefinir senha",
        greeting,
        content:
          paragraph(INTRO) +
          codeBox(code) +
          button(resetUrl, "Redefinir senha") +
          paragraph(IGNORE),
      }),
    };
  },
};

export default passwordResetCode;

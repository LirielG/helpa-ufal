import type { IEmailTemplate } from "@/services/email/templates/IEmailTemplate.js";
import { escapeHtml, layout } from "@/services/email/templates/layout.js";

type PasswordChangedVars = {
  firstName: string;
};

const SUBJECT = "Sua senha do Helpa foi alterada";
const BODY =
  "A senha da sua conta no Helpa acabou de ser alterada, e as sessões " +
  "abertas foram encerradas. Se foi você, não é preciso fazer nada.";
const WARNING =
  "Se não foi, redefina sua senha imediatamente pela opção " +
  '"Esqueci minha senha" na tela de login.';

// No button or link on purpose: a security notice about passwords must not
// teach users to click links in e-mails about passwords.
const passwordChanged: IEmailTemplate<PasswordChangedVars> = {
  render({ firstName }) {
    const greeting = `Olá, ${firstName}!`;
    const paragraph = (text: string) =>
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${escapeHtml(text)}</p>`;

    return {
      subject: SUBJECT,
      text: `${greeting} ${BODY} ${WARNING}`,
      html: layout({
        title: SUBJECT,
        heading: "Senha alterada",
        greeting,
        content: paragraph(BODY) + paragraph(WARNING),
      }),
    };
  },
};

export default passwordChanged;

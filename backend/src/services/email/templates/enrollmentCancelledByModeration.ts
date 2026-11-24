import type { IEmailTemplate } from "@/services/email/templates/IEmailTemplate.js";
import { escapeHtml, layout } from "@/services/email/templates/layout.js";

type EnrollmentCancelledByModerationVars = {
  activityTitle: string;
};

const SUBJECT = "Ação removida e inscrição cancelada";
const GREETING = "Olá!";

const paragraph = (text: string) =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${escapeHtml(text)}</p>`;

const enrollmentCancelledByModeration: IEmailTemplate<EnrollmentCancelledByModerationVars> =
  {
    render({ activityTitle }) {
      const body = `A ação «${activityTitle}», em que você tinha inscrição, foi removida pela moderação do Helpa, e sua inscrição foi cancelada.`;

      return {
        subject: SUBJECT,
        text: [GREETING, body].join("\n\n"),
        html: layout({
          title: SUBJECT,
          heading: SUBJECT,
          greeting: GREETING,
          content: paragraph(body),
        }),
      };
    },
  };

export default enrollmentCancelledByModeration;

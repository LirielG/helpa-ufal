import type { IEmailTemplate } from "@/services/email/templates/IEmailTemplate.js";
import { escapeHtml, layout } from "@/services/email/templates/layout.js";

type ActivityRemovedByModerationVars = {
  activityTitle: string;
  justification: string;
};

const SUBJECT = "Sua ação foi removida pela moderação";
const GREETING = "Olá!";
const EFFECTS =
  "As inscrições ativas foram canceladas. Certificados já emitidos continuam válidos.";

const paragraph = (text: string) =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${escapeHtml(text)}</p>`;

const activityRemovedByModeration: IEmailTemplate<ActivityRemovedByModerationVars> =
  {
    render({ activityTitle, justification }) {
      const summary = `A ação «${activityTitle}» foi removida pela moderação do Helpa.`;
      const justificationLine = `Justificativa: ${justification}`;

      return {
        subject: SUBJECT,
        text: [GREETING, summary, justificationLine, EFFECTS].join("\n\n"),
        html: layout({
          title: SUBJECT,
          heading: SUBJECT,
          greeting: GREETING,
          content:
            paragraph(summary) +
            paragraph(justificationLine) +
            paragraph(EFFECTS),
        }),
      };
    },
  };

export default activityRemovedByModeration;

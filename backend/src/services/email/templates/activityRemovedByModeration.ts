import type { IEmailTemplate } from "@/services/email/templates/IEmailTemplate.js";
import { layout, paragraph } from "@/services/email/templates/layout.js";

type ActivityRemovedByModerationVars = {
  activityTitle: string;
  justification: string;
};

const SUBJECT = "Sua ação foi removida pela moderação";
const GREETING = "Olá!";
const EFFECTS =
  "As inscrições ativas foram canceladas. Certificados já emitidos continuam válidos.";

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

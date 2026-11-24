import type { ModerationVerdict } from "@prisma/client";
import type { IEmailTemplate } from "@/services/email/templates/IEmailTemplate.js";
import { escapeHtml, layout } from "@/services/email/templates/layout.js";

type ReportReviewedVars = {
  activityTitle: string;
  verdict: ModerationVerdict;
};

const SUBJECT = "Sua denúncia foi analisada";
const GREETING = "Olá!";

const UPHELD_NOTE =
  "A decisão considera o conjunto das denúncias recebidas e a análise da " +
  "moderação, e não indica necessariamente que a remoção aconteceu pelo " +
  "motivo que você apontou.";

const REJECTED_NOTE =
  "A decisão considera o conjunto das denúncias recebidas e a análise da " +
  "moderação, e não indica necessariamente que o motivo que você apontou " +
  "foi descartado.";

const paragraph = (text: string) =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${escapeHtml(text)}</p>`;

const reportReviewed: IEmailTemplate<ReportReviewedVars> = {
  render({ activityTitle, verdict }) {
    const outcome =
      verdict === "UPHELD"
        ? `A ação «${activityTitle}», que você denunciou, foi analisada pela moderação e removida da plataforma.`
        : `A ação «${activityTitle}», que você denunciou, foi analisada pela moderação e continua publicada.`;
    const note = verdict === "UPHELD" ? UPHELD_NOTE : REJECTED_NOTE;

    return {
      subject: SUBJECT,
      text: [GREETING, outcome, note].join("\n\n"),
      html: layout({
        title: SUBJECT,
        heading: SUBJECT,
        greeting: GREETING,
        content: paragraph(outcome) + paragraph(note),
      }),
    };
  },
};

export default reportReviewed;

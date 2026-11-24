import activityRemovedByModeration from "@/services/email/templates/activityRemovedByModeration.js";
import enrollmentCancelledByModeration from "@/services/email/templates/enrollmentCancelledByModeration.js";
import passwordChanged from "@/services/email/templates/passwordChanged.js";
import reportReviewed from "@/services/email/templates/reportReviewed.js";

export const emailTemplates = {
  passwordChanged,
  reportReviewed,
  activityRemovedByModeration,
  enrollmentCancelledByModeration,
};

export type EmailTemplateCode = keyof typeof emailTemplates;

// Each template declares its own vars; callers get them checked per code.
export type EmailTemplateVars = {
  [K in EmailTemplateCode]: Parameters<(typeof emailTemplates)[K]["render"]>[0];
};

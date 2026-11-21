import passwordChanged from "@/services/email/templates/passwordChanged.js";

export const emailTemplates = {
  passwordChanged,
};

export type EmailTemplateCode = keyof typeof emailTemplates;

// Each template declares its own vars; callers get them checked per code.
export type EmailTemplateVars = {
  [K in EmailTemplateCode]: Parameters<(typeof emailTemplates)[K]["render"]>[0];
};

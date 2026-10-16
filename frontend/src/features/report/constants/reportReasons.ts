// Values mirror the backend `ReportReason` enum; the API rejects anything else.
export const REPORT_REASONS = [
  { value: "SPAM", label: "Spam ou divulgação indevida" },
  { value: "INAPPROPRIATE_CONTENT", label: "Conteúdo inadequado" },
  { value: "MISINFORMATION", label: "Informação falsa ou enganosa" },
  { value: "DUPLICATE", label: "Ação duplicada" },
  { value: "OTHER", label: "Outro motivo" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];

export const REPORT_REASONS = [
  { value: "motivo_1", label: "Motivo 1" },
  { value: "motivo_2", label: "Motivo 2" },
  { value: "motivo_3", label: "Motivo 3" },
  { value: "motivo_4", label: "Motivo 4" },
  { value: "motivo_5", label: "Motivo 5" },
  { value: "motivo_6", label: "Motivo 6" },
  { value: "motivo_7", label: "Motivo 7" },
] as const;

export type ReportReasonValue = (typeof REPORT_REASONS)[number]["value"];
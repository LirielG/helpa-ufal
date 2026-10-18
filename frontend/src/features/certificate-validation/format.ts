import { formatDate } from "@/utils/date";

/** Hyphenated as on the printed certificate: `7KQ4MX9T2R` → `7KQ4M-X9T2R`. */
export function formatValidationCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

/** Local dates; a single one when the action starts and ends on the same day. */
export function formatPeriod(startDate: string, endDate: string): string {
  const start = formatDate(startDate);
  const end = formatDate(endDate);

  return start === end ? start : `${start} a ${end}`;
}

export function formatWorkloadHours(hours: number): string {
  return `${hours} ${hours === 1 ? "hora" : "horas"}`;
}

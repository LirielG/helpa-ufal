// The PDF prints dates in Maceió's calendar. Reading them in the viewer's
// time zone would show a different day than the paper near midnight, and a
// later "Emitido em" would pass for a reissue.
const certificateDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Maceio",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Hyphenated as on the printed certificate: `7KQ4MX9T2R` → `7KQ4M-X9T2R`. */
export function formatValidationCode(code: string): string {
  const half = Math.ceil(code.length / 2);
  return `${code.slice(0, half)}-${code.slice(half)}`;
}

/** `dd/mm/aaaa`, on the same calendar as the printed certificate. */
export function formatCertificateDate(isoString: string): string {
  return certificateDateFormatter.format(new Date(isoString));
}

/** A single date when the action starts and ends on the same day. */
export function formatPeriod(startDate: string, endDate: string): string {
  const start = formatCertificateDate(startDate);
  const end = formatCertificateDate(endDate);

  return start === end ? start : `${start} a ${end}`;
}

export function formatWorkloadHours(hours: number): string {
  return `${hours} ${hours === 1 ? "hora" : "horas"}`;
}

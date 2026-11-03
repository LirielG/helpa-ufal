/** Helpers for the `dd/mm/aaaa` date field, whose form value is `aaaa-mm-dd`. */

export const INVALID_DATE_MESSAGE = "Informe uma data válida (dd/mm/aaaa).";

const pad = (n: number) => String(n).padStart(2, "0");

/** `aaaa-mm-dd` to a local Date. Never `new Date(iso)`, which reads UTC. */
export function parseISODate(iso: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return undefined;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(y, m - 1, d);
  const valid =
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d;
  return valid ? date : undefined;
}

export function formatISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `aaaa-mm-dd` to the `dd/mm/aaaa` the field shows. */
export function isoToDisplay(iso: string): string {
  const date = parseISODate(iso);
  if (!date) return "";
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** `dd/mm/aaaa` to `aaaa-mm-dd`, or undefined when it is not a real date. */
export function displayToISO(display: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!match) return undefined;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return parseISODate(iso) ? iso : undefined;
}

export function maskDate(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
  if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return d;
}

/**
 * Keeps only digits and places the colon after the hour, so typing "0830"
 * reads "08:30". The result is at most five characters.
 */
export function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

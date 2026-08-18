const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Accepts negative values for dates in the past. */
export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * MS_PER_DAY);
}

// E-mails greet by first name. Splitting on any run of whitespace keeps this
// safe for stored names that were not trimmed on the way in.
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

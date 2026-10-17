// The code is stored as 10 Crockford Base32 characters with no hyphen; the
// hyphen exists only on paper, to make it easier to read and type.
export function formatValidationCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

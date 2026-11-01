import { randomBytes } from "node:crypto";

// Crockford Base32: no I, L, O or U, so a code read off paper cannot be
// mistaken for another one.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 10;

// The code is the only thing standing between a certificate and anyone who
// guesses it, so it must come from a CSPRNG and never from an id or counter.
// `byte & 31` has no bias because 256 is a multiple of the 32-letter alphabet.
export function generateValidationCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (const byte of bytes) {
    code += ALPHABET[byte & 31];
  }
  return code;
}

const STORED_CODE = /^[0-9A-HJKMNP-TV-Z]{10}$/;

// Besides the ASCII hyphen, the Unicode dashes (U+2010–U+2015) and the minus
// sign (U+2212): a code copied from a PDF or a word processor often carries
// one of them in place of the printed "-".
const SEPARATORS = /[\s‐-―−-]/g;

// Turns what a person typed (lowercase, hyphenated, with the look-alike
// letters Crockford maps onto digits) into the stored form, or null when it
// cannot be a code at all.
export function normalizeValidationCode(input: string): string | null {
  const code = input
    .replace(SEPARATORS, "")
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

  return STORED_CODE.test(code) ? code : null;
}

// The code is stored as 10 Crockford Base32 characters with no hyphen; the
// hyphen exists only on paper, to make it easier to read and type.
export function formatValidationCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

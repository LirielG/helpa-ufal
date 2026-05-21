const PASSWORD_RULES = {
  minLength: (p: string) => p.length >= 8,
  uppercaseLetter: (p: string) => /[A-Z]/.test(p),
  lowercaseLetter: (p: string) => /[a-z]/.test(p),
  number: (p: string) => /[0-9]/.test(p),
  special: (p: string) => /[^A-Za-z0-9]/.test(p),
  onlyValidCharacters: (p: string) => /^[\x20-\x7E]+$/.test(p),
} as const;

export type PasswordRule = keyof typeof PASSWORD_RULES;

export type PasswordValidationResult = Record<PasswordRule, boolean>;

export function validatePassword(password: string): PasswordValidationResult {
  return {
    minLength: PASSWORD_RULES.minLength(password),
    uppercaseLetter: PASSWORD_RULES.uppercaseLetter(password),
    lowercaseLetter: PASSWORD_RULES.lowercaseLetter(password),
    number: PASSWORD_RULES.number(password),
    special: PASSWORD_RULES.special(password),
    onlyValidCharacters: PASSWORD_RULES.onlyValidCharacters(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const result = validatePassword(password);
  return Object.values(result).every(Boolean);
}

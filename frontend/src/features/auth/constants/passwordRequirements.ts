export type PasswordRequirement = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

export const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
  {
    id: "len",
    label: "Pelo menos 8 caracteres",
    test: (s) => s.length >= 8,
  },
  {
    id: "upper",
    label: "Uma letra maiúscula",
    test: (s) => /[A-Z]/.test(s),
  },
  {
    id: "lower",
    label: "Uma letra minúscula",
    test: (s) => /[a-z]/.test(s),
  },
  { id: "digit", label: "Um número", test: (s) => /[0-9]/.test(s) },
  {
    id: "symbol",
    label: "Um caractere especial (Ex: @, $, *, _)",
    test: (s) => /[^A-Za-z0-9]/.test(s),
  },
];

export const REGISTER_SUCCESS_MESSAGE =
  "Conta criada com sucesso. Faça login para continuar.";

export const CONNECTION_ERROR_MESSAGE =
  "Não foi possível conectar ao servidor. Tente novamente.";

export const INVALID_CREDENTIALS_MESSAGE = "E-mail ou senha incorretos.";
export const LOGIN_GENERIC_ERROR_MESSAGE =
  "Não foi possível entrar. Tente novamente.";

export const REGISTER_ALREADY_IN_USE_MESSAGE =
  "Algum dos dados informados já está cadastrado.";
export const REGISTER_INVALID_DATA_MESSAGE =
  "Verifique os dados informados e tente novamente.";
export const REGISTER_GENERIC_ERROR_MESSAGE =
  "Não foi possível criar a conta. Tente novamente.";

/** Keyed by the `details.field` the API sends with `ALREADY_IN_USE`. */
export const REGISTER_FIELD_IN_USE_MESSAGES = {
  email: "Este e-mail já está cadastrado.",
  registrationCode: "Esta matrícula já está cadastrada.",
  cndb: "Esta CNDB já está cadastrada.",
} as const;

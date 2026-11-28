export const REGISTER_SUCCESS_MESSAGE =
  "Conta criada com sucesso. Faça login para continuar.";

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

export const FORGOT_PASSWORD_SUCCESS_MESSAGE =
  "Se houver uma conta com esse e-mail, enviamos um código válido por 30 minutos. Confira também a caixa de spam.";

export const RESET_PASSWORD_SUCCESS_MESSAGE =
  "Senha redefinida. Entre com a nova senha.";

export const INVALID_RESET_CODE_MESSAGE = "Código inválido ou expirado.";

export const TOO_MANY_REQUESTS_MESSAGE =
  "Muitas tentativas. Aguarde alguns minutos e tente novamente.";

export const PASSWORD_RESET_GENERIC_ERROR_MESSAGE =
  "Não foi possível concluir. Tente novamente.";

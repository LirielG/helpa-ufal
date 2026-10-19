// Same limits the backend enforces, which sizes them for the certificate's
// fixed layout. The backend exports no constants to the frontend, so they are
// declared again here.
export const FULL_NAME_MAX_LENGTH = 120;
export const ACTIVITY_TITLE_MAX_LENGTH = 150;

export const FULL_NAME_TOO_LONG_MESSAGE = `O nome deve ter no máximo ${FULL_NAME_MAX_LENGTH} caracteres.`;
export const ACTIVITY_TITLE_TOO_LONG_MESSAGE = `O título deve ter no máximo ${ACTIVITY_TITLE_MAX_LENGTH} caracteres.`;

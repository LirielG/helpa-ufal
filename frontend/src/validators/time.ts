import { z } from "zod";

/** 24h `hh:mm` between 00:00 and 23:59, the format the time field delivers. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const INVALID_TIME_MESSAGE = "Informe um horário válido (hh:mm).";

/** Empty keeps the screen's own "required" message; anything else must be `hh:mm`. */
export function timeSchema(requiredMessage: string) {
  return z
    .string()
    .min(1, requiredMessage)
    .regex(TIME_PATTERN, INVALID_TIME_MESSAGE);
}

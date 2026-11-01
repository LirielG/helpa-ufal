import { z } from "zod";
import {
  ACTIVITY_TITLE_MAX_LENGTH,
  ACTIVITY_TITLE_TOO_LONG_MESSAGE,
} from "./limits";

export function activityTitleSchemaFor(savedTitle?: string) {
  return z
    .string()
    .trim()
    .min(1, "O título é obrigatório")
    .max(ACTIVITY_TITLE_MAX_LENGTH, ACTIVITY_TITLE_TOO_LONG_MESSAGE)
    .refine(
      // Older actions may keep a short title when only other fields change.
      (title) => title.length >= 3 || title === savedTitle?.trim(),
      "O título deve ter no mínimo 3 caracteres",
    );
}

export const activityTitleSchema = activityTitleSchemaFor();

/** Shared by the create and edit forms so the two cannot drift apart again. */
export const activityDescriptionSchema = z
  .string()
  .trim()
  .min(1, "A descrição é obrigatória")
  .min(10, "A descrição deve ter no mínimo 10 caracteres");

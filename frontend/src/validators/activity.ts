import { z } from "zod";

/** Shared by the create and edit forms so the two cannot drift apart again. */
export const activityDescriptionSchema = z
  .string()
  .trim()
  .min(1, "A descrição é obrigatória")
  .min(10, "A descrição deve ter no mínimo 10 caracteres");

import { z } from "zod";
import { isPasswordValid } from "@/utils/password.js";

const passwordField = z.string().refine(isPasswordValid, {
  message:
    "A senha deve ter pelo menos 8 caracteres e incluir uma letra maiúscula, uma letra minúscula, um número e um caractere especial.",
});

export const UpdateUserSchema = z.object({
  fullName: z.string().min(1, "O nome completo não pode ser vazio.").optional(),
  email: z.string().email("E-mail inválido.").optional(),
  password: passwordField.optional(),
  course: z.string().optional(),
  registrationCode: z.string().optional(),
  cndb: z.string().optional(),
});

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;


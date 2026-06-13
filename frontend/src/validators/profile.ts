import { z } from "zod";
import { PASSWORD_REQUIREMENTS } from "../features/auth/constants/passwordRequirements";

export const EditProfileSchema = z.object({
  fullName: z.string().min(1, "Nome é obrigatório"),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  password: z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      if (!value) return;
      for (const req of PASSWORD_REQUIREMENTS) {
        if (!req.test(value)) {
          ctx.addIssue({ code: "custom", message: req.label });
        }
      }
    }),
});

export type EditProfileFields = z.infer<typeof EditProfileSchema>;

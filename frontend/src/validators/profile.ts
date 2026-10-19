import { z } from "zod";
import { PASSWORD_REQUIREMENTS } from "../features/auth/constants/passwordRequirements";
import { FULL_NAME_MAX_LENGTH, FULL_NAME_TOO_LONG_MESSAGE } from "./limits";

export const EditProfileSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(1, "Nome é obrigatório")
      .max(FULL_NAME_MAX_LENGTH, FULL_NAME_TOO_LONG_MESSAGE),
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmNewPassword: z.string(),
  })
  .superRefine(({ currentPassword, newPassword, confirmNewPassword }, ctx) => {
    // The password block is optional as a whole: left empty, only the name is
    // saved; touched at all, all three fields become required.
    if (!currentPassword && !newPassword && !confirmNewPassword) return;

    if (!currentPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["currentPassword"],
        message: "Informe a senha atual",
      });
    }

    if (!newPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "Informe a nova senha",
      });
    } else if (!PASSWORD_REQUIREMENTS.every((req) => req.test(newPassword))) {
      // Which rule failed is already shown by the checklist under the field.
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "A nova senha não atende aos requisitos.",
      });
    }

    if (confirmNewPassword !== newPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmNewPassword"],
        message: "As senhas não correspondem",
      });
    }
  });

export type EditProfileFields = z.infer<typeof EditProfileSchema>;

import { z } from "zod";
import { FULL_NAME_MAX_LENGTH } from "@/schemas/common/FieldLimits.js";
import { isPasswordValid } from "@/utils/password.js";
import { USER_CODE_LENGTH } from "@/utils/userCode.js";
import { normalizeValidationCode } from "@/utils/validationCode.js";

export const emailField = z.string().trim().toLowerCase().pipe(z.email());
export const LoginSchema = z.object({
  email: emailField,
  password: z.string().min(1),
});

export const passwordField = z.string().refine(isPasswordValid, {
  message:
    "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.",
});

// Accepts what a person types or pastes (lowercase, hyphens, Unicode dashes,
// O for 0) and outputs the stored form.
const resetCodeField = z.string().transform((value, ctx) => {
  const code = normalizeValidationCode(value, USER_CODE_LENGTH);
  if (!code) {
    ctx.addIssue({
      code: "custom",
      message: `Code must have ${USER_CODE_LENGTH} Crockford Base32 characters.`,
    });
    return z.NEVER;
  }
  return code;
});

export const ForgotPasswordSchema = z.object({ email: emailField });

export const VerifyResetCodeSchema = z.object({
  email: emailField,
  code: resetCodeField,
});

// A new password equal to the current one is accepted, unlike PATCH
// /users/me: whoever forgot it cannot know what the current one is.
export const ResetPasswordSchema = z.object({
  email: emailField,
  code: resetCodeField,
  newPassword: passwordField,
});

export const RegisterSchema = z.discriminatedUnion("userType", [
  z.object({
    userType: z.literal("STUDENT"),
    fullName: z.string().min(1).max(FULL_NAME_MAX_LENGTH),
    email: emailField,
    password: passwordField,
    course: z.string().min(1),
    registrationCode: z.string().min(1),
  }),

  z.object({
    userType: z.literal("TEACHER"),
    fullName: z.string().min(1).max(FULL_NAME_MAX_LENGTH),
    email: emailField,
    password: passwordField,
    course: z.string().optional(),
    registrationCode: z.string().min(1),
    cndb: z.string().min(1),
  }),
]);

export type Login = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type VerifyResetCodeInput = z.infer<typeof VerifyResetCodeSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

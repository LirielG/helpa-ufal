import { z } from "zod";
import { passwordField } from "@/schemas/auth/AuthSchemas.js";

type UserType = "STUDENT" | "TEACHER";

const IMMUTABLE = "This field cannot be updated.";
const EMPTY_BODY = "At least one updatable field must be provided.";
const CURRENT_REQUIRED = "Current password is required to set a new password.";

export function updateProfileSchemaFor(userType: UserType) {
  const allowedKeys =
    userType === "STUDENT"
      ? ["fullName", "currentPassword", "newPassword"]
      : ["fullName", "course", "currentPassword", "newPassword"];

  return z
    .any()
    .superRefine((val, ctx) => {
      if (typeof val !== "object" || val === null || Array.isArray(val)) {
        if (val === undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["body"],
            message: EMPTY_BODY,
          });
          return;
        }
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Expected object, received " +
            (Array.isArray(val) ? "array" : val === null ? "null" : typeof val),
        });
        return;
      }

      const input = val as Record<string, unknown>;
      const keys = Object.keys(input);

      let hasUnknownKeys = false;
      for (const key of keys) {
        if (!allowedKeys.includes(key)) {
          hasUnknownKeys = true;
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: IMMUTABLE,
          });
        }
      }

      const hasUpdatableField =
        input.fullName !== undefined ||
        (userType === "TEACHER" && input.course !== undefined) ||
        input.newPassword !== undefined;

      if (!hasUpdatableField && !hasUnknownKeys) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["body"],
          message: EMPTY_BODY,
        });
      }

      if (input.newPassword !== undefined) {
        if (
          input.currentPassword === undefined ||
          input.currentPassword === null ||
          input.currentPassword === ""
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["currentPassword"],
            message: CURRENT_REQUIRED,
          });
        }
      }
    })
    .pipe(
      z.object({
        fullName: z.string().trim().min(1).optional(),
        course:
          userType === "TEACHER"
            ? z.string().trim().min(1).nullable().optional()
            : z.never().optional(),
        currentPassword: z.string().optional(),
        newPassword: passwordField.optional(),
      }),
    );
}

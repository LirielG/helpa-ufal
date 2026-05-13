import { z } from "zod";
import { isPasswordValid } from "@/utils/password.js";

export const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const passwordField = z.string().refine(isPasswordValid, {
  message:
    "Password must be at least 8 characters long and include an uppercase letter, a lowercase letter, a number, and a special character.",
});

export const RegisterSchema = z.discriminatedUnion("userType", [
  z.object({
    userType: z.literal("STUDENT"),
    fullName: z.string().min(1),
    email: z.email(),
    password: passwordField,
    course: z.string().min(1),
    registrationCode: z.string().min(1),
  }),

  z.object({
    userType: z.literal("TEACHER"),
    fullName: z.string().min(1),
    email: z.email(),
    password: passwordField,
    course: z.string().optional(),
    registrationCode: z.string().min(1),
    cndb: z.string().min(1),
  }),
]);

export type Login = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;

import { z } from "zod";

import { UserType } from "@prisma/client";


export const LoginSchema = z.object({
  email:        z.email(),
  password:     z.string().min(1),
});

export const RegisterSchema = z.discriminatedUnion("userType", [
    z.object({
    userType:         z.literal("STUDENT"),
    fullName:         z.string().min(1),
    email:            z.email(),
    password:         z.string().min(8),
    course:           z.string().min(1),
    registrationCode: z.string().min(1),
  }),

  z.object({
    userType:         z.literal("TEACHER"),
    fullName:         z.string().min(1),
    email:            z.email(),
    password:         z.string().min(8),
    course:           z.string().optional(),
    registrationCode: z.string().min(1),
    cndb:             z.string().min(1),
  }),

  z.object({
    userType:    z.literal("EXTERNAL"),
    fullName:    z.string().min(1),
    email:       z.email(),
    password:    z.string().min(8),
    course:      z.string().optional(),
    institution: z.string().optional(),
  }),
]);


export type Login         = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;

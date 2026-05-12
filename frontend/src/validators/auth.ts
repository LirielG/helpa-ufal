import { z } from "zod";

export interface ValidationError {
  field: string;
  message: string;
}

// ---- ZOD SCHEMAS ----

export const LoginSchema = z.object({
  email: z
    .string({ required_error: "E-mail é obrigatório" })
    .min(1, "E-mail é obrigatório")
    .email("E-mail inválido"),
  password: z
    .string({ required_error: "Senha é obrigatória" })
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(128, "Senha deve ter no máximo 128 caracteres")
    .regex(/[A-Z]/, "A senha deve ter pelo menos 1 letra maiúscula")
    .regex(/[a-z]/, "A senha deve ter pelo menos 1 letra minúscula")
    .regex(/[^A-Za-z0-9]/, "A senha deve ter pelo menos 1 caractere especial")
});

export const RegisterSchema = z.discriminatedUnion("userType", [
  z.object({
    userType: z.literal("student"),
    name: z.string({ required_error: "Nome é obrigatório" }).min(1, "Nome é obrigatório"),
    email: z.string({ required_error: "E-mail é obrigatório" }).email("E-mail inválido"),
    password: z.string({ required_error: "Senha é obrigatória" }).min(8, "Senha deve ter no mínimo 8 caracteres"),
    confirmPassword: z.string({ required_error: "Confirmação de senha é obrigatória" }),
    course: z.string({ required_error: "Curso é obrigatório" }).min(1, "Curso é obrigatório"),
    enrollment: z.string({ required_error: "Matrícula é obrigatória" }).min(1, "Matrícula é obrigatória"),
  }),

  z.object({
    userType: z.literal("teacher"),
    name: z.string({ required_error: "Nome é obrigatório" }).min(1, "Nome é obrigatório"),
    email: z.string({ required_error: "E-mail é obrigatório" }).email("E-mail inválido"),
    password: z.string({ required_error: "Senha é obrigatória" }).min(8, "Senha deve ter no mínimo 8 caracteres"),
    confirmPassword: z.string({ required_error: "Confirmação de senha é obrigatória" }),
    course: z.string().optional(),
    enrollment: z.string({ required_error: "Código de registro é obrigatório" }).min(1, "Código de registro é obrigatório"),
    cndbNumber: z.string({ required_error: "CNDB é obrigatório" }).min(1, "CNDB é obrigatório"),
  }),

  z.object({
    userType: z.literal("external"),
    name: z.string({ required_error: "Nome é obrigatório" }).min(1, "Nome é obrigatório"),
    email: z.string({ required_error: "E-mail é obrigatório" }).email("E-mail inválido"),
    password: z.string({ required_error: "Senha é obrigatória" }).min(8, "Senha deve ter no mínimo 8 caracteres"),
    confirmPassword: z.string({ required_error: "Confirmação de senha é obrigatória" }),
    course: z.string().optional(),
    institution: z.string().optional(),
  }),
]).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não correspondem",
  path: ["confirmPassword"],
});

// ---- UTILS PARA TRANSFORMAR ERROS ZOD PARA ValidationError ----

export function zodToValidationErrors(zodErr: z.ZodError): ValidationError[] {
  return zodErr.errors.map((err) => ({
    field: err.path[0]?.toString() || "form",
    message: err.message,
  }));
}

// ---- VALIDATORS NOVOS (wrapper para retrocompatibilidade) ----

export function validateLoginForm(email: string, password: string): ValidationError[] {
  const result = LoginSchema.safeParse({ email, password });
  if (result.success) return [];
  return zodToValidationErrors(result.error);
}

export function validateRegisterForm(formData: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  institution?: string;
  cndbNumber?: string;
  course?: string;
  enrollment?: string;
  userType: string;
}): ValidationError[] {
  const result = RegisterSchema.safeParse(formData);
  if (result.success) return [];
  return zodToValidationErrors(result.error);
}

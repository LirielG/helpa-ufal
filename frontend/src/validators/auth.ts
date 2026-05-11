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

export const RegisterSchema = z.object({
  name: z
    .string({ required_error: "Nome é obrigatório" })
    .min(3, "Nome deve ter no mínimo 3 caracteres")
    .max(255, "Nome deve ter no máximo 255 caracteres"),
  email: z
    .string({ required_error: "E-mail é obrigatório" })
    .email("E-mail inválido"),
  password: z
    .string({ required_error: "Senha é obrigatória" })
    .min(8, "Senha deve ter no mínimo 8 caracteres")
    .max(128, "Senha deve ter no máximo 128 caracteres")
    .regex(/[A-Z]/, "A senha deve ter pelo menos 1 letra maiúscula")
    .regex(/[a-z]/, "A senha deve ter pelo menos 1 letra minúscula")
    .regex(/[^A-Za-z0-9]/, "A senha deve ter pelo menos 1 caractere especial"),
  confirmPassword: z
    .string({ required_error: "Confirmação de senha é obrigatória" }),
  userType: z.enum(["student", "teacher", "external"], {
    required_error: "Tipo de usuário é obrigatório"
  }),
  institution: z.string().optional(), // obrigatório para student/teacher, validamos em refinamento
  cndbNumber: z.string().optional(),  // obrigatório teacher
  course: z.string().optional(),      // obrigatório student
  enrollment: z.string().optional(),  // obrigatório student
}).refine((data) => data.password === data.confirmPassword, {
  path: ["confirmPassword"],
  message: "As senhas não correspondem"
}).superRefine((data, ctx) => {
  if (data.userType === "student") {
    if (!data.institution) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["institution"], message: "Instituição é obrigatória" });
    if (!data.course) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["course"], message: "Curso é obrigatório" });
    if (!data.enrollment) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["enrollment"], message: "Matrícula é obrigatória" });
  }
  if (data.userType === "teacher") {
    if (!data.institution) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["institution"], message: "Instituição é obrigatória" });
    if (!data.cndbNumber) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cndbNumber"], message: "CNDB é obrigatório" });
  }
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

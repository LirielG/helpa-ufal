import { RegisterSchema } from "@/schemas/auth/AuthSchemas.js";

export default function registrationPolicyMessage(): string {
  const result = RegisterSchema.safeParse({
    userType: "STUDENT", fullName: "x", email: "a@ufal.br",
    password: "weak", course: "x", registrationCode: "x",
  });
  const issue = result.error?.issues.find((i) => i.path.join(".") === "password");
  if (!issue) throw new Error("Registration schema no longer validates password.");
  return issue.message;
}
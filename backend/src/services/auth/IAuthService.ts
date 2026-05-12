import type { Login } from "@/schemas/auth/AuthSchemas.js";
import type { LoginUser } from "@/types/auth.js";

export interface IAuthService {
  login(data: Login): Promise<{ token: string; user: LoginUser }>;
}

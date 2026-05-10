import type { Login } from "@/schemas/auth/AuthSchemas.js";
import type { AuthenticatedUser } from "@/types/auth.js";

export interface IAuthService {
  login(data: Login): Promise<{ token: string; user: AuthenticatedUser }>;
}

import type { Login, RegisterInput } from "@/schemas/auth/AuthSchemas.js";
import type { AuthenticatedUser } from "@/types/auth.js";

export interface IAuthService {
  login(data: Login): Promise<{ token: string; user: AuthenticatedUser }>;
  register(
    data: RegisterInput,
  ): Promise<{ token: string; user: AuthenticatedUser }>;
}

import type { Login, RegisterInput } from "@/schemas/auth/AuthSchemas.js";
import type { UserResponse } from "@/types/auth.js";

export interface IAuthService {
  login(data: Login): Promise<{ token: string; user: UserResponse }>;
  register(data: RegisterInput): Promise<{ token: string; user: UserResponse }>;
}

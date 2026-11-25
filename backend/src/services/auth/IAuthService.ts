import type {
  ForgotPasswordInput,
  Login,
  RegisterInput,
  ResetPasswordInput,
  VerifyResetCodeInput,
} from "@/schemas/auth/AuthSchemas.js";
import type { UserResponse } from "@/types/auth.js";

export interface IAuthService {
  login(data: Login): Promise<{ token: string; user: UserResponse }>;
  register(data: RegisterInput): Promise<UserResponse>;
  requestPasswordReset(data: ForgotPasswordInput): Promise<void>;
  verifyResetCode(data: VerifyResetCodeInput): Promise<void>;
  resetPassword(data: ResetPasswordInput): Promise<void>;
}

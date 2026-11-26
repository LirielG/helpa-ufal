import UserRepository from "@/repositories/auth/UserRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import UserCodeRepository from "@/repositories/auth/UserCodeRepository.js";
import type { IUserCodeRepository } from "@/repositories/auth/IUserCodeRepository.js";
import type { IAuthService } from "@/services/auth/IAuthService.js";
import EmailService from "@/services/email/EmailService.js";
import type { IEmailService } from "@/services/email/IEmailService.js";
import CustomError from "@/models/error/CustomError.js";
import ValidationError from "@/models/error/ValidationError.js";
import bcryptjs from "bcryptjs";
import { env } from "@/config/env.js";
import { signJwt } from "@/utils/jwt.js";
import { BCRYPT_SALT_ROUNDS } from "@/utils/password.js";
import { firstName } from "@/utils/firstName.js";
import { uniqueViolationFields } from "@/utils/prismaErrors.js";
import { hashUserCode, USER_CODE_LENGTH } from "@/utils/userCode.js";
import {
  formatValidationCode,
  generateValidationCode,
} from "@/utils/validationCode.js";
import type {
  ForgotPasswordInput,
  Login,
  RegisterInput,
  ResetPasswordInput,
  VerifyResetCodeInput,
} from "@/schemas/auth/AuthSchemas.js";
import type { AuthenticatedUser, UserResponse } from "@/types/auth.js";

type Props = {
  userRepository?: IUserRepository;
  userCodeRepository?: IUserCodeRepository;
  emailService?: IEmailService;
};

const RESET_CODE_TTL_MS = 30 * 60_000;
const MAX_CODE_ATTEMPTS = 3;
const INVALID_RESET_CODE_MESSAGE =
  "The reset code is invalid, expired or already used.";

// The same answer for an unknown, expired or used code, so a response never
// tells which of them it was.
function invalidResetCode(): ValidationError {
  return new ValidationError(
    [
      {
        field: "code",
        code: "INVALID_RESET_CODE",
        message: INVALID_RESET_CODE_MESSAGE,
      },
    ],
    INVALID_RESET_CODE_MESSAGE,
    { status: 422, code: "INVALID_RESET_CODE" },
  );
}

class AuthService implements IAuthService {
  private _userRepository: IUserRepository;
  private _userCodeRepository: IUserCodeRepository;
  private _emailService: IEmailService;

  constructor(props?: Props) {
    this._userRepository = props?.userRepository ?? new UserRepository();
    this._userCodeRepository =
      props?.userCodeRepository ?? new UserCodeRepository();
    this._emailService = props?.emailService ?? new EmailService();
  }

  public async login(
    data: Login,
  ): Promise<{ token: string; user: UserResponse }> {
    const user = await this._userRepository.findByEmail(data.email);

    if (!user) {
      throw new CustomError(401, "Invalid credentials.");
    }

    const passwordMatch = await bcryptjs.compare(
      data.password,
      user.passwordHash,
    );

    if (!passwordMatch) {
      throw new CustomError(401, "Invalid credentials.");
    }

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      userType: user.userType,
      isManager: user.isManager,
      tokenVersion: user.tokenVersion,
    };

    const loginUser: UserResponse = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      userType: user.userType,
      isManager: user.isManager,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const token = signJwt(authenticatedUser);

    return { token, user: loginUser };
  }

  public async register(data: RegisterInput): Promise<UserResponse> {
    const existingUser = await this._userRepository.findByEmail(data.email);

    if (existingUser) {
      throw new CustomError(409, "Email already in use.", {
        code: "ALREADY_IN_USE",
        details: { field: "email" },
      });
    }

    const passwordHash = await bcryptjs.hash(data.password, BCRYPT_SALT_ROUNDS);

    const newUser = await this._userRepository.createWithSubtype({
      ...data,
      passwordHash,
    });

    const userResponse: UserResponse = {
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      userType: newUser.userType,
      isManager: newUser.isManager,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
    };

    return userResponse;
  }

  // Resolves the same way whether or not the e-mail has an account, and never
  // waits for the SMTP server, so neither the answer nor its timing depends
  // on the delivery.
  public async requestPasswordReset({
    email,
  }: ForgotPasswordInput): Promise<void> {
    const user = await this._userRepository.findByEmail(email);
    if (!user) return;

    const code = await this._savePasswordResetCode(user.id);

    void this._emailService
      .send(user.email, "passwordResetCode", {
        firstName: firstName(user.fullName),
        code: formatValidationCode(code),
        // In the fragment, the code is never sent to a server nor leaked in
        // the Referer header.
        resetUrl: `${env.APP_PUBLIC_URL}/reset-password#code=${code}`,
      })
      .catch((error) =>
        console.error("[AuthService] Password reset email failed:", error),
      );
  }

  // Checks without consuming: the code is only used up by resetPassword.
  public async verifyResetCode({ code }: VerifyResetCodeInput): Promise<void> {
    const isValid = await this._userCodeRepository.existsValid(
      "PASSWORD_RESET",
      hashUserCode(code),
      new Date(),
    );
    if (!isValid) throw invalidResetCode();
  }

  // Sessions are not created here: after the reset the user signs in again.
  public async resetPassword({
    code,
    newPassword,
  }: ResetPasswordInput): Promise<void> {
    const tokenHash = hashUserCode(code);

    // Checked before bcrypt, so a guessed code does not cost the server a
    // hash. The check does not replace the one in the transaction below,
    // which is what stops two requests from using the same code.
    const isValid = await this._userCodeRepository.existsValid(
      "PASSWORD_RESET",
      tokenHash,
      new Date(),
    );
    if (!isValid) throw invalidResetCode();

    // Hashed before the transaction, so bcrypt does not hold it open.
    const passwordHash = await bcryptjs.hash(newPassword, BCRYPT_SALT_ROUNDS);

    const user = await this._userCodeRepository.resetPassword(
      tokenHash,
      passwordHash,
      new Date(),
    );
    if (!user) throw invalidResetCode();

    void this._emailService
      .send(user.email, "passwordChanged", {
        firstName: firstName(user.fullName),
      })
      .catch((error) =>
        console.error("[AuthService] Password changed email failed:", error),
      );
  }

  // A unique violation means the hash collided with another user's pending
  // code, or a concurrent request for the same user created the row first;
  // either way a fresh code fixes it.
  private async _savePasswordResetCode(userId: string): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      const code = generateValidationCode(USER_CODE_LENGTH);
      try {
        await this._userCodeRepository.save({
          userId,
          type: "PASSWORD_RESET",
          tokenHash: hashUserCode(code),
          expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
        });
        return code;
      } catch (error) {
        if (attempt >= MAX_CODE_ATTEMPTS || !uniqueViolationFields(error)) {
          throw error;
        }
      }
    }
  }
}
export default AuthService;

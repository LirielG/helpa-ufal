import UserRepository from "@/repositories/auth/UserRepository.js";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import UserCodeRepository from "@/repositories/auth/UserCodeRepository.js";
import type {
  IUserCodeRepository,
  PendingUserCode,
} from "@/repositories/auth/IUserCodeRepository.js";
import type { IAuthService } from "@/services/auth/IAuthService.js";
import EmailService from "@/services/email/EmailService.js";
import type { IEmailService } from "@/services/email/IEmailService.js";
import CustomError from "@/models/error/CustomError.js";
import ValidationError from "@/models/error/ValidationError.js";
import bcryptjs from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/config/env.js";
import { signJwt } from "@/utils/jwt.js";
import { BCRYPT_SALT_ROUNDS } from "@/utils/password.js";
import { firstName } from "@/utils/user.js";
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
// With 40 bits, five guesses per code leave an attacker no real chance even
// across many IPs, and still forgive a few typos.
const MAX_FAILED_RESET_ATTEMPTS = 5;
const INVALID_RESET_CODE_MESSAGE =
  "The reset code is invalid, expired or already used.";

// The same answer for an unknown e-mail and for a missing, expired, wrong or
// exhausted code, so the response body never tells which of them it was, nor
// whether the e-mail has an account.
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

    const code = generateValidationCode(USER_CODE_LENGTH);
    await this._userCodeRepository.save({
      userId: user.id,
      type: "PASSWORD_RESET",
      tokenHash: hashUserCode(code),
      expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
    });

    void this._emailService
      .send(user.email, "passwordResetCode", {
        firstName: firstName(user.fullName),
        code: formatValidationCode(code),
        // In the fragment, the e-mail and the code are never sent to a server
        // nor leaked in the Referer header.
        resetUrl: `${env.HELPA_PUBLIC_URL}/reset-password#email=${encodeURIComponent(user.email)}&code=${code}`,
      })
      .catch((error) =>
        console.error("[AuthService] Password reset email failed:", error),
      );
  }

  // Checks without consuming: the code is only used up by resetPassword.
  public async verifyResetCode({
    email,
    code,
  }: VerifyResetCodeInput): Promise<void> {
    await this._checkResetCode(email, code);
  }

  // Sessions are not created here: after the reset the user signs in again.
  public async resetPassword({
    email,
    code,
    newPassword,
  }: ResetPasswordInput): Promise<void> {
    // Checked before bcrypt, so a guessed code does not cost the server a
    // hash. The check does not replace the one in the transaction below,
    // which is what stops two requests from using the same code.
    const pending = await this._checkResetCode(email, code);

    // Hashed before the transaction, so bcrypt does not hold it open.
    const passwordHash = await bcryptjs.hash(newPassword, BCRYPT_SALT_ROUNDS);

    const user = await this._userCodeRepository.resetPassword(
      pending.id,
      pending.tokenHash,
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

  // The code is matched only against the pending code of the account with
  // that e-mail, so a guess tests a single account. The attempt is taken
  // before comparing, so guesses in flight already count and concurrent
  // requests cannot test more than MAX_FAILED_RESET_ATTEMPTS codes; a right
  // guess gives its attempt back. A wrong guess that took the last attempt
  // may also delete the code under a right guess still in flight, which then
  // fails too: on a race the limit wins.
  private async _checkResetCode(
    email: string,
    code: string,
  ): Promise<PendingUserCode> {
    const user = await this._userRepository.findByEmail(email);
    if (!user) throw invalidResetCode();

    const pending = await this._userCodeRepository.findValid(
      user.id,
      "PASSWORD_RESET",
      new Date(),
    );
    if (!pending) throw invalidResetCode();

    const reserved = await this._userCodeRepository.reserveAttempt(
      pending.id,
      pending.tokenHash,
      MAX_FAILED_RESET_ATTEMPTS,
    );
    if (!reserved) throw invalidResetCode();

    const isMatch = timingSafeEqual(
      Buffer.from(pending.tokenHash, "hex"),
      Buffer.from(hashUserCode(code), "hex"),
    );
    if (!isMatch) {
      await this._userCodeRepository.deleteIfExhausted(
        pending.id,
        pending.tokenHash,
        MAX_FAILED_RESET_ATTEMPTS,
      );
      throw invalidResetCode();
    }

    await this._userCodeRepository.releaseAttempt(
      pending.id,
      pending.tokenHash,
    );
    return pending;
  }
}
export default AuthService;

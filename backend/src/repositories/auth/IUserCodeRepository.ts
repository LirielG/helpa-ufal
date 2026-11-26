import type { User, UserCodeType } from "@prisma/client";

export type SaveUserCodeData = {
  userId: string;
  type: UserCodeType;
  tokenHash: string;
  expiresAt: Date;
};

export interface IUserCodeRepository {
  // Replaces the user's pending code of that type, if any.
  save(data: SaveUserCodeData): Promise<void>;
  existsValid(
    type: UserCodeType,
    tokenHash: string,
    now: Date,
  ): Promise<boolean>;
  // Consumes a valid password reset code and sets the new password in one
  // transaction. Returns null when the code is unknown, expired or used.
  resetPassword(
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<User | null>;
}

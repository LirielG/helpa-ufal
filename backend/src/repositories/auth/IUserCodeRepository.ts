import type { User, UserCodeType } from "@prisma/client";

export type SaveUserCodeData = {
  userId: string;
  type: UserCodeType;
  tokenHash: string;
  expiresAt: Date;
};

export type PendingUserCode = {
  id: string;
  tokenHash: string;
};

export interface IUserCodeRepository {
  // Replaces the user's pending code of that type, if any, and clears its
  // failed attempts.
  save(data: SaveUserCodeData): Promise<void>;
  // The user's unexpired code of that type, or null.
  findValid(
    userId: string,
    type: UserCodeType,
    now: Date,
  ): Promise<PendingUserCode | null>;
  // Takes one of the code's attempts, atomically. Returns false when all
  // maxAttempts are taken or the code was replaced in the meantime.
  reserveAttempt(
    id: string,
    tokenHash: string,
    maxAttempts: number,
  ): Promise<boolean>;
  // Gives back an attempt taken by a right guess.
  releaseAttempt(id: string, tokenHash: string): Promise<void>;
  // Deletes the code once all maxAttempts are taken.
  deleteIfExhausted(
    id: string,
    tokenHash: string,
    maxAttempts: number,
  ): Promise<void>;
  // Consumes a valid password reset code and sets the new password in one
  // transaction. Returns null when the code is expired, used or replaced.
  resetPassword(
    id: string,
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<User | null>;
}

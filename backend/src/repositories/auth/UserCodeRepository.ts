import type { PrismaClient, User, UserCodeType } from "@prisma/client";
import { prisma } from "@/database/prisma.js";
import type {
  IUserCodeRepository,
  PendingUserCode,
  SaveUserCodeData,
} from "@/repositories/auth/IUserCodeRepository.js";

type Props = {
  prisma?: PrismaClient;
};

class UserCodeRepository implements IUserCodeRepository {
  private _prisma: PrismaClient;

  constructor(props?: Props) {
    this._prisma = props?.prisma ?? prisma;
  }

  public async save({
    userId,
    type,
    tokenHash,
    expiresAt,
  }: SaveUserCodeData): Promise<void> {
    // Prisma runs this as INSERT ... ON CONFLICT ("userId", "type"), so two
    // concurrent requests for the same user never raise a unique violation.
    await this._prisma.userCode.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, tokenHash, expiresAt },
      update: {
        tokenHash,
        expiresAt,
        failedAttempts: 0,
        createdAt: new Date(),
      },
    });
  }

  public async findValid(
    userId: string,
    type: UserCodeType,
    now: Date,
  ): Promise<PendingUserCode | null> {
    return this._prisma.userCode.findFirst({
      where: { userId, type, expiresAt: { gt: now } },
      select: { id: true, tokenHash: true },
    });
  }

  // The WHERE is re-checked under the row lock, so concurrent guesses cannot
  // take more than maxAttempts between them. Filtering by tokenHash keeps a
  // guess against a replaced code from counting against the new one, since
  // the upsert in save keeps the row id.
  public async reserveAttempt(
    id: string,
    tokenHash: string,
    maxAttempts: number,
  ): Promise<boolean> {
    const { count } = await this._prisma.userCode.updateMany({
      where: { id, tokenHash, failedAttempts: { lt: maxAttempts } },
      data: { failedAttempts: { increment: 1 } },
    });
    return count > 0;
  }

  public async releaseAttempt(id: string, tokenHash: string): Promise<void> {
    await this._prisma.userCode.updateMany({
      where: { id, tokenHash, failedAttempts: { gt: 0 } },
      data: { failedAttempts: { decrement: 1 } },
    });
  }

  public async deleteIfExhausted(
    id: string,
    tokenHash: string,
    maxAttempts: number,
  ): Promise<void> {
    await this._prisma.userCode.deleteMany({
      where: { id, tokenHash, failedAttempts: { gte: maxAttempts } },
    });
  }

  public async resetPassword(
    id: string,
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<User | null> {
    const where = { id, tokenHash, expiresAt: { gt: now } };

    return this._prisma.$transaction(async (tx) => {
      const code = await tx.userCode.findFirst({
        where,
        select: { userId: true },
      });
      if (!code) return null;

      // Deleting is what makes the code single-use. Two concurrent requests
      // can both find the row, but the second delete waits on the first's
      // row lock and then matches nothing, so only one of them goes on.
      const { count } = await tx.userCode.deleteMany({ where });
      if (count === 0) return null;

      // A new password revokes every token issued before it.
      return tx.user.update({
        where: { id: code.userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      });
    });
  }
}

export default UserCodeRepository;

import type { PrismaClient, User, UserCodeType } from "@prisma/client";
import { prisma } from "@/database/prisma.js";
import type {
  IUserCodeRepository,
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
    await this._prisma.userCode.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, tokenHash, expiresAt },
      update: { tokenHash, expiresAt, createdAt: new Date() },
    });
  }

  public async existsValid(
    type: UserCodeType,
    tokenHash: string,
    now: Date,
  ): Promise<boolean> {
    const count = await this._prisma.userCode.count({
      where: { type, tokenHash, expiresAt: { gt: now } },
    });
    return count > 0;
  }

  public async resetPassword(
    tokenHash: string,
    passwordHash: string,
    now: Date,
  ): Promise<User | null> {
    const where = {
      type: "PASSWORD_RESET",
      tokenHash,
      expiresAt: { gt: now },
    } as const;

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

import type { PrismaClient, User } from "@prisma/client";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import { prisma } from "@/database/prisma.js";

type Props = {
  prisma?: PrismaClient;
};

class UserRepository implements IUserRepository {
  private _prisma: PrismaClient;

  constructor(props?: Props) {
    this._prisma = props?.prisma ?? prisma;
  }

  public async findByEmail(email: string): Promise<User | null> {
    return this._prisma.user.findUnique({ where: { email } });
  }
}

export default UserRepository;

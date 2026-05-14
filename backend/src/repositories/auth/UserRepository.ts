import type { PrismaClient, User } from "@prisma/client";
import type { IUserRepository } from "@/repositories/auth/IUserRepository.js";
import { prisma } from "@/database/prisma.js";
import { RegisterInput } from "@/schemas/auth/AuthSchemas.js";

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

  public async createWithSubtype(
    data: RegisterInput & { passwordHash: string },
  ): Promise<User> {
    return this._prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: data.fullName,
          email: data.email,
          passwordHash: data.passwordHash,
          userType: data.userType,
          isManager: false,
        },
      });

      switch (data.userType) {
        case "STUDENT":
          await tx.student.create({
            data: {
              userId: user.id,
              registrationCode: data.registrationCode,
              course: data.course,
            },
          });
          break;

        case "TEACHER":
          await tx.teacher.create({
            data: {
              userId: user.id,
              registrationCode: data.registrationCode,
              cndb: data.cndb,
              course: data.course,
            },
          });
          break;
      }

      return user;
    });
  }
}

export default UserRepository;

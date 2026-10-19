import type { PrismaClient, User } from "@prisma/client";
import type {
  IUserRepository,
  UpdateProfileData,
  UserWithProfile,
  UserWithProfileAndHash,
} from "@/repositories/auth/IUserRepository.js";
import { prisma } from "@/database/prisma.js";
import { RegisterInput } from "@/schemas/auth/AuthSchemas.js";
type Props = {
  prisma?: PrismaClient;
};

const PROFILE_SELECT = {
  id: true,
  fullName: true,
  email: true,
  userType: true,
  isManager: true,
  createdAt: true,
  student: { select: { registrationCode: true, course: true } },
  teacher: {
    select: { registrationCode: true, course: true, cndb: true },
  },
} as const;

class UserRepository implements IUserRepository {
  private _prisma: PrismaClient;

  constructor(props?: Props) {
    this._prisma = props?.prisma ?? prisma;
  }

  public async findByEmail(email: string): Promise<User | null> {
    return this._prisma.user.findUnique({ where: { email } });
  }

  public async findById(id: string): Promise<UserWithProfileAndHash | null> {
    return this._prisma.user.findUnique({
      where: { id },
      select: {
        ...PROFILE_SELECT,
        passwordHash: true,
      },
    });
  }

  public async findTokenVersionById(
    id: string,
  ): Promise<{ tokenVersion: number } | null> {
    return this._prisma.user.findUnique({
      where: { id },
      select: { tokenVersion: true },
    });
  }

  public async findProfileById(id: string): Promise<UserWithProfile | null> {
    return this._prisma.user.findUnique({
      where: { id },
      select: PROFILE_SELECT,
    });
  }

  public async updateProfile(
    id: string,
    data: UpdateProfileData,
  ): Promise<UserWithProfile> {
    return this._prisma.$transaction(async (tx) => {
      if (data.fullName !== undefined || data.passwordHash !== undefined) {
        await tx.user.update({
          where: { id },
          data: {
            ...(data.fullName !== undefined && { fullName: data.fullName }),
            // A new password revokes every token issued before it, including
            // the one making this request.
            ...(data.passwordHash !== undefined && {
              passwordHash: data.passwordHash,
              tokenVersion: { increment: 1 },
            }),
          },
        });
      }

      if (data.course !== undefined) {
        await tx.teacher.update({
          where: { userId: id },
          data: { course: data.course },
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id },
        select: PROFILE_SELECT,
      });
    });
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

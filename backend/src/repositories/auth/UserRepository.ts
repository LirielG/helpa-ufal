import type { PrismaClient, User, UserType } from "@prisma/client";
import type {
  IUserRepository,
  UpdateUserData,
  UserWithSubtype,
} from "@/repositories/auth/IUserRepository.js";
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

  public async findById(id: string): Promise<UserWithSubtype | null> {
    return this._prisma.user.findUnique({
      where: { id },
      include: {
        student: true,
        teacher: true,
      },
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

  public async updateUser(
    id: string,
    userType: UserType,
    data: UpdateUserData,
  ): Promise<UserWithSubtype> {
    return this._prisma.$transaction(async (tx) => {
      const userUpdateData: {
        fullName?: string;
        email?: string;
        passwordHash?: string;
      } = {};

      if (data.fullName !== undefined) userUpdateData.fullName = data.fullName;
      if (data.email !== undefined) userUpdateData.email = data.email;
      if (data.passwordHash !== undefined)
        userUpdateData.passwordHash = data.passwordHash;

      if (Object.keys(userUpdateData).length > 0) {
        await tx.user.update({
          where: { id },
          data: userUpdateData,
        });
      }

      if (userType === "STUDENT") {
        const studentUpdateData: {
          registrationCode?: string;
          course?: string;
        } = {};
        if (data.registrationCode !== undefined)
          studentUpdateData.registrationCode = data.registrationCode;
        if (data.course !== undefined)
          studentUpdateData.course = data.course;

        if (Object.keys(studentUpdateData).length > 0) {
          await tx.student.upsert({
            where: { userId: id },
            update: studentUpdateData,
            create: {
              userId: id,
              registrationCode: data.registrationCode ?? "",
              course: data.course ?? "",
            },
          });
        }
      } else if (userType === "TEACHER") {
        const teacherUpdateData: {
          registrationCode?: string;
          course?: string;
          cndb?: string;
        } = {};
        if (data.registrationCode !== undefined)
          teacherUpdateData.registrationCode = data.registrationCode;
        if (data.course !== undefined)
          teacherUpdateData.course = data.course;
        if (data.cndb !== undefined) teacherUpdateData.cndb = data.cndb;

        if (Object.keys(teacherUpdateData).length > 0) {
          await tx.teacher.upsert({
            where: { userId: id },
            update: teacherUpdateData,
            create: {
              userId: id,
              registrationCode: data.registrationCode ?? "",
              cndb: data.cndb ?? "",
              course: data.course,
            },
          });
        }
      }

      return tx.user.findUniqueOrThrow({
        where: { id },
        include: {
          student: true,
          teacher: true,
        },
      });
    });
  }
}

export default UserRepository;


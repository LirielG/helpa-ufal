import type { PrismaClient, User, Student, Teacher, External } from "@prisma/client";
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

  public async create(
    data: Omit<User, "id" | "createdAt" | "updatedAt">,
  ): Promise<User> {
    return this._prisma.user.create({ data });
  }

  public async createStudent(
    data: Omit<Student, "createdAt" | "updatedAt">,
  ): Promise<Student> {
    return this._prisma.student.create({ data });
  }

  public async createTeacher(
    data: Omit<Teacher, "createdAt" | "updatedAt">,
  ): Promise<Teacher> {
    return this._prisma.teacher.create({ data });
  }

  public async createExternal(
    data: Omit<External, "createdAt" | "updatedAt">,
  ): Promise<External> {
    return this._prisma.external.create({ data });
  }

}

export default UserRepository;

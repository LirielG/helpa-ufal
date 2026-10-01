import { RegisterInput } from "@/schemas/auth/AuthSchemas.js";
import type { Prisma, User } from "@prisma/client";

export type UserWithProfile = Prisma.UserGetPayload<{
  select: {
    id: true;
    fullName: true;
    email: true;
    userType: true;
    isManager: true;
    createdAt: true;
    student: { select: { registrationCode: true; course: true } };
    teacher: { select: { registrationCode: true; course: true; cndb: true } };
  };
}>;

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<{ isManager: boolean } | null>;
  findProfileById(id: string): Promise<UserWithProfile | null>;

  createWithSubtype(
    data: RegisterInput & { passwordHash: string },
  ): Promise<User>;
}

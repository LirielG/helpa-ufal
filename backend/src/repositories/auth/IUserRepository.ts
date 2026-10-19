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

export type UserWithProfileAndHash = UserWithProfile & {
  passwordHash: string;
};

export type UpdateProfileData = {
  fullName?: string;
  course?: string | null;
  passwordHash?: string;
};

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<UserWithProfileAndHash | null>;
  findTokenVersionById(id: string): Promise<{ tokenVersion: number } | null>;
  findProfileById(id: string): Promise<UserWithProfile | null>;
  updateProfile(id: string, data: UpdateProfileData): Promise<UserWithProfile>;

  createWithSubtype(
    data: RegisterInput & { passwordHash: string },
  ): Promise<User>;
}

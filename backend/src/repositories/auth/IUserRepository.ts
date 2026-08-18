import { RegisterInput } from "@/schemas/auth/AuthSchemas.js";
import type { Student, Teacher, User, UserType } from "@prisma/client";

export type UserWithSubtype = User & {
  student: Student | null;
  teacher: Teacher | null;
};

export type UpdateUserData = {
  fullName?: string;
  email?: string;
  passwordHash?: string;
  course?: string;
  registrationCode?: string;
  cndb?: string;
};

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<UserWithSubtype | null>;

  createWithSubtype(
    data: RegisterInput & { passwordHash: string },
  ): Promise<User>;

  updateUser(
    id: string,
    userType: UserType,
    data: UpdateUserData,
  ): Promise<UserWithSubtype>;
}


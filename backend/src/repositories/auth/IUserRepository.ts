import { RegisterInput } from "@/schemas/auth/AuthSchemas.js";
import type { User, Student, Teacher, External } from "@prisma/client";

export interface IUserRepository {

  findByEmail(
    email: string
  ): Promise<User | null>;

  createWithSubtype(
    data: RegisterInput & {passwordHash: string}
  ): Promise<User>;
}

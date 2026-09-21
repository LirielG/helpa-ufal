import { RegisterInput } from "@/schemas/auth/AuthSchemas.js";
import type { User } from "@prisma/client";

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;

  findById(id: string): Promise<{ isManager: boolean } | null>;

  createWithSubtype(
    data: RegisterInput & { passwordHash: string },
  ): Promise<User>;

}

import type { User, Student, Teacher, External } from "@prisma/client";

export interface IUserRepository {

  findByEmail(
    email: string
  ): Promise<User | null>;

  create(data: Omit<User, "id" | "createdAt" | "updatedAt">): Promise<User>;

  createStudent(data: Omit<Student, "createdAt" | "updatedAt">): Promise<Student>;
  createTeacher(data: Omit<Teacher, "createdAt" | "updatedAt">): Promise<Teacher>;
  createExternal(data: Omit<External, "createdAt" | "updatedAt">): Promise<External>
}

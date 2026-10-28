import path from "node:path";
import { fileURLToPath } from "node:url";
import { UserType } from "@prisma/client";
import bcryptjs from "bcryptjs";
import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prisma.js";

export async function seedAdmin() {
  const missingVars = (
    ["ADMIN_EMAIL", "ADMIN_PASSWORD", "ADMIN_FULL_NAME"] as const
  ).filter((key) => !env[key]);

  if (missingVars.length > 0) {
    throw new Error(`Missing required env vars: ${missingVars.join(", ")}`);
  }

  const adminEmail = env.ADMIN_EMAIL!;
  const adminPassword = env.ADMIN_PASSWORD!;
  const adminFullName = env.ADMIN_FULL_NAME!;

  const passwordHash = await bcryptjs.hash(adminPassword, 12);

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: adminFullName,
      isManager: true,
      userType: UserType.TEACHER,
    },
    create: {
      fullName: adminFullName,
      email: adminEmail,
      passwordHash,
      userType: UserType.TEACHER,
      isManager: true,
    },
  });

  await prisma.teacher.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      registrationCode: "SIAPE123456",
      cndb: "CNDB123456",
      course: "Ciência da Computação",
    },
  });

  console.log(`✓ Admin user seeded: ${adminEmail}`);
  return user;
}

async function main() {
  await seedAdmin();
  console.log("Seeding completed successfully!");
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main()
    .catch((err) => {
      console.error("Error during seed:", err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

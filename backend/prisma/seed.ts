import { PrismaClient, UserType } from "@prisma/client";
import bcryptjs from "bcryptjs";
import { env } from "../src/config/env.js";

const prisma = new PrismaClient();

async function main() {
  const {
    ADMIN_EMAIL: adminEmail,
    ADMIN_PASSWORD: adminPassword,
    ADMIN_FULL_NAME: adminFullName,
  } = env;

  if (!adminEmail || !adminPassword || !adminFullName) {
    throw new Error(
      "Missing required env vars: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FULL_NAME",
    );
  }

  const passwordHash = await bcryptjs.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      fullName: adminFullName,
      email: adminEmail,
      passwordHash,
      userType: UserType.TEACHER,
      isManager: true,
    },
  });

  console.log(`Admin user seeded: ${adminEmail}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

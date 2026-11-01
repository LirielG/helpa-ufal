import { afterAll, beforeEach } from "vitest";
import { prisma } from "@/database/prisma.js";
import { resetDatabase } from "./resetDatabase.js";

// Before EACH test, not each file: that way no test depends on what another
// one left in the database.
beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect().catch(() => undefined);
});

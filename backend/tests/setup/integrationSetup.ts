import { afterAll, beforeEach, vi } from "vitest";
import { prisma } from "@/database/prisma.js";
import { resetDatabase } from "./resetDatabase.js";
import "./supertestLoopback.js";

// No integration test may open an SMTP connection or create an Ethereal
// account. Tests that check an e-mail was sent spy on EmailService.send and
// read its templateCode and vars instead.
vi.mock("@/services/email/transport/NodemailerTransport.js", () => ({
  default: class {
    async send(): Promise<void> {}
  },
}));

// Before EACH test, not each file: that way no test depends on what another
// one left in the database.
beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect().catch(() => undefined);
});

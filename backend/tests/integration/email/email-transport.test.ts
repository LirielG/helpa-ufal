import { afterEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import EmailService from "@/services/email/EmailService.js";

describe("E-mail transport in integration tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends through the stubbed transport without reaching nodemailer", async () => {
    const createTransport = vi.spyOn(nodemailer, "createTransport");
    const createTestAccount = vi.spyOn(nodemailer, "createTestAccount");

    await expect(
      new EmailService().send("maria@helpa.test", "passwordChanged", {
        firstName: "Maria",
      }),
    ).resolves.toBeUndefined();

    expect(createTransport).not.toHaveBeenCalled();
    expect(createTestAccount).not.toHaveBeenCalled();
  });
});

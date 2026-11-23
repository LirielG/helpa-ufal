import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nodemailerMock = vi.hoisted(() => ({
  createTestAccount: vi.fn(),
  createTransport: vi.fn(),
  getTestMessageUrl: vi.fn(),
}));

vi.mock("nodemailer", () => ({ default: nodemailerMock }));

const message = {
  to: "maria@helpa.test",
  subject: "Assunto",
  text: "Texto",
  html: "<p>Texto</p>",
};

const etherealAccount = {
  user: "ethereal-user",
  pass: "ethereal-pass",
  smtp: { host: "smtp.ethereal.email", port: 587, secure: false },
};

const timeouts = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
};

const smtpConfig = {
  host: "smtp-relay.brevo.com",
  port: 465,
  secure: true,
  user: "login@smtp-brevo.com",
  pass: "smtp-password",
  from: "Helpa <no-reply@helpa.ufal.br>",
};

describe("NodemailerTransport", () => {
  const sendMail = vi.fn();

  beforeEach(() => {
    // The Ethereal account is memoized per module, so each test gets a
    // fresh copy of the module.
    vi.resetModules();
    sendMail.mockResolvedValue({ messageId: "id" });
    nodemailerMock.createTransport.mockReturnValue({ sendMail });
    nodemailerMock.createTestAccount.mockResolvedValue(etherealAccount);
    nodemailerMock.getTestMessageUrl.mockReturnValue(
      "https://ethereal.email/message/abc",
    );
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  async function loadTransport() {
    const module =
      await import("@/services/email/transport/NodemailerTransport.js");
    return module.default;
  }

  it("does not touch the network when constructed", async () => {
    const NodemailerTransport = await loadTransport();

    new NodemailerTransport({ smtp: {} });

    expect(nodemailerMock.createTestAccount).not.toHaveBeenCalled();
    expect(nodemailerMock.createTransport).not.toHaveBeenCalled();
  });

  describe("without an SMTP host", () => {
    it("creates the Ethereal account on the first send and logs its credentials", async () => {
      const NodemailerTransport = await loadTransport();

      await new NodemailerTransport({ smtp: {} }).send(message);

      expect(nodemailerMock.createTestAccount).toHaveBeenCalledTimes(1);
      expect(nodemailerMock.createTransport).toHaveBeenCalledWith({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: "ethereal-user", pass: "ethereal-pass" },
        ...timeouts,
      });
      const logged = vi.mocked(console.info).mock.calls.flat().join(" ");
      expect(logged).toContain("ethereal-user");
      expect(logged).toContain("ethereal-pass");
    });

    it("logs the preview URL after each send", async () => {
      const NodemailerTransport = await loadTransport();
      const transport = new NodemailerTransport({ smtp: {} });

      await transport.send(message);
      await transport.send(message);

      const previewLogs = vi
        .mocked(console.info)
        .mock.calls.filter((args) =>
          args.join(" ").includes("https://ethereal.email/message/abc"),
        );
      expect(previewLogs).toHaveLength(2);
    });

    it("reuses one Ethereal account across instances", async () => {
      const NodemailerTransport = await loadTransport();

      await new NodemailerTransport({ smtp: {} }).send(message);
      await new NodemailerTransport({ smtp: {} }).send(message);

      expect(nodemailerMock.createTestAccount).toHaveBeenCalledTimes(1);
    });

    it("sends from MAIL_FROM, or from the local default sender", async () => {
      const NodemailerTransport = await loadTransport();

      await new NodemailerTransport({ smtp: {} }).send(message);
      await new NodemailerTransport({
        smtp: { from: "Dev <dev@helpa.test>" },
      }).send(message);

      expect(sendMail).toHaveBeenNthCalledWith(1, {
        ...message,
        from: "Helpa <no-reply@helpa.local>",
      });
      expect(sendMail).toHaveBeenNthCalledWith(2, {
        ...message,
        from: "Dev <dev@helpa.test>",
      });
    });

    it("retries the account creation after a failure", async () => {
      const NodemailerTransport = await loadTransport();
      const transport = new NodemailerTransport({ smtp: {} });
      nodemailerMock.createTestAccount.mockRejectedValueOnce(
        new Error("offline"),
      );

      await expect(transport.send(message)).rejects.toThrow("offline");
      await transport.send(message);

      expect(nodemailerMock.createTestAccount).toHaveBeenCalledTimes(2);
      expect(sendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe("with an SMTP host", () => {
    it("sends through the configured server from MAIL_FROM", async () => {
      const NodemailerTransport = await loadTransport();

      await new NodemailerTransport({ smtp: smtpConfig }).send(message);

      expect(nodemailerMock.createTestAccount).not.toHaveBeenCalled();
      expect(nodemailerMock.createTransport).toHaveBeenCalledWith({
        host: "smtp-relay.brevo.com",
        port: 465,
        secure: true,
        auth: { user: "login@smtp-brevo.com", pass: "smtp-password" },
        ...timeouts,
      });
      expect(sendMail).toHaveBeenCalledWith({
        ...message,
        from: "Helpa <no-reply@helpa.ufal.br>",
      });
      expect(nodemailerMock.getTestMessageUrl).not.toHaveBeenCalled();
    });

    it("omits the login when SMTP_USER is not set", async () => {
      const NodemailerTransport = await loadTransport();

      await new NodemailerTransport({
        smtp: { host: "localhost", port: 1025, secure: false },
      }).send(message);

      expect(nodemailerMock.createTransport).toHaveBeenCalledWith({
        host: "localhost",
        port: 1025,
        secure: false,
        ...timeouts,
      });
    });

    it("rejects when the server refuses the message", async () => {
      const NodemailerTransport = await loadTransport();
      sendMail.mockRejectedValueOnce(new Error("550 rejected"));

      await expect(
        new NodemailerTransport({ smtp: smtpConfig }).send(message),
      ).rejects.toThrow("550 rejected");
    });
  });
});

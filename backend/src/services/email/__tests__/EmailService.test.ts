import { describe, expect, it, vi } from "vitest";
import EmailService from "@/services/email/EmailService.js";
import type { IEmailTransport } from "@/services/email/transport/IEmailTransport.js";

function fakeTransport(
  send: IEmailTransport["send"] = vi.fn().mockResolvedValue(undefined),
): IEmailTransport {
  return { send };
}

describe("EmailService", () => {
  it("hands the rendered template to the transport", async () => {
    const transport = fakeTransport();
    const service = new EmailService({ transport });

    await service.send("maria@helpa.test", "passwordChanged", {
      firstName: "Maria",
    });

    expect(transport.send).toHaveBeenCalledTimes(1);
    const message = vi.mocked(transport.send).mock.calls[0]?.[0];
    expect(message?.to).toBe("maria@helpa.test");
    expect(message?.subject).toBe("Sua senha do Helpa foi alterada");
    expect(message?.text).toContain("Olá, Maria!");
    expect(message?.html).toContain("Senha alterada");
  });

  it("escapes the variables in the HTML but not in the text", async () => {
    const transport = fakeTransport();
    const service = new EmailService({ transport });

    await service.send("eve@helpa.test", "passwordChanged", {
      firstName: "<b>Eve</b>",
    });

    const message = vi.mocked(transport.send).mock.calls[0]?.[0];
    expect(message?.html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(message?.html).not.toContain("<b>Eve</b>");
    expect(message?.text).toContain("<b>Eve</b>");
  });

  it("rejects when the transport fails", async () => {
    const failure = new Error("SMTP down");
    const service = new EmailService({
      transport: fakeTransport(vi.fn().mockRejectedValue(failure)),
    });

    await expect(
      service.send("maria@helpa.test", "passwordChanged", {
        firstName: "Maria",
      }),
    ).rejects.toBe(failure);
  });
});

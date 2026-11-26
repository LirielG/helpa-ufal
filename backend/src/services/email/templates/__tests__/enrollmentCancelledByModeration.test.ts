import { describe, expect, it } from "vitest";
import enrollmentCancelledByModeration from "@/services/email/templates/enrollmentCancelledByModeration.js";

describe("enrollmentCancelledByModeration template", () => {
  const email = enrollmentCancelledByModeration.render({
    activityTitle: "Oficina de Robótica",
  });

  it("uses the agreed subject", () => {
    expect(email.subject).toBe("Ação removida e inscrição cancelada");
  });

  it("renders the agreed plain-text body without justification", () => {
    expect(email.text).toBe(
      "Olá!\n\n" +
        "A ação «Oficina de Robótica», em que você tinha inscrição, foi " +
        "removida pela moderação do Helpa, e sua inscrição foi cancelada.",
    );
  });

  it("renders the HTML with the heading and message", () => {
    expect(email.html).toContain("Ação removida e inscrição cancelada");
    expect(email.html).toContain(
      "A ação «Oficina de Robótica», em que você tinha inscrição, foi " +
        "removida pela moderação do Helpa, e sua inscrição foi cancelada.",
    );
  });

  it("escapes the activity title in HTML and keeps it literal in text", () => {
    const hostile = enrollmentCancelledByModeration.render({
      activityTitle: '<a href="x">Oficina</a>',
    });

    expect(hostile.html).toContain(
      "&lt;a href=&quot;x&quot;&gt;Oficina&lt;/a&gt;",
    );
    expect(hostile.html).not.toContain('<a href="x">');
    expect(hostile.text).toContain('«<a href="x">Oficina</a>»');
  });
});

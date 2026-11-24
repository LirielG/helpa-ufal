import { describe, expect, it } from "vitest";
import activityRemovedByModeration from "@/services/email/templates/activityRemovedByModeration.js";

describe("activityRemovedByModeration template", () => {
  const email = activityRemovedByModeration.render({
    activityTitle: "Oficina de Robótica",
    justification: "Conteúdo incompatível com as diretrizes institucionais.",
  });

  it("uses the agreed subject", () => {
    expect(email.subject).toBe("Sua ação foi removida pela moderação");
  });

  it("renders the agreed plain-text body with justification", () => {
    expect(email.text).toBe(
      "Olá!\n\n" +
        "A ação «Oficina de Robótica» foi removida pela moderação do Helpa.\n\n" +
        "Justificativa: Conteúdo incompatível com as diretrizes institucionais.\n\n" +
        "As inscrições ativas foram canceladas. Certificados já emitidos " +
        "continuam válidos.",
    );
  });

  it("renders the HTML with the heading, justification, and certificate note", () => {
    expect(email.html).toContain("Sua ação foi removida pela moderação");
    expect(email.html).toContain(
      "A ação «Oficina de Robótica» foi removida pela moderação do Helpa.",
    );
    expect(email.html).toContain(
      "Justificativa: Conteúdo incompatível com as diretrizes institucionais.",
    );
    expect(email.html).toContain(
      "As inscrições ativas foram canceladas. Certificados já emitidos " +
        "continuam válidos.",
    );
  });

  it("escapes the activity title and justification in HTML and keeps them literal in text", () => {
    const hostile = activityRemovedByModeration.render({
      activityTitle: "<b>Ação & Evento</b>",
      justification: '<img src=x onerror="alert(1)">',
    });

    expect(hostile.html).toContain("&lt;b&gt;Ação &amp; Evento&lt;/b&gt;");
    expect(hostile.html).not.toContain("<b>Ação");
    expect(hostile.html).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(hostile.html).not.toContain("<img");
    expect(hostile.text).toContain("«<b>Ação & Evento</b>»");
    expect(hostile.text).toContain(
      'Justificativa: <img src=x onerror="alert(1)">',
    );
  });
});

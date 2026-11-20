import { describe, expect, it } from "vitest";
import passwordChanged from "@/services/email/templates/passwordChanged.js";

describe("passwordChanged template", () => {
  const email = passwordChanged.render({ firstName: "Maria" });

  it("uses the agreed subject", () => {
    expect(email.subject).toBe("Sua senha do Helpa foi alterada");
  });

  it("renders the agreed plain-text body", () => {
    expect(email.text).toBe(
      "Olá, Maria! A senha da sua conta no Helpa acabou de ser alterada, e as " +
        "sessões abertas foram encerradas. Se foi você, não é preciso fazer " +
        "nada. Se não foi, redefina sua senha imediatamente pela opção " +
        '"Esqueci minha senha" na tela de login.',
    );
  });

  it("renders the HTML with the heading and no link", () => {
    expect(email.html).toContain("Senha alterada");
    expect(email.html).toContain("Olá, Maria!");
    expect(email.html).toContain("as sessões abertas foram encerradas");
    expect(email.html).not.toMatch(/<a\b/i);
  });

  it("escapes the name in the HTML and keeps it literal in the text", () => {
    const hostile = passwordChanged.render({ firstName: "<b>Eve</b>" });

    expect(hostile.html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(hostile.html).not.toContain("<b>Eve</b>");
    expect(hostile.text).toContain("Olá, <b>Eve</b>!");
  });
});

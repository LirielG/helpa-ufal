import { describe, expect, it } from "vitest";
import passwordResetCode from "@/services/email/templates/passwordResetCode.js";

const RESET_URL =
  "https://helpa.example/reset-password#email=maria%40ufal.br&code=ABCDEFGH";

describe("passwordResetCode template", () => {
  const email = passwordResetCode.render({
    firstName: "Maria",
    code: "ABCD-EFGH",
    resetUrl: RESET_URL,
  });

  it("uses the agreed subject", () => {
    expect(email.subject).toBe("Seu código para redefinir a senha do Helpa");
  });

  it("renders the agreed plain-text body", () => {
    expect(email.text).toBe(
      "Olá, Maria! Recebemos um pedido para redefinir a senha da sua conta " +
        "no Helpa. Use o código abaixo ou o link a seguir. O código vale por " +
        "30 minutos e só pode ser usado uma vez.\n\n" +
        "Código: ABCD-EFGH\n\n" +
        `Redefinir senha: ${RESET_URL}\n\n` +
        "Se você não fez esse pedido, ignore este e-mail: sua senha continua " +
        "a mesma.",
    );
  });

  it("renders the HTML with the heading, the code box and the button", () => {
    expect(email.html).toContain("Redefinir senha");
    expect(email.html).toContain("Olá, Maria!");
    expect(email.html).toContain(">ABCD-EFGH</p>");
    // The & between the fragment parameters is escaped in the attribute and
    // read back as & by the client.
    expect(email.html).toContain(`href="${RESET_URL.replace("&", "&amp;")}"`);
  });

  it("escapes the name in the HTML and keeps it literal in the text", () => {
    const hostile = passwordResetCode.render({
      firstName: "<b>Eve</b>",
      code: "ABCD-EFGH",
      resetUrl: RESET_URL,
    });

    expect(hostile.html).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(hostile.html).not.toContain("<b>Eve</b>");
    expect(hostile.text).toContain("Olá, <b>Eve</b>!");
  });
});

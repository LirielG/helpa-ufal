import { describe, expect, it } from "vitest";
import reportReviewed from "@/services/email/templates/reportReviewed.js";

describe("reportReviewed template", () => {
  describe("UPHELD verdict", () => {
    const email = reportReviewed.render({
      activityTitle: "Oficina de Robótica",
      verdict: "UPHELD",
    });

    it("uses the agreed subject", () => {
      expect(email.subject).toBe("Sua denúncia foi analisada");
    });

    it("renders the agreed plain-text body for removed activities", () => {
      expect(email.text).toBe(
        "Olá!\n\n" +
          "A ação «Oficina de Robótica», que você denunciou, foi analisada " +
          "pela moderação e removida da plataforma.\n\n" +
          "A decisão considera o conjunto das denúncias recebidas e a " +
          "análise da moderação, e não indica necessariamente que a remoção " +
          "aconteceu pelo motivo que você apontou.",
      );
    });

    it("renders the HTML with the heading and paragraphs", () => {
      expect(email.html).toContain("Sua denúncia foi analisada");
      expect(email.html).toContain(
        "A ação «Oficina de Robótica», que você denunciou, foi analisada " +
          "pela moderação e removida da plataforma.",
      );
      expect(email.html).toContain(
        "não indica necessariamente que a remoção aconteceu pelo motivo que " +
          "você apontou.",
      );
    });
  });

  describe("REJECTED verdict", () => {
    const email = reportReviewed.render({
      activityTitle: "Oficina de Robótica",
      verdict: "REJECTED",
    });

    it("uses the agreed subject", () => {
      expect(email.subject).toBe("Sua denúncia foi analisada");
    });

    it("renders the agreed plain-text body for published activities", () => {
      expect(email.text).toBe(
        "Olá!\n\n" +
          "A ação «Oficina de Robótica», que você denunciou, foi analisada " +
          "pela moderação e continua publicada.\n\n" +
          "A decisão considera o conjunto das denúncias recebidas e a " +
          "análise da moderação, e não indica necessariamente que o motivo " +
          "que você apontou foi descartado.",
      );
    });

    it("renders the HTML with the heading and paragraphs", () => {
      expect(email.html).toContain("Sua denúncia foi analisada");
      expect(email.html).toContain(
        "A ação «Oficina de Robótica», que você denunciou, foi analisada " +
          "pela moderação e continua publicada.",
      );
      expect(email.html).toContain(
        "não indica necessariamente que o motivo que você apontou foi " +
          "descartado.",
      );
    });
  });

  it("escapes the activity title in HTML and keeps it literal in text", () => {
    const hostile = reportReviewed.render({
      activityTitle: '<script>alert("x")</script>',
      verdict: "UPHELD",
    });

    expect(hostile.html).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(hostile.html).not.toContain("<script>");
    expect(hostile.text).toContain('«<script>alert("x")</script>»');
  });
});

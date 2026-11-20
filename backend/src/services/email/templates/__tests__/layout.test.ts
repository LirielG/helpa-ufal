import { describe, expect, it } from "vitest";
import {
  button,
  codeBox,
  escapeHtml,
  layout,
} from "@/services/email/templates/layout.js";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">Tom & 'Jerry'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;",
    );
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("Olá, Maria!")).toBe("Olá, Maria!");
  });
});

describe("layout", () => {
  const html = layout({
    title: "Title <t>",
    heading: "Heading <h>",
    greeting: "Olá, <b>Maria</b>!",
    content: "<p>Trusted content</p>",
  });

  it("renders a pt-BR document capped at 600px", () => {
    expect(html).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain("max-width:600px");
  });

  it("escapes the title, heading and greeting", () => {
    expect(html).toContain("<title>Title &lt;t&gt;</title>");
    expect(html).toContain("Heading &lt;h&gt;");
    expect(html).toContain("Olá, &lt;b&gt;Maria&lt;/b&gt;!");
    expect(html).not.toContain("<b>Maria</b>");
  });

  it("inserts the content as HTML", () => {
    expect(html).toContain("<p>Trusted content</p>");
  });
});

describe("button", () => {
  it("renders an escaped link with an escaped label", () => {
    const html = button('https://helpa.test/r?a=1&b="2"', "Redefinir <senha>");

    expect(html).toContain(
      'href="https://helpa.test/r?a=1&amp;b=&quot;2&quot;"',
    );
    expect(html).toContain("Redefinir &lt;senha&gt;");
  });
});

describe("codeBox", () => {
  it("renders the escaped code", () => {
    expect(codeBox("12<34")).toContain("12&lt;34");
  });
});

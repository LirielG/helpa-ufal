import { describe, expect, it } from "vitest";
import {
  fitText,
  type MeasurableFont,
} from "@/services/certificate/fitText.js";

// Every character is half an em wide, so widths are easy to reason about:
// at 10pt, each character takes 5pt.
const monospace: MeasurableFont = {
  widthOfTextAtSize: (text, size) => text.length * size * 0.5,
};

function widestLine(lines: string[], size: number): number {
  return Math.max(...lines.map((l) => monospace.widthOfTextAtSize(l, size)));
}

describe("fitText", () => {
  it("keeps baseSize when the text fits", () => {
    const result = fitText("Maria Silva", monospace, {
      maxWidth: 200,
      maxLines: 1,
      baseSize: 20,
      minSize: 10,
    });

    expect(result).toEqual({ size: 20, lines: ["Maria Silva"] });
  });

  it("reduces the size until a single line fits", () => {
    // 20 chars: 200pt at 20pt, 160pt at 16pt.
    const result = fitText("a".repeat(20), monospace, {
      maxWidth: 160,
      maxLines: 1,
      baseSize: 20,
      minSize: 10,
    });

    expect(result).toEqual({ size: 16, lines: ["a".repeat(20)] });
  });

  it("wraps by word before reducing the size when more lines are allowed", () => {
    const result = fitText("aaaa bbbb cccc", monospace, {
      maxWidth: 100,
      maxLines: 2,
      baseSize: 20,
      minSize: 10,
    });

    // "aaaa bbbb" is 9 chars = 90pt at 20pt; "cccc" goes to the next line.
    expect(result).toEqual({ size: 20, lines: ["aaaa bbbb", "cccc"] });
  });

  it("collapses runs of whitespace and line breaks into single spaces", () => {
    const result = fitText("  Oficina \n de   Leitura ", monospace, {
      maxWidth: 500,
      maxLines: 1,
      baseSize: 10,
      minSize: 10,
    });

    expect(result.lines).toEqual(["Oficina de Leitura"]);
  });

  it("truncates with … at minSize when the text does not fit, respecting maxLines", () => {
    const text = Array.from({ length: 40 }, (_, i) => `word${i}`).join(" ");

    const result = fitText(text, monospace, {
      maxWidth: 100,
      maxLines: 2,
      baseSize: 20,
      minSize: 10,
    });

    expect(result.size).toBe(10);
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0]?.endsWith("…")).toBe(false);
    expect(result.lines[1]?.endsWith("…")).toBe(true);
    expect(widestLine(result.lines, 10)).toBeLessThanOrEqual(100);
  });

  it("does not leave a space before the ellipsis", () => {
    // At 10pt a line holds 20 chars, so the first line is "a×18 b". Making
    // room for "…" drops the "b" and exposes the space, which must go too.
    const result = fitText(`${"a".repeat(18)} b cccc`, monospace, {
      maxWidth: 100,
      maxLines: 1,
      baseSize: 10,
      minSize: 10,
    });

    expect(result.lines).toEqual([`${"a".repeat(18)}…`]);
  });

  it("breaks a word longer than a whole line by character", () => {
    const result = fitText("W".repeat(30), monospace, {
      maxWidth: 100,
      maxLines: 2,
      baseSize: 10,
      minSize: 10,
    });

    // 20 chars per line: the first line is full, the second holds the rest.
    expect(result.lines).toEqual(["W".repeat(20), "W".repeat(10)]);
  });

  it("uses every allowed line before truncating an unbreakable word", () => {
    const result = fitText("W".repeat(150), monospace, {
      maxWidth: 100,
      maxLines: 2,
      baseSize: 20,
      minSize: 10,
    });

    expect(result.size).toBe(10);
    expect(result.lines).toEqual(["W".repeat(20), `${"W".repeat(19)}…`]);
  });

  it("truncates with a custom ellipsis, keeping it inside maxWidth", () => {
    const result = fitText(`“${"W".repeat(40)}”`, monospace, {
      maxWidth: 100,
      maxLines: 1,
      baseSize: 10,
      minSize: 10,
      ellipsis: "…”",
    });

    // 20 chars per line: "“" + 17 "W" + "…”".
    expect(result.lines).toEqual([`“${"W".repeat(17)}…”`]);
  });

  it("returns no lines for blank text", () => {
    const result = fitText("   ", monospace, {
      maxWidth: 100,
      maxLines: 1,
      baseSize: 20,
      minSize: 10,
    });

    expect(result).toEqual({ size: 20, lines: [] });
  });
});

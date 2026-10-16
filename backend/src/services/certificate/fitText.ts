import type { PDFFont } from "pdf-lib";

export type MeasurableFont = Pick<PDFFont, "widthOfTextAtSize">;

export type FitTextOptions = {
  maxWidth: number;
  maxLines: number;
  baseSize: number;
  minSize: number;
  /** Appended to a truncated last line. Defaults to "…". */
  ellipsis?: string;
};

export type FitTextResult = {
  size: number;
  lines: string[];
};

const SIZE_STEP = 0.5;

/**
 * Fits `text` into at most `maxLines` lines of `maxWidth`, shrinking the font
 * from `baseSize` down to `minSize`. If it still does not fit at `minSize`,
 * the last line is truncated with `ellipsis`.
 *
 * It never throws on long input: a certificate with a truncated title is
 * better than a failed download.
 */
export function fitText(
  text: string,
  font: MeasurableFont,
  { maxWidth, maxLines, baseSize, minSize, ellipsis = "…" }: FitTextOptions,
): FitTextResult {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { size: baseSize, lines: [] };

  // Each measurement runs the font's full text layout (milliseconds for a
  // long line), so the sizes are binary-searched instead of tried one by
  // one. A smaller size never needs more lines, since widths scale linearly.
  const sizes = candidateSizes(baseSize, minSize);
  const attempt = (size: number) => wrap(words, font, size, maxWidth, maxLines);

  const atMin = attempt(minSize);
  if (atMin.length > maxLines) {
    const lines = atMin.slice(0, maxLines);
    const last = lines.length - 1;
    lines[last] = withEllipsis(lines[last]!, ellipsis, font, minSize, maxWidth);
    return { size: minSize, lines };
  }

  // Invariant: sizes[high] fits and `best` holds its lines.
  let low = 0;
  let high = sizes.length - 1;
  let best = atMin;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const lines = attempt(sizes[mid]!);
    if (lines.length <= maxLines) {
      high = mid;
      best = lines;
    } else {
      low = mid + 1;
    }
  }
  return { size: sizes[high]!, lines: best };
}

/** From baseSize down to minSize in SIZE_STEP steps, minSize always last. */
function candidateSizes(baseSize: number, minSize: number): number[] {
  const sizes: number[] = [];
  // Integer steps so repeated subtraction does not drift (19.999…).
  for (let step = 0; baseSize - step * SIZE_STEP > minSize; step++) {
    sizes.push(baseSize - step * SIZE_STEP);
  }
  sizes.push(minSize);
  return sizes;
}

/**
 * Greedy word wrap. Stops as soon as it produces more than `maxLines` lines:
 * the caller only needs to know that the text overflows, plus the first
 * `maxLines` lines to truncate.
 */
function wrap(
  words: string[],
  font: MeasurableFont,
  size: number,
  maxWidth: number,
  maxLines: number,
): string[] {
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= maxWidth;
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (fits(candidate)) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);

    // A word wider than a whole line (e.g. a URL, or 150 "W"s) has no space
    // to break at, so it is split by character to keep using the lines.
    let rest = word;
    while (lines.length <= maxLines && !fits(rest)) {
      const cut = longestFittingPrefix(rest, fits);
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
    if (lines.length > maxLines) return lines;
  }

  if (current) lines.push(current);
  return lines;
}

// Returns the string length (in UTF-16 units) of the longest prefix that
// fits. Always at least one character, so a line narrower than a single glyph
// cannot loop forever; that glyph simply overflows.
function longestFittingPrefix(
  word: string,
  fits: (s: string) => boolean,
): number {
  const chars = Array.from(word);
  const count = Math.max(
    1,
    longestFittingCount(chars, (c) => fits(c)),
  );
  return chars.slice(0, count).join("").length;
}

function withEllipsis(
  line: string,
  ellipsis: string,
  font: MeasurableFont,
  size: number,
  maxWidth: number,
): string {
  const chars = Array.from(line);
  const count = longestFittingCount(
    chars,
    (prefix) => font.widthOfTextAtSize(prefix + ellipsis, size) <= maxWidth,
  );
  return chars.slice(0, count).join("").trimEnd() + ellipsis;
}

// Binary search over prefix length: width only grows as characters are
// added, and each measurement lays out the whole prefix, so a linear scan
// made the 120-char extreme name take seconds.
function longestFittingCount(
  chars: string[],
  fits: (prefix: string) => boolean,
): number {
  let low = 0;
  let high = chars.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(chars.slice(0, mid).join(""))) low = mid;
    else high = mid - 1;
  }
  return low;
}

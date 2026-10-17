import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildCertificateContent,
  CERTIFICATE_TEXT_BOXES,
  CertificatePdfRenderer,
} from "@/services/certificate/CertificatePdfRenderer.js";
import type { CertificatePdfData } from "@/services/certificate/ICertificatePdfRenderer.js";
import { fitText } from "@/services/certificate/fitText.js";

// Passthroughs: the real implementations run, the spies only record calls.
// qrcode is CommonJS, so the renderer reaches it through the default export.
vi.mock("qrcode", async (importOriginal) => {
  const actual = await importOriginal<{ default: typeof import("qrcode") }>();
  const toBuffer = vi.fn(actual.default.toBuffer);
  return { default: { ...actual.default, toBuffer } };
});
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

const APP_PUBLIC_URL = "https://helpa.ufal.br";

const common: CertificatePdfData = {
  holderName: "Maria Silva",
  activityTitle: "Oficina de Leitura",
  activityStartDate: new Date("2026-06-10T12:00:00Z"),
  activityEndDate: new Date("2026-06-12T12:00:00Z"),
  workloadHours: 8,
  issuedAt: new Date("2026-06-15T12:00:00Z"),
  validationCode: "7KQ4MX9T2R",
};

// The input limits set by #306, filled with the widest glyphs.
const extreme: CertificatePdfData = {
  ...common,
  holderName: "M".repeat(120),
  activityTitle: "W".repeat(150),
};

// Outside WinAnsi: pdf-lib's standard fonts throw on "Ł" and "Ő".
const unicode: CertificatePdfData = {
  ...common,
  holderName: "Łukasz Ő Ñúñez da Conceição",
};

const renderer = new CertificatePdfRenderer({ appPublicUrl: APP_PUBLIC_URL });

describe("CertificatePdfRenderer.render", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a single landscape A4 PDF page", async () => {
    const bytes = await renderer.render(common);

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(841.89, 2);
    expect(height).toBeCloseTo(595.28, 2);
  });

  it.each([
    ["common", common],
    ["extreme", extreme],
    ["unicode", unicode],
  ])("renders the %s case without throwing", async (_, data) => {
    const bytes = await renderer.render(data);

    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
  });

  it("encodes the public validation URL in the QR code", async () => {
    await renderer.render(common);

    // qrcode mutates the options it receives (adds `color`), hence
    // objectContaining instead of an exact match.
    expect(QRCode.toBuffer).toHaveBeenCalledWith(
      "https://helpa.ufal.br/validar/7KQ4MX9T2R",
      expect.objectContaining({ errorCorrectionLevel: "M", margin: 1 }),
    );
  });

  it("rasterizes the QR at print resolution (about 300 dpi at its drawn size)", async () => {
    await renderer.render(common);

    const qrPng = await vi.mocked(QRCode.toBuffer).mock.results[0]!.value;
    // PNG IHDR: width is the big-endian uint32 at byte 16.
    const widthPx = Buffer.from(qrPng).readUInt32BE(16);
    expect(widthPx).toBeGreaterThanOrEqual(300);
  });

  it("reads font and logo from disk only on the first call", async () => {
    vi.resetModules();
    const { CertificatePdfRenderer: FreshRenderer } =
      await import("@/services/certificate/CertificatePdfRenderer.js");
    const fresh = new FreshRenderer({ appPublicUrl: APP_PUBLIC_URL });

    await fresh.render(common);
    const readsAfterFirst = vi.mocked(readFile).mock.calls.length;
    await fresh.render(unicode);

    expect(readsAfterFirst).toBe(3);
    expect(vi.mocked(readFile)).toHaveBeenCalledTimes(3);
  });
});

describe("CERTIFICATE_TEXT_BOXES with the embedded font", () => {
  async function embedInter(weight: "Regular" | "Bold") {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const bytes = await readFile(
      new URL(
        `../../../../assets/certificate/Inter-${weight}.ttf`,
        import.meta.url,
      ),
    );
    return pdf.embedFont(bytes);
  }

  it("keeps the extreme name and title inside their boxes", async () => {
    const bold = await embedInter("Bold");
    const content = buildCertificateContent(extreme, APP_PUBLIC_URL);

    for (const [text, box] of [
      [content.holderName, CERTIFICATE_TEXT_BOXES.holderName],
      [content.activityTitle, CERTIFICATE_TEXT_BOXES.activityTitle],
    ] as const) {
      const { size, lines } = fitText(text, bold, box);

      expect(size).toBeGreaterThanOrEqual(10);
      expect(lines.length).toBeLessThanOrEqual(box.maxLines);
      for (const line of lines) {
        expect(bold.widthOfTextAtSize(line, size)).toBeLessThanOrEqual(
          box.maxWidth,
        );
      }
    }
  });

  it("keeps the closing quote when the title is truncated", async () => {
    const bold = await embedInter("Bold");
    const { activityTitle } = buildCertificateContent(extreme, APP_PUBLIC_URL);

    const { lines } = fitText(
      activityTitle,
      bold,
      CERTIFICATE_TEXT_BOXES.activityTitle,
    );

    expect(lines.at(-1)?.endsWith("…”")).toBe(true);
  });

  it("never sets a variable block below 10pt", () => {
    for (const box of Object.values(CERTIFICATE_TEXT_BOXES)) {
      expect(box.minSize).toBeGreaterThanOrEqual(10);
    }
  });
});

describe("buildCertificateContent", () => {
  it("fills every block of the layout", () => {
    expect(buildCertificateContent(common, APP_PUBLIC_URL)).toEqual({
      institution: "Universidade Federal de Alagoas",
      heading: "Certificado",
      opening: "Certificamos que",
      holderName: "Maria Silva",
      connector: "participou da ação",
      activityTitle: "“Oficina de Leitura”",
      period:
        "realizada de 10/06/2026 a 12/06/2026, com carga horária de 8 horas.",
      issued: "Emitido em 15/06/2026",
      validationCode: "Código de validação: 7KQ4M-X9T2R",
      verifyAt: "Confira a autenticidade em helpa.ufal.br/validar",
      qrUrl: "https://helpa.ufal.br/validar/7KQ4MX9T2R",
    });
  });

  it('prints "realizada em" when start and end fall on the same day', () => {
    const { period } = buildCertificateContent(
      {
        ...common,
        activityStartDate: new Date("2026-06-10T12:00:00Z"),
        activityEndDate: new Date("2026-06-10T20:00:00Z"),
      },
      APP_PUBLIC_URL,
    );

    expect(period).toBe(
      "realizada em 10/06/2026, com carga horária de 8 horas.",
    );
  });

  it('prints "1 hora" in the singular', () => {
    const { period } = buildCertificateContent(
      { ...common, workloadHours: 1 },
      APP_PUBLIC_URL,
    );

    expect(period).toBe(
      "realizada de 10/06/2026 a 12/06/2026, com carga horária de 1 hora.",
    );
  });

  it("prints dates in America/Maceio, so 01:30 UTC is still the previous day", () => {
    const { period, issued } = buildCertificateContent(
      {
        ...common,
        // 17:00 and 22:30 in Maceió, both on 10/06.
        activityStartDate: new Date("2026-06-10T20:00:00Z"),
        activityEndDate: new Date("2026-06-11T01:30:00Z"),
        issuedAt: new Date("2026-06-16T01:30:00Z"),
      },
      APP_PUBLIC_URL,
    );

    expect(period).toBe(
      "realizada em 10/06/2026, com carga horária de 8 horas.",
    );
    expect(issued).toBe("Emitido em 15/06/2026");
  });

  it("keeps the frontend path in both the QR URL and the printed address", () => {
    const content = buildCertificateContent(
      common,
      "http://localhost:5173/app",
    );

    expect(content.qrUrl).toBe("http://localhost:5173/app/validar/7KQ4MX9T2R");
    expect(content.verifyAt).toBe(
      "Confira a autenticidade em localhost:5173/app/validar",
    );
  });
});

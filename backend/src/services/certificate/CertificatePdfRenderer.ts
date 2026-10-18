import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  rgb,
  setCharacterSpacing,
  type PDFFont,
  type PDFPage,
  type RGB,
} from "pdf-lib";
import QRCode from "qrcode";
import { env } from "@/config/env.js";
import { formatValidationCode } from "@/utils/validationCode.js";
import { fitText, type FitTextOptions } from "./fitText.js";
import type {
  CertificatePdfData,
  ICertificatePdfRenderer,
} from "./ICertificatePdfRenderer.js";

type Props = {
  appPublicUrl?: string;
};

export type CertificateContent = {
  institution: string;
  heading: string;
  opening: string;
  holderName: string;
  connector: string;
  activityTitle: string;
  period: string;
  issued: string;
  validationCode: string;
  verifyAt: string;
  qrUrl: string;
};

type CertificateAssets = {
  regularFont: Uint8Array;
  boldFont: Uint8Array;
  logo: Uint8Array;
};

// A4 landscape.
const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const CONTENT_WIDTH = 640;
const CONTENT_LEFT = (PAGE_WIDTH - CONTENT_WIDTH) / 2;
const CONTENT_RIGHT = CONTENT_LEFT + CONTENT_WIDTH;

const QR_SIZE = 76;
const LOGO_WIDTH = 120;

const NAVY = rgb(0x0a / 255, 0x25 / 255, 0x40 / 255);
const BLUE = rgb(0x1b / 255, 0x75 / 255, 0xbb / 255);
const GRAY = rgb(0x4a / 255, 0x55 / 255, 0x68 / 255);

export const CERTIFICATE_TEXT_BOXES = {
  holderName: {
    maxWidth: CONTENT_WIDTH,
    maxLines: 1,
    baseSize: 28,
    minSize: 10,
  },
  activityTitle: {
    maxWidth: CONTENT_WIDTH,
    maxLines: 2,
    baseSize: 18,
    minSize: 10,
    // The title is fitted already in quotes; truncation must close them.
    ellipsis: "…”",
  },
  // Fixed size; fitText only wraps it, and truncates as a last resort.
  period: { maxWidth: CONTENT_WIDTH, maxLines: 2, baseSize: 13, minSize: 13 },
  // Leaves room for the QR code on the right of the footer.
  verifyAt: {
    maxWidth: CONTENT_WIDTH - QR_SIZE - 24,
    maxLines: 1,
    baseSize: 10,
    minSize: 10,
  },
} as const satisfies Record<string, FitTextOptions>;

// Instants are stored in UTC. Without the time zone, an action ending at
// 22h in Maceió would be printed with the next day's date.
const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Maceio",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

let assetsPromise: Promise<CertificateAssets> | undefined;

function loadAssets(): Promise<CertificateAssets> {
  assetsPromise ??= Promise.all([
    readAsset("Inter-Regular.ttf"),
    readAsset("Inter-Bold.ttf"),
    readAsset("helpa-logo.png"),
  ])
    .then(([regularFont, boldFont, logo]) => ({ regularFont, boldFont, logo }))
    .catch((error: unknown) => {
      // Do not cache the failure: the next download tries the disk again.
      assetsPromise = undefined;
      throw error;
    });
  return assetsPromise;
}

function readAsset(file: string): Promise<Uint8Array> {
  return readFile(
    new URL(`../../../assets/certificate/${file}`, import.meta.url),
  );
}

export function buildCertificateContent(
  data: CertificatePdfData,
  appPublicUrl: string,
): CertificateContent {
  const start = dateFormatter.format(data.activityStartDate);
  const end = dateFormatter.format(data.activityEndDate);
  const when = start === end ? `em ${start}` : `de ${start} a ${end}`;
  const hours = `${data.workloadHours} ${data.workloadHours === 1 ? "hora" : "horas"}`;
  const printedHost = appPublicUrl.replace(/^https?:\/\//, "");

  return {
    institution: "Universidade Federal de Alagoas",
    heading: "Certificado",
    opening: "Certificamos que",
    holderName: data.holderName,
    connector: "participou da ação",
    activityTitle: `“${data.activityTitle}”`,
    period: `realizada ${when}, com carga horária de ${hours}.`,
    issued: `Emitido em ${dateFormatter.format(data.issuedAt)}`,
    validationCode: `Código de validação: ${formatValidationCode(data.validationCode)}`,
    verifyAt: `Confira a autenticidade em ${printedHost}/validar`,
    // The QR carries the stored form (no hyphen), unlike the printed code.
    qrUrl: `${appPublicUrl}/validar/${data.validationCode}`,
  };
}

export class CertificatePdfRenderer implements ICertificatePdfRenderer {
  private readonly _appPublicUrl: string;

  constructor(props?: Props) {
    this._appPublicUrl = props?.appPublicUrl ?? env.APP_PUBLIC_URL;
  }

  public async render(data: CertificatePdfData): Promise<Uint8Array> {
    const content = buildCertificateContent(data, this._appPublicUrl);
    const assets = await loadAssets();

    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    pdf.setTitle(`Certificado — ${data.holderName}`);
    pdf.setLanguage("pt-BR");

    // Full embedding on purpose: @pdf-lib/fontkit's subsetter drops most of
    // Inter's glyphs (the text layer survives but nothing renders). The PDF
    // grows from ~70 KB to ~430 KB.
    const regular = await pdf.embedFont(assets.regularFont);
    const bold = await pdf.embedFont(assets.boldFont);
    const logo = await pdf.embedPng(assets.logo);
    const qr = await pdf.embedPng(
      await QRCode.toBuffer(content.qrUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        // The default 4px per module gives ~120px stretched to 76pt (~115
        // dpi); viewers and printers then blur the module edges.
        scale: 10,
      }),
    );

    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    drawFrame(page);

    const logoHeight = (logo.height / logo.width) * LOGO_WIDTH;
    page.drawImage(logo, {
      x: (PAGE_WIDTH - LOGO_WIDTH) / 2,
      y: 530 - logoHeight,
      width: LOGO_WIDTH,
      height: logoHeight,
    });

    drawCentered(page, content.institution.toUpperCase(), {
      font: regular,
      size: 10,
      y: 462,
      color: GRAY,
      spacing: 1.5,
    });
    drawCentered(page, content.heading.toUpperCase(), {
      font: bold,
      size: 30,
      y: 420,
      color: NAVY,
      spacing: 6,
    });
    page.drawLine({
      start: { x: PAGE_WIDTH / 2 - 30, y: 404 },
      end: { x: PAGE_WIDTH / 2 + 30, y: 404 },
      thickness: 2,
      color: BLUE,
    });

    drawCentered(page, content.opening, {
      font: regular,
      size: 13,
      y: 374,
      color: GRAY,
    });

    const name = fitText(
      content.holderName,
      bold,
      CERTIFICATE_TEXT_BOXES.holderName,
    );
    drawLines(page, name.lines, {
      font: bold,
      size: name.size,
      y: 340,
      color: BLUE,
    });

    drawCentered(page, content.connector, {
      font: regular,
      size: 13,
      y: 306,
      color: GRAY,
    });

    const title = fitText(
      content.activityTitle,
      bold,
      CERTIFICATE_TEXT_BOXES.activityTitle,
    );
    const titleBottom = drawLines(page, title.lines, {
      font: bold,
      size: title.size,
      y: 276,
      color: NAVY,
    });

    const period = fitText(
      content.period,
      regular,
      CERTIFICATE_TEXT_BOXES.period,
    );
    drawLines(page, period.lines, {
      font: regular,
      size: period.size,
      y: titleBottom - 30,
      color: GRAY,
    });

    drawFooter(page, content, { regular, bold, qr });

    return pdf.save();
  }
}

type TextStyle = {
  font: PDFFont;
  size: number;
  y: number;
  color: RGB;
  spacing?: number;
};

function drawCentered(page: PDFPage, text: string, style: TextStyle): void {
  const spacing = style.spacing ?? 0;
  // Tc is added after every glyph, including the last; centering ignores
  // that trailing gap so the text sits visually in the middle.
  const width =
    style.font.widthOfTextAtSize(text, style.size) +
    spacing * (Array.from(text).length - 1);
  if (spacing) page.pushOperators(setCharacterSpacing(spacing));
  page.drawText(text, {
    x: (PAGE_WIDTH - width) / 2,
    y: style.y,
    font: style.font,
    size: style.size,
    color: style.color,
  });
  if (spacing) page.pushOperators(setCharacterSpacing(0));
}

/** Draws centered lines downward from `y` and returns the last baseline. */
function drawLines(page: PDFPage, lines: string[], style: TextStyle): number {
  const lineHeight = style.size * 1.3;
  let y = style.y;
  lines.forEach((line, index) => {
    y = style.y - index * lineHeight;
    drawCentered(page, line, { ...style, y });
  });
  return y;
}

function drawFrame(page: PDFPage): void {
  page.drawRectangle({
    x: 22,
    y: 22,
    width: PAGE_WIDTH - 44,
    height: PAGE_HEIGHT - 44,
    borderColor: NAVY,
    borderWidth: 1.5,
  });
  page.drawRectangle({
    x: 30,
    y: 30,
    width: PAGE_WIDTH - 60,
    height: PAGE_HEIGHT - 60,
    borderColor: BLUE,
    borderWidth: 0.75,
  });
}

function drawFooter(
  page: PDFPage,
  content: CertificateContent,
  {
    regular,
    bold,
    qr,
  }: {
    regular: PDFFont;
    bold: PDFFont;
    qr: Awaited<ReturnType<PDFDocument["embedPng"]>>;
  },
): void {
  const qrY = 58;
  const separatorY = qrY + QR_SIZE + 14;

  page.drawLine({
    start: { x: CONTENT_LEFT, y: separatorY },
    end: { x: CONTENT_RIGHT, y: separatorY },
    thickness: 0.5,
    color: GRAY,
    opacity: 0.4,
  });

  page.drawImage(qr, {
    x: CONTENT_RIGHT - QR_SIZE,
    y: qrY,
    width: QR_SIZE,
    height: QR_SIZE,
  });

  const verifyAt = fitText(
    content.verifyAt,
    regular,
    CERTIFICATE_TEXT_BOXES.verifyAt,
  );
  const footerLines: [string, PDFFont, number][] = [
    [content.issued, regular, 10],
    [content.validationCode, bold, 10],
    [verifyAt.lines[0] ?? "", regular, verifyAt.size],
  ];
  footerLines.forEach(([text, font, size], index) => {
    page.drawText(text, {
      x: CONTENT_LEFT,
      y: qrY + QR_SIZE - 16 - index * 18,
      font,
      size,
      color: index === 1 ? NAVY : GRAY,
    });
  });
}

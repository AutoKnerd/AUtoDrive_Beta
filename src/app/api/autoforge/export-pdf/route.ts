import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AutoForgeExportPayload = {
  report?: string;
  dealershipName?: string;
  department?: string;
};

const PAGE = {
  width: 612,
  height: 792,
  margin: 52,
  lineHeight: 15,
};

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function asText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  return fallback;
}

function wrapText(text: string, maxWidth: number, font: any, size: number): string[] {
  const lines: string[] = [];
  const normalized = text.replace(/\r/g, '').split('\n');

  for (const block of normalized) {
    const words = block.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }

    let current = words[0];
    for (let index = 1; index < words.length; index += 1) {
      const next = `${current} ${words[index]}`;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else {
        lines.push(current);
        current = words[index];
      }
    }
    lines.push(current);
  }

  return lines;
}

async function buildPdf(payload: AutoForgeExportPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const titleColor = rgb(0.12, 0.18, 0.25);
  const textColor = rgb(0.16, 0.2, 0.26);
  const mutedColor = rgb(0.4, 0.45, 0.5);

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let cursorY = PAGE.height - PAGE.margin;

  const ensureSpace = (heightNeeded: number) => {
    if (cursorY - heightNeeded >= PAGE.margin) return;
    page = pdf.addPage([PAGE.width, PAGE.height]);
    cursorY = PAGE.height - PAGE.margin;
  };

  const drawLines = (
    lines: string[],
    options?: { size?: number; color?: ReturnType<typeof rgb>; bold?: boolean; gapAfter?: number }
  ) => {
    const size = options?.size ?? 11;
    const color = options?.color ?? textColor;
    const font = options?.bold ? boldFont : regularFont;

    for (const line of lines) {
      ensureSpace(PAGE.lineHeight);
      page.drawText(line || ' ', {
        x: PAGE.margin,
        y: cursorY,
        size,
        font,
        color,
      });
      cursorY -= PAGE.lineHeight;
    }

    cursorY -= options?.gapAfter ?? 4;
  };

  const drawParagraph = (
    text: string,
    options?: { size?: number; color?: ReturnType<typeof rgb>; bold?: boolean; gapAfter?: number }
  ) => {
    const size = options?.size ?? 11;
    const lines = wrapText(text, PAGE.width - PAGE.margin * 2, options?.bold ? boldFont : regularFont, size);
    drawLines(lines, { ...options, size });
  };

  const drawSection = (title: string) => {
    drawParagraph(title, { size: 13, bold: true, color: titleColor, gapAfter: 6 });
  };

  const report = asText(payload.report, 'No AutoForge report provided.');
  const lines = report.split('\n');

  drawParagraph('AutoForge Weekly CX Forge', { size: 20, bold: true, color: titleColor, gapAfter: 2 });
  drawParagraph(
    `${asText(payload.department, 'Department')} | ${asText(payload.dealershipName, 'Dealership')}`,
    { size: 10, color: mutedColor, gapAfter: 10 }
  );

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      cursorY -= 3;
      continue;
    }

    if (line.startsWith('# ')) {
      drawParagraph(line.replace(/^#\s+/, ''), { size: 16, bold: true, color: titleColor, gapAfter: 6 });
      continue;
    }

    if (line.startsWith('## ')) {
      drawSection(line.replace(/^##\s+/, ''));
      continue;
    }

    if (line.startsWith('- ')) {
      drawParagraph(`• ${line.replace(/^-+\s+/, '')}`, { size: 10.5, gapAfter: 1 });
      continue;
    }

    drawParagraph(line, { size: 10.5, gapAfter: 1 });
  }

  drawParagraph('AutoDriveCX', { size: 9, bold: true, color: mutedColor, gapAfter: 0 });
  return pdf.save();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as AutoForgeExportPayload | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, message: 'Invalid request body.' }, { status: 400 });
    }

    if (typeof body.report !== 'string' || body.report.trim().length === 0) {
      return NextResponse.json({ ok: false, message: 'AutoForge report text is required.' }, { status: 400 });
    }

    const buffer = await buildPdf(body);
    const departmentPart = safeFilename(asText(body.department, 'autoforge'));
    const dealershipPart = safeFilename(asText(body.dealershipName, 'report'));
    const filename = `autoforge-${departmentPart}-${dealershipPart}.pdf`;

    return new NextResponse(toArrayBuffer(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, message: error?.message || 'Could not generate AutoForge PDF.' },
      { status: 500 }
    );
  }
}

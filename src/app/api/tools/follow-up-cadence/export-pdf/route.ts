import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FollowUpDay = {
  day?: string | number;
  action?: string;
  do?: string;
  say?: string;
};

type FollowUpPayload = {
  metadata?: {
    dealStatus?: string;
    days?: string | number;
    customerType?: string;
    notes?: string;
  };
  cadence?: {
    goal?: string;
    summary?: string;
    days?: FollowUpDay[];
  };
  enhancements?: {
    sprocket?: Record<string, unknown>;
    autodrive?: Record<string, unknown>;
  };
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
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return fallback;
}

function wrapText(text: string, maxWidth: number, font: any, size: number): string[] {
  const normalized = text.replace(/\r/g, '').split('\n');
  const lines: string[] = [];

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

async function buildPdf(payload: FollowUpPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const textColor = rgb(0.12, 0.18, 0.25);
  const mutedColor = rgb(0.35, 0.45, 0.55);
  const accentColor = rgb(0.06, 0.18, 0.32);

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
    drawParagraph(title, { size: 13, bold: true, color: accentColor, gapAfter: 6 });
  };

  const metadata = payload.metadata || {};
  const cadence = payload.cadence || {};
  const enhancements = payload.enhancements || {};
  const days = Array.isArray(cadence.days) ? cadence.days : [];

  drawParagraph('Follow-Up Cadence', { size: 20, bold: true, color: accentColor, gapAfter: 2 });
  drawParagraph('AutoDriveCX Tool Shop', { size: 10, color: mutedColor, gapAfter: 12 });
  drawParagraph(
    `Status: ${asText(metadata.dealStatus, 'N/A')}   Length: ${asText(metadata.days, 'N/A')} days   Customer Type: ${asText(metadata.customerType, 'Neutral')}`,
    { size: 10, gapAfter: 6 }
  );

  const notes = asText(metadata.notes);
  if (notes) {
    drawParagraph(`Notes: ${notes}`, { size: 10, gapAfter: 6 });
  }

  drawParagraph(`Goal: ${asText(cadence.goal, 'N/A')}`, { gapAfter: 4 });
  drawParagraph(`Cadence Summary: ${asText(cadence.summary, 'N/A')}`, { gapAfter: 10 });

  drawSection('Day-by-Day Plan');
  days.forEach((row, index) => {
    const label = asText(row.day, String(index + 1));
    drawParagraph(`Day ${label}: ${asText(row.action, 'Action not provided')}`, { bold: true, gapAfter: 2 });
    drawParagraph(`Do: ${asText(row.do, 'N/A')}`, { size: 10, gapAfter: 2 });
    drawParagraph(`Say: ${asText(row.say, 'N/A')}`, { size: 10, gapAfter: 8 });
  });

  const sprocket = enhancements.sprocket;
  const autodrive = enhancements.autodrive;
  if (sprocket && typeof sprocket === 'object') {
    drawSection('Sprocket');
    drawParagraph(`Likely Stall Reason: ${asText(sprocket.likelyStallReason, 'N/A')}`, { size: 10, gapAfter: 2 });
    drawParagraph(`Smarter Shift: ${asText(sprocket.smarterCadenceShift, 'N/A')}`, { size: 10, gapAfter: 2 });
    drawParagraph(`Message Tip: ${asText(sprocket.messageRewriteTip, 'N/A')}`, { size: 10, gapAfter: 2 });
    drawParagraph(`Delivery Coaching: ${asText(sprocket.deliveryCoaching, 'N/A')}`, { size: 10, gapAfter: 8 });
  }

  if (autodrive && typeof autodrive === 'object') {
    drawSection('AutoDriveCX');
    drawParagraph(`Tailored Reason: ${asText(autodrive.tailoredReason, 'N/A')}`, { size: 10, gapAfter: 2 });
    drawParagraph(`Adjustment: ${asText(autodrive.cadenceAdjustment, 'N/A')}`, { size: 10, gapAfter: 2 });
    drawParagraph(`Focus Skill: ${asText(autodrive.focusSkillTag, 'N/A')}`, { size: 10, gapAfter: 8 });
  }

  drawParagraph('AutoDriveCX', { size: 9, bold: true, color: mutedColor, gapAfter: 0 });
  return pdf.save();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as FollowUpPayload | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false, message: 'Invalid request body.' }, { status: 400 });
    }

    const cadenceDays = body.cadence?.days;
    if (!Array.isArray(cadenceDays) || cadenceDays.length === 0) {
      return NextResponse.json({ ok: false, message: 'Cadence data is required.' }, { status: 400 });
    }

    const buffer = await buildPdf(body);
    const metadata = body.metadata || {};
    const statusPart = safeFilename(asText(metadata.dealStatus, 'follow-up-cadence'));
    const daysPart = safeFilename(asText(metadata.days, 'plan'));
    const filename = `follow-up-cadence-${statusPart}-${daysPart}.pdf`;

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
      { ok: false, message: error?.message || 'Could not generate PDF.' },
      { status: 500 }
    );
  }
}

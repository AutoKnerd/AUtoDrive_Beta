import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import {
  LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION,
  LIVE_SESSION_PRESENTATION_LEADS_COLLECTION,
  type LiveSessionAudienceResponseRecord,
  type LiveSessionPresentationLeadRecord,
} from '@/lib/live-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAGE = {
  width: 612,
  height: 792,
  margin: 48,
  lineHeight: 15,
};

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer;
}

function asText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  return fallback;
}

function normalizeDateRange(value: string | null) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function requireAdminOrDeveloper(request: NextRequest): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!authorization) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized: Missing token.' }, { status: 401 }) };
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized: Invalid token format.' }, { status: 401 }) };
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const decoded = await adminAuth.verifyIdToken(match[1].trim());
  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userDoc.exists) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden: User profile not found.' }, { status: 403 }) };
  }

  const role = String(userDoc.data()?.role || '').trim();
  if (role !== 'Admin' && role !== 'Developer') {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden: Admin access required.' }, { status: 403 }) };
  }

  return { ok: true };
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

function safeFilename(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
}

function buildLeadSummary(lead: LiveSessionPresentationLeadRecord) {
  const contactParts = [lead.email, lead.name, lead.dealership].filter(Boolean).join(' | ');
  const status = lead.email ? 'Captured' : lead.status === 'skipped' ? 'Skipped' : 'Pending';
  return [
    `Contact: ${contactParts || 'No contact captured'}`,
    `Status: ${status}`,
    `Slide: ${lead.slideNumber ? `#${lead.slideNumber}` : lead.currentSlide || '-'}`,
    `Response: ${lead.lastResponseKey || '-'}`,
    `Latest: ${lead.latestAt || '-'}`,
  ].join('\n');
}

function getLeadName(lead: LiveSessionPresentationLeadRecord) {
  return lead.name || lead.email || lead.sessionToken || lead.sessionId || 'Presentation Lead';
}

function collectLeadRows(leads: LiveSessionPresentationLeadRecord[]) {
  return leads
    .filter((lead) => Boolean(lead.email) || lead.status === 'skipped' || lead.finalCtaClicked)
    .sort((left, right) => (right.latestAt || '').localeCompare(left.latestAt || ''));
}

function getResponseDerivedLeads(records: LiveSessionAudienceResponseRecord[]): LiveSessionPresentationLeadRecord[] {
  const leadsById = new Map<string, LiveSessionPresentationLeadRecord>();

  const mergeLead = (lead: LiveSessionPresentationLeadRecord) => {
    const key = lead.id || lead.sessionToken || lead.sessionId || lead.userId;
    const existing = leadsById.get(key);
    if (!existing) {
      leadsById.set(key, lead);
      return;
    }

    const existingLatest = Date.parse(existing.latestAt || existing.updatedAt || existing.createdAt || '');
    const nextLatest = Date.parse(lead.latestAt || lead.updatedAt || lead.createdAt || '');
    const useNext = Number.isNaN(existingLatest) ? true : Number.isNaN(nextLatest) ? false : nextLatest >= existingLatest;

    leadsById.set(key, {
      ...existing,
      ...lead,
      email: lead.email || existing.email,
      name: lead.name || existing.name,
      dealership: lead.dealership || existing.dealership,
      latestAt: useNext ? (lead.latestAt || existing.latestAt) : existing.latestAt,
      updatedAt: useNext ? (lead.updatedAt || existing.updatedAt) : existing.updatedAt,
      createdAt: existing.createdAt || lead.createdAt,
      finalCtaClicked: existing.finalCtaClicked || lead.finalCtaClicked,
    });
  };

  for (const record of records) {
    if (record.responseKey !== 'contact_info' && record.responseKey !== 'contact_info_skip' && record.responseKey !== 'final_cta') {
      continue;
    }

    const selectedValue = record.selectedValue;
    const contact =
      selectedValue && typeof selectedValue === 'object' && !Array.isArray(selectedValue)
        ? (selectedValue as Record<string, unknown>)
        : {};
    const latestAt = asText(record.timestamp) || null;
    const sessionId = asText(record.sessionId) || asText(record.userId);
    const sessionToken = asText(record.sessionToken) || sessionId || asText(record.userId);

    mergeLead({
      id: sessionToken || sessionId || asText(record.userId),
      userId: asText(record.userId),
      sessionId,
      sessionToken,
      email: asText(contact.email) || null,
      name: asText(contact.name) || null,
      dealership: asText(contact.dealership) || null,
      status: record.responseKey === 'contact_info_skip'
        ? 'skipped'
        : record.responseKey === 'final_cta'
          ? 'completed'
          : 'captured',
      deckId: asText(record.deckId) || '',
      slideId: asText(record.slideId) || '',
      currentSlide: asText(record.currentSlide) || '',
      slideNumber: typeof record.slideNumber === 'number' ? record.slideNumber : null,
      lastResponseKey: asText(record.responseKey) || null,
      latestAt,
      createdAt: latestAt,
      updatedAt: latestAt,
      finalCtaClicked: record.responseKey === 'final_cta',
    });
  }

  return Array.from(leadsById.values());
}

async function fetchLeads() {
  const db = getAdminDb();
  const [summarySnapshot, responseSnapshot] = await Promise.all([
    db.collection(LIVE_SESSION_PRESENTATION_LEADS_COLLECTION).get(),
    db.collection(LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION).get(),
  ]);

  const summaryLeads: LiveSessionPresentationLeadRecord[] = summarySnapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    return {
      id: docSnap.id,
      userId: typeof data.userId === 'string' ? data.userId : '',
      sessionId: typeof data.sessionId === 'string' ? data.sessionId : '',
      sessionToken: typeof data.sessionToken === 'string' ? data.sessionToken : '',
      email: typeof data.email === 'string' ? data.email : null,
      name: typeof data.name === 'string' ? data.name : null,
      dealership: typeof data.dealership === 'string' ? data.dealership : null,
      status: data.status === 'skipped' || data.status === 'completed' ? data.status : 'captured',
      deckId: typeof data.deckId === 'string' ? data.deckId : '',
      slideId: typeof data.slideId === 'string' ? data.slideId : '',
      currentSlide: typeof data.currentSlide === 'string' ? data.currentSlide : '',
      slideNumber: typeof data.slideNumber === 'number' ? data.slideNumber : null,
      lastResponseKey: typeof data.lastResponseKey === 'string' ? data.lastResponseKey : null,
      latestAt: typeof data.latestAt === 'string' ? data.latestAt : null,
      createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
      finalCtaClicked: Boolean(data.finalCtaClicked),
    };
  });

  const responseLeads = getResponseDerivedLeads(responseSnapshot.docs.map((docSnap) => docSnap.data() as LiveSessionAudienceResponseRecord));
  const leadById = new Map<string, LiveSessionPresentationLeadRecord>();
  for (const lead of [...summaryLeads, ...responseLeads]) {
    const key = lead.id || lead.sessionToken || lead.sessionId || lead.userId;
    const existing = leadById.get(key);
    if (!existing) {
      leadById.set(key, lead);
      continue;
    }

    leadById.set(key, {
      ...existing,
      ...lead,
      email: lead.email || existing.email,
      name: lead.name || existing.name,
      dealership: lead.dealership || existing.dealership,
      finalCtaClicked: existing.finalCtaClicked || lead.finalCtaClicked,
      latestAt: lead.latestAt || existing.latestAt,
    });
  }

  return Array.from(leadById.values()).filter((lead) => Boolean(lead.email) || lead.status === 'skipped' || lead.finalCtaClicked);
}

async function buildPdf(leads: LiveSessionPresentationLeadRecord[], startDate: string | null, endDate: string | null) {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const titleColor = rgb(0.12, 0.18, 0.25);
  const textColor = rgb(0.16, 0.2, 0.26);
  const mutedColor = rgb(0.38, 0.42, 0.48);

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let cursorY = PAGE.height - PAGE.margin;

  const ensureSpace = (heightNeeded: number) => {
    if (cursorY - heightNeeded >= PAGE.margin) return;
    page = pdf.addPage([PAGE.width, PAGE.height]);
    cursorY = PAGE.height - PAGE.margin;
  };

  const drawLines = (lines: string[], options?: { size?: number; color?: ReturnType<typeof rgb>; bold?: boolean; gapAfter?: number }) => {
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

  const drawParagraph = (text: string, options?: { size?: number; color?: ReturnType<typeof rgb>; bold?: boolean; gapAfter?: number }) => {
    const size = options?.size ?? 11;
    const lines = wrapText(text, PAGE.width - PAGE.margin * 2, options?.bold ? boldFont : regularFont, size);
    drawLines(lines, { ...options, size });
  };

  drawParagraph('Presentation Leads', { size: 20, bold: true, color: titleColor, gapAfter: 2 });
  drawParagraph('AutoKnerd Live Session Snapshot', { size: 10, color: mutedColor, gapAfter: 4 });
  drawParagraph(
    `Date Range: ${startDate || 'Start'} → ${endDate || 'End'}`,
    { size: 10, color: mutedColor, gapAfter: 10 }
  );

  if (!leads.length) {
    drawParagraph('No presentation leads found for this range.', { size: 11, color: mutedColor, gapAfter: 0 });
    return pdf.save();
  }

  leads.forEach((lead, index) => {
    const block = [
      `#${index + 1}  ${getLeadName(lead)}`,
      `Email: ${lead.email || 'Not captured'}`,
      `Dealership: ${lead.dealership || 'Not captured'}`,
      `Status: ${lead.email ? 'Captured' : lead.status === 'skipped' ? 'Skipped' : 'Pending'}`,
      `Latest: ${lead.latestAt || '-'}`,
      `Slide: ${lead.slideNumber ? `#${lead.slideNumber}` : lead.currentSlide || '-'}`,
      `Response: ${lead.lastResponseKey || '-'}`,
      `CTA: ${lead.finalCtaClicked ? 'Yes' : 'No'}`,
    ].join('\n');

    drawParagraph(block, {
      size: 11,
      bold: false,
      gapAfter: 8,
    });
  });

  return pdf.save();
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireAdminOrDeveloper(request);
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');
    const start = normalizeDateRange(startDate);
    const end = endDate ? new Date(`${endDate}T23:59:59.999`) : null;
    const leads = await fetchLeads();
    const filtered = leads.filter((lead) => {
      const stamp = Date.parse(lead.latestAt || lead.updatedAt || lead.createdAt || '');
      if (!Number.isFinite(stamp)) return true;
      if (start && stamp < start.getTime()) return false;
      if (end && stamp > end.getTime()) return false;
      return true;
    });

    const buffer = await buildPdf(filtered, startDate, endDate);
    const filename = `presentation-leads${startDate || endDate ? `-${safeFilename(startDate || 'start')}-${safeFilename(endDate || 'end')}` : ''}.pdf`;

    return new NextResponse(toArrayBuffer(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to export presentation leads.';
    console.error('Unable to export presentation leads.', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import {
  LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION,
  LIVE_SESSION_PRESENTATION_LEADS_COLLECTION,
  type LiveSessionAudienceResponseRecord,
  type LiveSessionPresentationLeadRecord,
} from '@/lib/live-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

function toIso(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function deriveLeadFromResponse(record: LiveSessionAudienceResponseRecord): LiveSessionPresentationLeadRecord | null {
  if (record.responseKey !== 'contact_info' && record.responseKey !== 'contact_info_skip' && record.responseKey !== 'final_cta') {
    return null;
  }

  const selectedValue = record.selectedValue;
  const contact =
    selectedValue && typeof selectedValue === 'object' && !Array.isArray(selectedValue)
      ? (selectedValue as Record<string, unknown>)
      : {};

  const sessionId = normalizeText(record.sessionId) || normalizeText(record.userId);
  const sessionToken = normalizeText(record.sessionToken) || sessionId || normalizeText(record.userId);
  const latestAt = normalizeText(record.timestamp) || null;

  return {
    id: sessionToken || sessionId || normalizeText(record.userId),
    userId: normalizeText(record.userId),
    sessionId,
    sessionToken,
    email: normalizeText(contact.email) || null,
    name: normalizeText(contact.name) || null,
    dealership: normalizeText(contact.dealership) || null,
    status: record.responseKey === 'contact_info_skip'
      ? 'skipped'
      : record.responseKey === 'final_cta'
        ? 'completed'
        : 'captured',
    deckId: normalizeText(record.deckId) || '',
    slideId: normalizeText(record.slideId) || '',
    currentSlide: normalizeText(record.currentSlide) || '',
    slideNumber: typeof record.slideNumber === 'number' ? record.slideNumber : null,
    lastResponseKey: normalizeText(record.responseKey) || null,
    latestAt,
    createdAt: latestAt,
    updatedAt: latestAt,
    finalCtaClicked: record.responseKey === 'final_cta',
  };
}

export async function GET(request: NextRequest) {
  try {
    const authCheck = await requireAdminOrDeveloper(request);
    if (!authCheck.ok) {
      return authCheck.response;
    }

    const db = getAdminDb();
    const summarySnapshot = await db.collection(LIVE_SESSION_PRESENTATION_LEADS_COLLECTION).get();
    const responseSnapshot = await db.collection(LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION).get();

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

    summarySnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      mergeLead({
        id: docSnap.id,
        userId: typeof data.userId === 'string' ? data.userId : '',
        sessionId: typeof data.sessionId === 'string' ? data.sessionId : '',
        sessionToken: typeof data.sessionToken === 'string' ? data.sessionToken : '',
        email: typeof data.email === 'string' ? data.email : null,
        name: typeof data.name === 'string' ? data.name : null,
        dealership: typeof data.dealership === 'string' ? data.dealership : null,
        status:
          data.status === 'skipped' || data.status === 'completed'
            ? data.status
            : 'captured',
        deckId: typeof data.deckId === 'string' ? data.deckId : '',
        slideId: typeof data.slideId === 'string' ? data.slideId : '',
        currentSlide: typeof data.currentSlide === 'string' ? data.currentSlide : '',
        slideNumber: typeof data.slideNumber === 'number' ? data.slideNumber : null,
        lastResponseKey: typeof data.lastResponseKey === 'string' ? data.lastResponseKey : null,
        latestAt: typeof data.latestAt === 'string' ? data.latestAt : toIso(data.latestAt),
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : toIso(data.createdAt),
        updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : toIso(data.updatedAt),
        finalCtaClicked: Boolean(data.finalCtaClicked),
      });
    });

    responseSnapshot.docs.forEach((docSnap) => {
      const data = docSnap.data() as Partial<LiveSessionAudienceResponseRecord>;
      const record = {
        ...data,
        userId: normalizeText(data.userId),
        sessionId: normalizeText(data.sessionId) || undefined,
        slideId: normalizeText(data.slideId),
        screenId: normalizeText(data.screenId) || undefined,
        responseKey: normalizeText(data.responseKey) || undefined,
        answer: normalizeText(data.answer),
        timestamp: normalizeText(data.timestamp) || undefined,
        deckId: normalizeText(data.deckId) || undefined,
        slideStep: normalizeText(data.slideStep) || undefined,
        currentSlide: normalizeText(data.currentSlide) || undefined,
        answerLabel: normalizeText(data.answerLabel) || undefined,
        sessionToken: normalizeText(data.sessionToken) || undefined,
      } as LiveSessionAudienceResponseRecord;

      const derived = deriveLeadFromResponse(record);
      if (derived) {
        mergeLead(derived);
      }
    });

    const leads = Array.from(leadsById.values()).sort((left, right) => (right.latestAt || '').localeCompare(left.latestAt || ''));

    return NextResponse.json({
      ok: true,
      leads,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read presentation leads.';
    console.error('Unable to read presentation leads.', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

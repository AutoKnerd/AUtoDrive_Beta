import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';
import {
  LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION,
  LIVE_SESSION_PRESENTATION_LEADS_COLLECTION,
  type LiveSessionAudienceResponseInput,
  type LiveSessionAudienceResponseRecord,
} from '@/lib/live-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function normalizeSlideStep(value: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePresentationLeadContact(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { email: null, name: null, dealership: null };
  }

  const contact = value as Record<string, unknown>;
  return {
    email: normalizeText(contact.email) || null,
    name: normalizeText(contact.name) || null,
    dealership: normalizeText(contact.dealership) || null,
  };
}

function normalizeSlideNumber(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getRecordTimestampValue(record: Partial<LiveSessionAudienceResponseInput> & { createdAt?: unknown }) {
  const explicitTimestamp = Date.parse(normalizeText(record.timestamp));
  if (Number.isFinite(explicitTimestamp)) {
    return explicitTimestamp;
  }

  const createdAt = record.createdAt;
  if (createdAt && typeof createdAt === 'object' && 'toDate' in createdAt) {
    const date = (createdAt as { toDate: () => Date }).toDate();
    return date.getTime();
  }

  return 0;
}

function encodeKeyPart(value: string) {
  return encodeURIComponent(value.trim() || 'none');
}

function buildAudienceResponseDocId(record: LiveSessionAudienceResponseRecord) {
  const identity =
    normalizeText(record.sessionToken)
    || normalizeText(record.sessionId)
    || normalizeText(record.userId);
  const deckId = normalizeText(record.deckId) || 'deck';
  const slideStep = normalizeText(record.slideStep) || normalizeText(record.slideId) || 'slide';
  const responseKey = normalizeText(record.responseKey) || 'default';
  const audienceStep = typeof record.audienceStep === 'number' && Number.isFinite(record.audienceStep)
    ? String(record.audienceStep)
    : 'base';

  return [
    encodeKeyPart(identity || 'anonymous'),
    encodeKeyPart(deckId),
    encodeKeyPart(slideStep),
    encodeKeyPart(responseKey),
    encodeKeyPart(audienceStep),
  ].join('__');
}

function normalizeAnswer(body: Partial<LiveSessionAudienceResponseInput>) {
  const answer = normalizeText(body.answer);
  if (answer) return answer;

  const selectedValue = body.selectedValue;
  if (typeof selectedValue === 'string') return normalizeText(selectedValue);
  if (typeof selectedValue === 'number' || typeof selectedValue === 'boolean') {
    return String(selectedValue);
  }

  if (Array.isArray(selectedValue)) {
    return selectedValue.map((item) => String(item)).join(', ');
  }

  if (selectedValue && typeof selectedValue === 'object') {
    try {
      return JSON.stringify(selectedValue);
    } catch {
      return 'selected';
    }
  }

  return '';
}

async function upsertPresentationLead(record: LiveSessionAudienceResponseRecord) {
  if (
    record.responseKey !== 'contact_info'
    && record.responseKey !== 'contact_info_skip'
    && record.responseKey !== 'final_cta'
  ) {
    return;
  }

  const db = getAdminDb();
  const leadId = normalizeText(record.sessionToken) || normalizeText(record.sessionId) || normalizeText(record.userId);
  if (!leadId) return;

  const contact = normalizePresentationLeadContact(record.selectedValue);
  const leadRef = db.collection(LIVE_SESSION_PRESENTATION_LEADS_COLLECTION).doc(leadId);
  const leadSnap = await leadRef.get();
  const existing = leadSnap.exists ? (leadSnap.data() as Record<string, unknown>) : {};
  const existingCreatedAt =
    typeof existing.createdAt === 'string'
      ? existing.createdAt
      : existing.createdAt && typeof existing.createdAt === 'object' && 'toDate' in existing.createdAt && typeof (existing.createdAt as { toDate?: unknown }).toDate === 'function'
        ? (existing.createdAt as { toDate: () => Date }).toDate().toISOString()
        : null;

  const nowIso = new Date().toISOString();
  const nextData = {
    id: leadId,
    userId: normalizeText(record.userId),
    sessionId: normalizeText(record.sessionId) || normalizeText(record.userId),
    sessionToken: normalizeText(record.sessionToken) || leadId,
    email: contact.email,
    name: contact.name,
    dealership: contact.dealership,
    status: record.responseKey === 'contact_info_skip'
      ? 'skipped'
      : record.responseKey === 'final_cta'
        ? 'completed'
        : 'captured',
    deckId: normalizeText(record.deckId) || null,
    slideId: normalizeText(record.slideId) || null,
    currentSlide: normalizeText(record.currentSlide) || null,
    slideNumber: typeof record.slideNumber === 'number' ? record.slideNumber : null,
    lastResponseKey: normalizeText(record.responseKey) || null,
    latestAt: normalizeText(record.timestamp) || nowIso,
    createdAt: existingCreatedAt || nowIso,
    updatedAt: nowIso,
    finalCtaClicked: record.responseKey === 'final_cta' || Boolean(existing.finalCtaClicked),
  };

  await leadRef.set(
    Object.fromEntries(Object.entries(nextData).filter(([, value]) => value !== undefined)),
    { merge: true },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const deckId = normalizeText(url.searchParams.get('deckId'));
    const slideStep = normalizeSlideStep(url.searchParams.get('slideStep'));
    const currentSlide = normalizeText(url.searchParams.get('currentSlide'));
    const slideNumber = normalizeSlideNumber(url.searchParams.get('slideNumber'));
    const sessionToken = normalizeText(url.searchParams.get('sessionToken'));
    const responseKey = normalizeText(url.searchParams.get('responseKey'));
    const includeDetails = url.searchParams.get('includeDetails') === '1' || url.searchParams.get('includeDetails') === 'true';

    if (!slideStep && !currentSlide && slideNumber === null && !sessionToken) {
      return NextResponse.json({
        ok: true,
        respondentCount: 0,
        responseCount: 0,
        fillPercent: 0,
        latestAt: null,
      });
    }

    const snapshot = await getAdminDb().collection(LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION).get();
    const matchingRecords = snapshot.docs
      .map((doc) => doc.data() as Partial<LiveSessionAudienceResponseInput> & { createdAt?: unknown })
      .filter((record) => {
        if (deckId && normalizeText(record.deckId) !== deckId) return false;
        if (sessionToken && normalizeText(record.sessionToken) !== sessionToken) return false;
        if (slideNumber !== null && typeof record.slideNumber === 'number') {
          return record.slideNumber === slideNumber;
        }
        if (slideStep && normalizeText(record.slideStep) !== slideStep) return false;
        if (!slideStep && currentSlide && normalizeText(record.currentSlide) !== currentSlide) return false;
        if (responseKey && normalizeText(record.responseKey) !== responseKey) return false;
        return true;
      })
      .sort((a, b) => getRecordTimestampValue(b) - getRecordTimestampValue(a));

    const respondentIds = new Set(
      matchingRecords
        .map((record) => normalizeText(record.sessionId) || normalizeText(record.userId))
        .filter((value) => value.length > 0),
    );

    const latestAt = matchingRecords
      .map((record) => normalizeText(record.timestamp))
      .filter((value) => value.length > 0)
      .sort()
      .at(-1) ?? null;

    const respondentCount = respondentIds.size;
    const responseCount = matchingRecords.length;
    const fillPercent = Math.min(100, responseCount * 20);

    return NextResponse.json({
      ok: true,
      respondentCount,
      responseCount,
      fillPercent,
      latestAt,
      ...(includeDetails
        ? {
            records: matchingRecords.map((record) => ({
              userId: normalizeText(record.userId),
              sessionId: normalizeText(record.sessionId) || null,
              slideId: normalizeText(record.slideId),
              screenId: normalizeText(record.screenId) || null,
              responseKey: normalizeText(record.responseKey) || null,
              slideNumber: typeof record.slideNumber === 'number' ? record.slideNumber : null,
              audienceStep: typeof record.audienceStep === 'number' ? record.audienceStep : null,
              answer: normalizeAnswer(record as Partial<LiveSessionAudienceResponseInput>),
              selectedValue: record.selectedValue ?? null,
              timestamp: normalizeText(record.timestamp) || null,
              deckId: normalizeText(record.deckId) || null,
              slideStep: normalizeText(record.slideStep) || null,
              currentSlide: normalizeText(record.currentSlide) || null,
              answerLabel: normalizeText(record.answerLabel) || null,
              sessionToken: normalizeText(record.sessionToken) || null,
              createdAt:
                record.createdAt && typeof record.createdAt === 'object' && 'toDate' in record.createdAt
                  ? (record.createdAt as { toDate: () => Date }).toDate().toISOString()
                  : null,
            })),
          }
        : {}),
    });
  } catch (error) {
    console.error('Unable to read live session response summary.', error);
    return NextResponse.json(
      { error: 'Unable to read live session response summary.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LiveSessionAudienceResponseInput>;
    const userId = normalizeText(body.userId);
    const slideId = normalizeText(body.slideId);
    const answer = normalizeAnswer(body);

    if (!userId || !slideId || !answer) {
      return NextResponse.json(
        { error: 'Missing userId, slideId, or answer.' },
        { status: 400 },
      );
    }

    const record: LiveSessionAudienceResponseRecord = {
      userId,
      sessionId: normalizeText(body.sessionId) || undefined,
      slideId,
      screenId: normalizeText(body.screenId) || undefined,
      responseKey: normalizeText(body.responseKey) || undefined,
      slideNumber: typeof body.slideNumber === 'number' && Number.isFinite(body.slideNumber) ? body.slideNumber : undefined,
      audienceStep: typeof body.audienceStep === 'number' && Number.isFinite(body.audienceStep) ? body.audienceStep : undefined,
      answer,
      selectedValue: body.selectedValue,
      timestamp: normalizeText(body.timestamp) || new Date().toISOString(),
      deckId: normalizeText(body.deckId) || undefined,
      slideStep: normalizeText(body.slideStep) || undefined,
      currentSlide: normalizeText(body.currentSlide) || undefined,
      answerLabel: normalizeText(body.answerLabel) || answer,
      sessionToken: normalizeText(body.sessionToken) || undefined,
      source: 'live-session',
      createdAt: null,
    };

    const responseDocId = buildAudienceResponseDocId(record);
    const responseRef = getAdminDb()
      .collection(LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION)
      .doc(responseDocId);
    const existingSnapshot = await responseRef.get();

    const responseData = Object.fromEntries(
      Object.entries({
        ...record,
        ...(existingSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        updatedAt: FieldValue.serverTimestamp(),
      }).filter(([, value]) => value !== undefined),
    );

    await responseRef.set(responseData, { merge: true });

    await upsertPresentationLead(record);

    return NextResponse.json({
      ok: true,
      responseId: responseDocId,
    });
  } catch (error) {
    console.error('Unable to store live session audience response.', error);
    return NextResponse.json(
      { error: 'Unable to store live session audience response.' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/firebase/admin';
import {
  LIVE_SESSION_AUDIENCE_PRESENCE_COLLECTION,
  LIVE_SESSION_DEFAULT_STATE,
  LIVE_SESSION_ID,
  normalizeLiveSessionState,
  type LiveSessionState,
} from '@/lib/live-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const LIVE_SESSION_COLLECTION_NAME = 'presentation_live_sessions';
const PRESENCE_STALE_MS = 45_000;

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getPresenceEpoch(value: unknown) {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime();
  }

  return 0;
}

async function readCurrentLiveSessionState() {
  const snapshot = await getAdminDb().collection(LIVE_SESSION_COLLECTION_NAME).doc(LIVE_SESSION_ID).get();
  return normalizeLiveSessionState(snapshot.exists ? (snapshot.data() as Partial<LiveSessionState>) : LIVE_SESSION_DEFAULT_STATE);
}

function buildPresenceDocId(sessionToken: string, userId: string) {
  const safeSession = encodeURIComponent(sessionToken);
  const safeUser = encodeURIComponent(userId);
  return `${safeSession}__${safeUser}`;
}

async function countActiveAudience(deckId: string, sessionToken: string) {
  const snapshot = await getAdminDb()
    .collection(LIVE_SESSION_AUDIENCE_PRESENCE_COLLECTION)
    .where('deckId', '==', deckId)
    .where('sessionToken', '==', sessionToken)
    .get();

  const cutoff = Date.now() - PRESENCE_STALE_MS;

  return snapshot.docs.filter((doc) => {
    const data = doc.data() as Record<string, unknown>;
    return getPresenceEpoch(data.updatedAt) >= cutoff;
  }).length;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawDeckId = normalizeText(url.searchParams.get('deckId'));
    const rawSessionToken = normalizeText(url.searchParams.get('sessionToken'));
    const currentState = await readCurrentLiveSessionState();
    const deckId = rawDeckId || currentState.deckId;
    const sessionToken = rawSessionToken || currentState.sessionToken;
    const activeAudienceCount = await countActiveAudience(deckId, sessionToken);

    return NextResponse.json({
      ok: true,
      deckId,
      sessionToken,
      activeAudienceCount,
      staleAfterMs: PRESENCE_STALE_MS,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error) {
    console.error('Unable to read live session presence.', error);
    return NextResponse.json(
      { error: 'Unable to read live session presence.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const userId = normalizeText(body.userId);
    const deckId = normalizeText(body.deckId);
    const sessionToken = normalizeText(body.sessionToken);

    if (!userId || !deckId || !sessionToken) {
      return NextResponse.json(
        { error: 'Missing userId, deckId, or sessionToken.' },
        { status: 400 },
      );
    }

    const nowIso = new Date().toISOString();
    const docId = buildPresenceDocId(sessionToken, userId);

    await getAdminDb()
      .collection(LIVE_SESSION_AUDIENCE_PRESENCE_COLLECTION)
      .doc(docId)
      .set({
        userId,
        deckId,
        sessionToken,
        currentStep: normalizeText(body.currentStep) || null,
        currentSlide: normalizeText(body.currentSlide) || null,
        updatedAt: nowIso,
      }, { merge: true });

    return NextResponse.json({ ok: true, updatedAt: nowIso });
  } catch (error) {
    console.error('Unable to update live session presence.', error);
    return NextResponse.json(
      { error: 'Unable to update live session presence.' },
      { status: 500 },
    );
  }
}

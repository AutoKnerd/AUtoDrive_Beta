import { NextResponse } from 'next/server';
import { getAdminDb } from '@/firebase/admin';
import {
  LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION,
  sanitizeRoomId,
  normalizeLiveSessionState,
} from '@/lib/live-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Live session state docs (room -> { sessionToken, ... }). Mirrors route.ts.
const STATE_COLLECTION = 'presentation_live_sessions';

function text(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  return value == null ? '' : String(value).trim();
}

function ts(record: { timestamp?: unknown; createdAt?: unknown }): number {
  const parsed = Date.parse(text(record.timestamp));
  if (Number.isFinite(parsed)) return parsed;
  const createdAt = record.createdAt as { toDate?: () => Date; _seconds?: number } | null;
  if (createdAt && typeof createdAt === 'object') {
    if (typeof createdAt.toDate === 'function') {
      try { return createdAt.toDate().getTime(); } catch { /* ignore */ }
    }
    if (typeof createdAt._seconds === 'number') return createdAt._seconds * 1000;
  }
  return 0;
}

// Selections are stored comma-joined (e.g. "scc-stopgo,hda,fca"); "none" = no pick.
function splitSlugs(answer: string): string[] {
  return answer
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s && s !== 'none');
}

// GET /api/live-session/tally?room=demo&key=adas-ppt-test-slide22
// Returns a per-slug tally of the room's selections for one response key, using
// each participant's LATEST submission (so re-selecting updates, never double counts).
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const room = sanitizeRoomId(url.searchParams.get('room'));
    const key = text(url.searchParams.get('key'));
    if (!key) {
      return NextResponse.json({ ok: false, error: 'Missing key.' }, { status: 400 });
    }

    const stateDoc = await getAdminDb().collection(STATE_COLLECTION).doc(room).get();
    const sessionToken = stateDoc.exists
      ? normalizeLiveSessionState(stateDoc.data() as Record<string, unknown>).sessionToken
      : '';
    if (!sessionToken) {
      return NextResponse.json({ ok: true, counts: {}, respondents: 0, totalPicks: 0 });
    }

    const snapshot = await getAdminDb().collection(LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION).get();
    const latestByUser = new Map<string, { answer: string; t: number }>();
    snapshot.docs.forEach((doc) => {
      const record = doc.data() as Record<string, unknown>;
      if (text(record.sessionToken) !== sessionToken || text(record.responseKey) !== key) return;
      const userId = text(record.userId);
      if (!userId) return;
      const answer = text(record.answer) || text(record.selectedValue);
      const when = ts(record as { timestamp?: unknown; createdAt?: unknown });
      const prev = latestByUser.get(userId);
      if (!prev || when >= prev.t) latestByUser.set(userId, { answer, t: when });
    });

    const counts: Record<string, number> = {};
    let respondents = 0;
    let totalPicks = 0;
    latestByUser.forEach(({ answer }) => {
      const slugs = splitSlugs(answer);
      if (slugs.length > 0) respondents += 1;
      slugs.forEach((slug) => {
        counts[slug] = (counts[slug] || 0) + 1;
        totalPicks += 1;
      });
    });

    return NextResponse.json({ ok: true, counts, respondents, totalPicks });
  } catch {
    return NextResponse.json({ ok: false, error: 'Tally failed.' }, { status: 500 });
  }
}

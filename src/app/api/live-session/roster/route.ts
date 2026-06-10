import { NextResponse } from 'next/server';
import { getAdminDb } from '@/firebase/admin';
import { sanitizeRoomId } from '@/lib/live-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Audience roster / enrollment submissions (name, dealer code, KUID) captured
// from the companion "Initialize Session" form, scoped per presentation room.
const ROSTER_COLLECTION = 'presentation_live_session_roster';
// Keep recent entries visible on the slide for the length of a session.
const ROSTER_STALE_MS = 1000 * 60 * 60 * 8;

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function epochOf(value: unknown) {
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as {
      room?: string; sessionToken?: string; deckId?: string; slideStep?: string;
      name?: string; dealerCode?: string; kuid?: string; agreed?: boolean;
    };

    const room = sanitizeRoomId(body.room);
    const sessionToken = normalizeText(body.sessionToken);
    const userId = normalizeText(body.userId);
    const name = normalizeText(body.name).slice(0, 80);
    if (!name) {
      return NextResponse.json({ error: 'A name is required.' }, { status: 400 });
    }
    const dealerCode = normalizeText(body.dealerCode).slice(0, 40);
    const kuid = normalizeText(body.kuid).slice(0, 40);
    const nowIso = new Date().toISOString();

    // Scope by sessionToken (unique per room) since the companion only has the
    // token, not the room. Dedupe by the stable audience id (or kuid/name).
    const scope = sessionToken || room;
    const docId = `${slug(scope)}__${slug(userId || kuid || name) || Math.random().toString(36).slice(2, 10)}`;

    await getAdminDb()
      .collection(ROSTER_COLLECTION)
      .doc(docId)
      .set({
        room,
        sessionToken: sessionToken || null,
        userId: userId || null,
        deckId: normalizeText(body.deckId) || null,
        slideStep: normalizeText(body.slideStep) || null,
        name,
        dealerCode: dealerCode || null,
        kuid: kuid || null,
        agreed: body.agreed === true,
        createdAt: nowIso,
        updatedAt: nowIso,
      }, { merge: true });

    return NextResponse.json({ ok: true, name });
  } catch (error) {
    console.error('Unable to record roster entry.', error);
    return NextResponse.json({ error: 'Unable to record roster entry.' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionToken = normalizeText(params.get('sessionToken'));
    const query = sessionToken
      ? getAdminDb().collection(ROSTER_COLLECTION).where('sessionToken', '==', sessionToken)
      : getAdminDb().collection(ROSTER_COLLECTION).where('room', '==', sanitizeRoomId(params.get('room')));
    const snapshot = await query.get();

    const cutoff = Date.now() - ROSTER_STALE_MS;
    const entries = snapshot.docs
      .map((doc) => doc.data() as Record<string, unknown>)
      .filter((data) => epochOf(data.updatedAt ?? data.createdAt) >= cutoff)
      .sort((a, b) => epochOf(a.createdAt) - epochOf(b.createdAt))
      .map((data) => ({
        userId: typeof data.userId === 'string' ? data.userId : null,
        name: typeof data.name === 'string' ? data.name : '',
        dealerCode: typeof data.dealerCode === 'string' ? data.dealerCode : null,
        kuid: typeof data.kuid === 'string' ? data.kuid : null,
      }))
      .filter((entry) => entry.name);

    return NextResponse.json(
      { ok: true, count: entries.length, entries },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Unable to read roster.', error);
    return NextResponse.json({ ok: true, count: 0, entries: [] });
  }
}

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/firebase/admin';
import { LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION } from '@/lib/live-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ROSTER_COLLECTION = 'presentation_live_session_roster';

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

type Answer = {
  responseKey: string;
  slideStep: string;
  answer: string;
  answerLabel: string;
  timestamp: string;
};

// Per-session, per-person memory: ties roster enrollment to every answer that
// person submitted across the whole presentation. Powers the remote's
// "click a name → see their answers" view and the end-of-class report.
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionToken = text(params.get('sessionToken')).trim();
    const wantUserId = text(params.get('userId')).trim();

    if (!sessionToken) {
      return NextResponse.json({ ok: true, people: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const db = getAdminDb();
    const [rosterSnap, responseSnap] = await Promise.all([
      db.collection(ROSTER_COLLECTION).where('sessionToken', '==', sessionToken).get(),
      db.collection(LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION).where('sessionToken', '==', sessionToken).get(),
    ]);

    // Group answers by the audience member's stable id.
    const answersByUser = new Map<string, Answer[]>();
    responseSnap.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const userId = text(data.userId).trim();
      if (!userId) return;
      const list = answersByUser.get(userId) ?? [];
      list.push({
        responseKey: text(data.responseKey),
        slideStep: text(data.slideStep) || text(data.slideId),
        answer: text(data.answer),
        answerLabel: text(data.answerLabel) || text(data.answer),
        timestamp: text(data.timestamp),
      });
      answersByUser.set(userId, list);
    });

    const sortAnswers = (list: Answer[]) =>
      list.sort((a, b) => (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0));

    const people = rosterSnap.docs
      .map((doc) => doc.data() as Record<string, unknown>)
      .map((data) => {
        const userId = text(data.userId).trim();
        return {
          userId,
          name: text(data.name),
          dealerCode: text(data.dealerCode) || null,
          kuid: text(data.kuid) || null,
          enrolledAt: text(data.createdAt),
          answers: sortAnswers(answersByUser.get(userId) ?? []),
        };
      })
      .filter((person) => person.name);

    if (wantUserId) {
      const match = people.find((person) => person.userId === wantUserId)
        ?? { userId: wantUserId, name: 'Guest', dealerCode: null, kuid: null, enrolledAt: '', answers: sortAnswers(answersByUser.get(wantUserId) ?? []) };
      return NextResponse.json({ ok: true, person: match }, { headers: { 'Cache-Control': 'no-store' } });
    }

    people.sort((a, b) => (Date.parse(a.enrolledAt) || 0) - (Date.parse(b.enrolledAt) || 0));
    return NextResponse.json({ ok: true, count: people.length, people }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unable to read session data.', error);
    return NextResponse.json({ ok: true, people: [] });
  }
}

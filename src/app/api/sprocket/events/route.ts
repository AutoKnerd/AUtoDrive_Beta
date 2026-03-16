import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SprocketEventBody = {
  sessionId?: string;
  name?: string;
  user_name?: string;
  role_guess?: string;
  lead_status?: string;
  user_email?: string;
  dealership_name?: string;
  started_at?: string | number | Date | null;
  last_activity?: string | number | Date | null;
  message?: {
    id?: string;
    role?: string;
    message?: string;
    timestamp?: string | number | Date | null;
  } | null;
  lead?: {
    id?: string;
    email?: string;
    dealership?: string;
    name?: string;
    intent?: string;
    source?: string;
    created_at?: string | number | Date | null;
    score?: number;
  } | null;
};

function toTimestamp(value: unknown): Timestamp {
  if (!value) return Timestamp.now();
  if (value instanceof Date) return Timestamp.fromDate(value);
  if (typeof value === 'number') return Timestamp.fromMillis(value);
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return Timestamp.fromDate(parsed);
  }
  return Timestamp.now();
}

function normalizeRole(input: unknown): 'user' | 'assistant' | null {
  const value = String(input || '').trim().toLowerCase();
  if (value === 'user') return 'user';
  if (value === 'assistant' || value === 'bot' || value === 'ai') return 'assistant';
  return null;
}

function getUnauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized sprocket webhook request.' }, { status: 401 });
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.SPROCKET_WEBHOOK_SECRET;
    if (expectedSecret) {
      const providedSecret = request.headers.get('x-sprocket-secret') || '';
      if (!providedSecret || providedSecret !== expectedSecret) {
        return getUnauthorizedResponse();
      }
    }

    const body = (await request.json()) as SprocketEventBody;
    const db = getAdminDb();

    const sessionId = String(body.sessionId || '').trim();
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 });
    }

    const sessionRef = db.collection('sprocket_sessions').doc(sessionId);
    const nowTs = Timestamp.now();

    await sessionRef.set(
      {
        sessionId,
        user_name: body.user_name ?? body.name ?? null,
        role_guess: body.role_guess ?? null,
        lead_status: body.lead_status ?? null,
        user_email: body.user_email ?? null,
        dealership_name: body.dealership_name ?? null,
        started_at: toTimestamp(body.started_at),
        last_activity: body.last_activity ? toTimestamp(body.last_activity) : nowTs,
        updated_at: nowTs,
      },
      { merge: true },
    );

    let messageDocId: string | null = null;
    if (body.message && typeof body.message === 'object') {
      const role = normalizeRole(body.message.role);
      const messageText = String(body.message.message || '').trim();

      if (role && messageText) {
        const messagePayload = {
          role,
          message: messageText,
          timestamp: body.message.timestamp ? toTimestamp(body.message.timestamp) : nowTs,
        };

        if (body.message.id) {
          const ref = sessionRef.collection('messages').doc(String(body.message.id));
          await ref.set(messagePayload, { merge: true });
          messageDocId = ref.id;
        } else {
          const ref = await sessionRef.collection('messages').add(messagePayload);
          messageDocId = ref.id;
        }

        await sessionRef.set({ last_activity: nowTs }, { merge: true });
      }
    }

    let leadDocId: string | null = null;
    if (body.lead && typeof body.lead === 'object') {
      const leadPayload = {
        email: body.lead.email ?? null,
        dealership: body.lead.dealership ?? null,
        name: body.lead.name ?? body.user_name ?? body.name ?? null,
        intent: body.lead.intent ?? null,
        source: body.lead.source ?? 'sprocket_chat',
        created_at: body.lead.created_at ? toTimestamp(body.lead.created_at) : nowTs,
        score: typeof body.lead.score === 'number' ? body.lead.score : null,
        session_id: sessionId,
        updated_at: nowTs,
      };

      if (body.lead.id) {
        const ref = db.collection('sprocket_leads').doc(String(body.lead.id));
        await ref.set(leadPayload, { merge: true });
        leadDocId = ref.id;
      } else {
        const ref = await db.collection('sprocket_leads').add(leadPayload);
        leadDocId = ref.id;
      }
    }

    return NextResponse.json(
      {
        ok: true,
        sessionId,
        messageDocId,
        leadDocId,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to ingest sprocket event.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

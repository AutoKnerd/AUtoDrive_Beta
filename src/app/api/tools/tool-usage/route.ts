import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ToolUsagePayload = {
  toolId?: string;
  role?: string;
  source?: 'tools_page' | 'recommended_tool';
  sessionId?: string;
};

async function readAuthenticatedUser(req: NextRequest): Promise<{ uid: string; user: User } | null> {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) return null;

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1].trim());
    const userSnap = await getAdminDb().collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) return null;
    return {
      uid: decoded.uid,
      user: userSnap.data() as User,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await readAuthenticatedUser(req);
    const body = await req.json().catch(() => null) as ToolUsagePayload | null;
    const toolId = String(body?.toolId || '').trim();
    const source = body?.source === 'recommended_tool' ? 'recommended_tool' : 'tools_page';
    const sessionId = String(body?.sessionId || '').trim().slice(0, 120) || null;

    if (!toolId) {
      return NextResponse.json({ ok: false, message: 'toolId is required.' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const db = getAdminDb();
    const eventRef = db.collection('toolboxToolUsageEvents').doc();
    const summaryRef = db.collection('toolboxToolUsageSummary').doc(toolId);
    const resolvedRole = typeof body?.role === 'string' && body.role.trim().length > 0
      ? body.role.trim()
      : (auth?.user.role || null);

    const eventPayload = {
      toolId,
      source,
      sessionId,
      userId: auth?.uid || null,
      isAuthenticated: Boolean(auth),
      role: resolvedRole,
      createdAt: nowIso,
    };

    const summaryPayload = {
      toolId,
      totalCount: FieldValue.increment(1),
      authenticatedCount: FieldValue.increment(auth ? 1 : 0),
      anonymousCount: FieldValue.increment(auth ? 0 : 1),
      lastOpenedAt: nowIso,
      lastSource: source,
      lastRole: resolvedRole,
      lastUserId: auth?.uid || null,
      updatedAt: nowIso,
    };

    await Promise.all([
      eventRef.set(eventPayload),
      summaryRef.set(summaryPayload, { merge: true }),
    ]);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || 'Failed to track tool usage.' }, { status: 500 });
  }
}

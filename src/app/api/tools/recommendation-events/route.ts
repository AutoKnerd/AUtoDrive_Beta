import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RecommendationEventType =
  | 'recommended_tool_shown'
  | 'recommended_tool_clicked'
  | 'recommended_tool_dismissed'
  | 'recommended_tool_ignored';

type RecommendationEventPayload = {
  type?: RecommendationEventType;
  toolId?: string;
  role?: string;
  mode?: 'BASIC' | 'ACCOUNT' | 'AUTODRIVECX';
  intent?: string;
  metadata?: Record<string, string | number | boolean>;
  createdAt?: string;
};

async function requireAuth(req: NextRequest): Promise<{ uid: string; user: User } | NextResponse> {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  }

  const decoded = await getAdminAuth().verifyIdToken(match[1].trim());
  const userSnap = await getAdminDb().collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) {
    return NextResponse.json({ ok: false, message: 'User profile not found.' }, { status: 404 });
  }

  return {
    uid: decoded.uid,
    user: userSnap.data() as User,
  };
}

function isEventType(value: unknown): value is RecommendationEventType {
  return value === 'recommended_tool_shown'
    || value === 'recommended_tool_clicked'
    || value === 'recommended_tool_dismissed'
    || value === 'recommended_tool_ignored';
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => null) as RecommendationEventPayload | null;
    const type = body?.type;
    const toolId = String(body?.toolId || '').trim();

    if (!isEventType(type) || !toolId) {
      return NextResponse.json({ ok: false, message: 'Valid event type and toolId are required.' }, { status: 400 });
    }

    const event = {
      type,
      toolId,
      role: typeof body?.role === 'string' ? body.role : auth.user.role,
      mode: body?.mode || null,
      intent: typeof body?.intent === 'string' ? body.intent : null,
      metadata: body?.metadata || {},
      createdAt: typeof body?.createdAt === 'string' ? body.createdAt : new Date().toISOString(),
    };

    await getAdminDb()
      .collection('users')
      .doc(auth.uid)
      .collection('toolboxRecommendationEvents')
      .add(event);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || 'Failed to store event.' }, { status: 500 });
  }
}

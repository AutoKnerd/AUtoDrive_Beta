import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import type { CoachingEntityType } from '@/lib/coaching-intelligence/types';
import {
  generateCoachingIntelligence,
  loadCoachingInsights,
  markCoachingInsightResolved,
} from '@/lib/coaching-intelligence/coachingEngine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANAGER_ROLES = new Set([
  'manager',
  'Service Manager',
  'Parts Manager',
  'General Manager',
  'Owner',
  'Trainer',
  'Admin',
  'Developer',
]);

async function requireAuthenticated(req: Request): Promise<{ ok: true; user: User } | { ok: false; response: NextResponse }> {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 }) };
  }
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 }) };
  }
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const decoded = await adminAuth.verifyIdToken(match[1].trim());
  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userDoc.exists) {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 }) };
  }
  const user = userDoc.data() as User;
  return { ok: true, user };
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuthenticated(req);
    if (!auth.ok) return auth.response;
    const url = new URL(req.url);
    const entityType = (url.searchParams.get('entityType') || undefined) as CoachingEntityType | undefined;
    const entityId = url.searchParams.get('entityId') || undefined;
    const includeResolved = url.searchParams.get('includeResolved') === 'true';
    const includeSandboxData = url.searchParams.get('includeSandboxData') === 'true';
    const environment = (url.searchParams.get('environment') === 'sandbox' ? 'sandbox' : 'production') as 'sandbox' | 'production';
    const limit = Number(url.searchParams.get('limit') || '50');

    const hasManagerScope = MANAGER_ROLES.has(auth.user.role);
    if (!hasManagerScope && entityType !== 'consultant') {
      return NextResponse.json({ message: 'Forbidden: Manager/admin access required for this scope.' }, { status: 403 });
    }
    if (!hasManagerScope && entityType === 'consultant' && entityId && entityId !== auth.user.userId) {
      return NextResponse.json({ message: 'Forbidden: Consultants can only view their own coaching insight.' }, { status: 403 });
    }

    const db = getAdminDb();
    const isAdminScope = auth.user.role === 'Admin' || auth.user.role === 'Developer';
    const managerDealerIds = new Set([
      ...(auth.user.dealershipIds || []),
      ...(auth.user.selfDeclaredDealershipId ? [auth.user.selfDeclaredDealershipId] : []),
    ]);
    if (!isAdminScope && entityType === 'dealer' && entityId && !managerDealerIds.has(entityId)) {
      return NextResponse.json({ message: 'Forbidden: Dealer scope not assigned to this manager.' }, { status: 403 });
    }

    const records = await loadCoachingInsights({
      db,
      entityType,
      entityId,
      includeResolved,
      includeSandboxData,
      environment: includeSandboxData ? 'sandbox' : environment,
      limit: Number.isFinite(limit) ? limit : 50,
    });

    return NextResponse.json({
      count: records.length,
      records,
      latest: records[0] || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load coaching intelligence.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticated(req);
    if (!auth.ok) return auth.response;
    if (!MANAGER_ROLES.has(auth.user.role)) {
      return NextResponse.json({ message: 'Forbidden: Manager/admin access required.' }, { status: 403 });
    }
    const body = await req.json() as {
      includeSandboxData?: boolean;
      environment?: 'sandbox' | 'production';
      entityType?: CoachingEntityType;
      entityId?: string;
    };

    const isAdminScope = auth.user.role === 'Admin' || auth.user.role === 'Developer';
    if (!isAdminScope && body.entityType === 'platform') {
      return NextResponse.json({ message: 'Forbidden: Platform generation requires admin scope.' }, { status: 403 });
    }

    const result = await generateCoachingIntelligence({
      db: getAdminDb(),
      options: {
        includeSandboxData: body.includeSandboxData === true,
        environment: body.environment || 'production',
        entityType: body.entityType,
        entityId: body.entityId,
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate coaching intelligence.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuthenticated(req);
    if (!auth.ok) return auth.response;
    if (!MANAGER_ROLES.has(auth.user.role)) {
      return NextResponse.json({ message: 'Forbidden: Manager/admin access required.' }, { status: 403 });
    }
    const body = await req.json() as { coachingId?: string; resolved?: boolean };
    if (!body.coachingId) {
      return NextResponse.json({ message: 'coachingId is required.' }, { status: 400 });
    }
    await markCoachingInsightResolved({
      db: getAdminDb(),
      coachingId: body.coachingId,
      resolved: body.resolved === true,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update coaching insight.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

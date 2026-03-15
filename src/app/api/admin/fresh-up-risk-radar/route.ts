import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import type { FreshUpRiskRadarFilterInput, FreshUpRiskRadarGenerationInput } from '@/lib/fresh-up-risk-radar/types';
import { generateFreshUpRiskRadar } from '@/lib/fresh-up-risk-radar/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANAGERIAL_ROLES = new Set([
  'manager',
  'Service Manager',
  'Parts Manager',
  'General Manager',
  'Owner',
  'Trainer',
  'Admin',
  'Developer',
]);

async function requireAuthorized(req: Request): Promise<{ ok: true; user: User } | { ok: false; response: NextResponse }> {
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
  if (!MANAGERIAL_ROLES.has(user.role)) {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: Manager/admin access required.' }, { status: 403 }) };
  }
  return { ok: true, user };
}

function parseBool(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuthorized(req);
    if (!auth.ok) return auth.response;
    const db = getAdminDb();
    const url = new URL(req.url);
    const filters: FreshUpRiskRadarFilterInput = {
      riskLevel: (url.searchParams.get('riskLevel') || undefined) as FreshUpRiskRadarFilterInput['riskLevel'],
      riskType: (url.searchParams.get('riskType') || undefined) as FreshUpRiskRadarFilterInput['riskType'],
      dealerId: url.searchParams.get('dealer') || undefined,
      consultantId: url.searchParams.get('consultant') || undefined,
      archetype: url.searchParams.get('archetype') || undefined,
      concern: url.searchParams.get('concern') || undefined,
      version: url.searchParams.get('version') || undefined,
      dateFrom: url.searchParams.get('dateFrom') || undefined,
      dateTo: url.searchParams.get('dateTo') || undefined,
      isActive: parseBool(url.searchParams.get('isActive')),
      environment: (url.searchParams.get('environment') || 'production') as 'sandbox' | 'production',
    };

    const isAdminScope = auth.user.role === 'Admin' || auth.user.role === 'Developer';
    const managerDealerIds = new Set([
      ...(auth.user.dealershipIds || []),
      ...(auth.user.selfDeclaredDealershipId ? [auth.user.selfDeclaredDealershipId] : []),
    ]);
    if (!isAdminScope && filters.dealerId && !managerDealerIds.has(filters.dealerId)) {
      return NextResponse.json({ message: 'Forbidden: Dealer scope not assigned to this manager.' }, { status: 403 });
    }

    let query = db.collection('freshUpRiskRadar')
      .where('environment', '==', filters.environment || 'production');

    if (filters.dateFrom) {
      query = query.where('createdAt', '>=', Timestamp.fromDate(new Date(`${filters.dateFrom}T00:00:00`)));
    } else {
      query = query.where('createdAt', '>=', Timestamp.fromDate(new Date(Date.now() - (120 * 24 * 60 * 60 * 1000))));
    }

    const snap = await query.get();
    const risks = snap.docs
      .map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        return {
          riskId: String(data.riskId || docSnap.id),
          riskType: String(data.riskType || ''),
          entityType: String(data.entityType || ''),
          entityId: String(data.entityId || ''),
          entityName: String(data.entityName || ''),
          riskLevel: String(data.riskLevel || 'low'),
          confidenceLevel: String(data.confidenceLevel || 'low'),
          timeRange: String(data.timeRange || ''),
          message: String(data.message || ''),
          recommendedAction: String(data.recommendedAction || ''),
          supportingMetrics: (data.supportingMetrics as Record<string, unknown> | undefined) || {},
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          resolvedAt: data.resolvedAt instanceof Timestamp ? data.resolvedAt.toDate().toISOString() : undefined,
          isActive: data.isActive !== false,
          environment: String(data.environment || 'production'),
        };
      })
      .filter((row) => filters.riskLevel ? row.riskLevel === filters.riskLevel : true)
      .filter((row) => filters.riskType ? row.riskType === filters.riskType : true)
      .filter((row) => filters.dealerId ? row.entityId === filters.dealerId || row.supportingMetrics.dealerId === filters.dealerId : true)
      .filter((row) => filters.consultantId ? row.entityId === filters.consultantId : true)
      .filter((row) => filters.archetype ? row.entityType === 'archetype' && row.entityId === filters.archetype : true)
      .filter((row) => filters.concern ? row.entityType === 'concern' && row.entityId === filters.concern : true)
      .filter((row) => filters.version ? row.entityType === 'version' && row.entityId === filters.version : true)
      .filter((row) => typeof filters.isActive === 'boolean' ? row.isActive === filters.isActive : true)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      count: risks.length,
      risks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load risk radar.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthorized(req);
    if (!auth.ok) return auth.response;
    const body = await req.json() as FreshUpRiskRadarGenerationInput;
    const result = await generateFreshUpRiskRadar({
      db: getAdminDb(),
      options: {
        includeSandboxData: body.includeSandboxData === true,
        environment: body.environment || 'production',
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate risk radar.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAuthorized(req);
    if (!auth.ok) return auth.response;
    const db = getAdminDb();
    const body = await req.json() as { riskId?: string; isActive?: boolean };
    if (!body.riskId) return NextResponse.json({ message: 'riskId is required.' }, { status: 400 });

    await db.collection('freshUpRiskRadar').doc(body.riskId).set({
      ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
      ...(body.isActive === false ? { resolvedAt: Timestamp.fromDate(new Date()) } : {}),
      updatedAt: Timestamp.fromDate(new Date()),
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update risk.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

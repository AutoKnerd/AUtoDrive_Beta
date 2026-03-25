import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import { loadFreshUpSessionsForExport, loadNamesById } from '@/lib/fresh-up-export/query';
import type { FreshUpWeeklyDigestRequest } from '@/lib/fresh-up-digest/types';
import { generateWeeklyDigest } from '@/lib/fresh-up-digest/engine';
import { generateWeeklyFreshUpDigest, loadWeeklyDigestRecords } from '@/lib/fresh-up-digest/freshUpDigestService';
import { loadActiveRiskHighlights } from '@/lib/fresh-up-risk-radar/engine';

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
  if (!MANAGER_ROLES.has(user.role)) {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: Manager/admin access required.' }, { status: 403 }) };
  }
  return { ok: true, user };
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthorized(req);
    if (!auth.ok) return auth.response;
    const body = await req.json() as FreshUpWeeklyDigestRequest;
    if (!body?.digestType || !body?.lengthMode) {
      return NextResponse.json({ message: 'Missing digestType or lengthMode.' }, { status: 400 });
    }
    const db = getAdminDb();
    const isAdminScope = auth.user.role === 'Admin' || auth.user.role === 'Developer';
    const requestedDealer = body.filters?.dealerId || body.entityId;
    const managerDealerIds = new Set([
      ...(auth.user.dealershipIds || []),
      ...(auth.user.selfDeclaredDealershipId ? [auth.user.selfDeclaredDealershipId] : []),
    ]);
    if (!isAdminScope && requestedDealer && !managerDealerIds.has(requestedDealer)) {
      return NextResponse.json({ message: 'Forbidden: Dealer scope not assigned to this manager.' }, { status: 403 });
    }

    const filters = {
      includeSandboxData: false,
      ...(body.filters ?? {}),
    };
    const sessions = await loadFreshUpSessionsForExport({
      adminDb: db,
      filters,
    });
    const { dealerNameById, userNameById } = await loadNamesById({
      adminDb: db,
      sessions,
    });
    const digest = generateWeeklyDigest({
      request: body,
      context: {
        sessions,
        filters,
        entityId: body.entityId,
        comparisonEntityId: body.comparisonEntityId,
        dealerNameById,
        userNameById,
      },
    });
    const riskHighlights = await loadActiveRiskHighlights({
      db,
      environment: filters.includeSandboxData === true ? 'sandbox' : 'production',
      entityType: body.digestType === 'consultant_weekly' ? 'consultant' : (body.digestType === 'platform_weekly' ? 'platform' : 'dealer'),
      entityId: body.digestType === 'platform_weekly' ? undefined : body.entityId,
      limit: 2,
    });
    if (riskHighlights.length > 0) {
      digest.keyInsights = [...digest.keyInsights, ...riskHighlights.map((line) => `Risk Radar: ${line}`)].slice(0, 8);
    }
    return NextResponse.json(digest);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate weekly digest.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuthorized(req);
    if (!auth.ok) return auth.response;

    const url = new URL(req.url);
    const entityType = url.searchParams.get('entityType') as 'dealer' | 'consultant' | 'platform' | null;
    const entityId = url.searchParams.get('entityId') || undefined;
    const dateFrom = url.searchParams.get('dateFrom') || undefined;
    const dateTo = url.searchParams.get('dateTo') || undefined;
    const latestOnly = url.searchParams.get('latest') === 'true';
    const includeSandboxData = url.searchParams.get('includeSandboxData') === 'true';
    const ensureCurrentWeek = url.searchParams.get('ensureCurrentWeek') === 'true';
    const limit = Number(url.searchParams.get('limit') || (latestOnly ? '1' : '50'));

    const db = getAdminDb();
    const isAdminScope = auth.user.role === 'Admin' || auth.user.role === 'Developer';
    const managerDealerIds = new Set([
      ...(auth.user.dealershipIds || []),
      ...(auth.user.selfDeclaredDealershipId ? [auth.user.selfDeclaredDealershipId] : []),
    ]);
    if (!isAdminScope && entityType === 'dealer' && entityId && !managerDealerIds.has(entityId)) {
      return NextResponse.json({ message: 'Forbidden: Dealer scope not assigned to this manager.' }, { status: 403 });
    }

    if (ensureCurrentWeek) {
      await generateWeeklyFreshUpDigest({
        db,
        includeSandboxData,
        environment: includeSandboxData ? 'sandbox' : 'production',
        force: false,
      });
    }

    const records = await loadWeeklyDigestRecords({
      db,
      entityType: entityType || undefined,
      entityId,
      dateFrom,
      dateTo,
      includeSandboxData,
      environment: includeSandboxData ? 'sandbox' : 'production',
      limit: Number.isFinite(limit) && limit > 0 ? limit : (latestOnly ? 1 : 50),
      latestOnly,
    });

    // Safety net: if no digest is available yet for the requested scope, generate this week's digest batch.
    if (latestOnly && records.length === 0) {
      await generateWeeklyFreshUpDigest({
        db,
        includeSandboxData,
        environment: includeSandboxData ? 'sandbox' : 'production',
        force: false,
      });
      const refreshed = await loadWeeklyDigestRecords({
        db,
        entityType: entityType || undefined,
        entityId,
        dateFrom,
        dateTo,
        includeSandboxData,
        environment: includeSandboxData ? 'sandbox' : 'production',
        limit: Number.isFinite(limit) && limit > 0 ? limit : (latestOnly ? 1 : 50),
        latestOnly,
      });
      return NextResponse.json({
        records: refreshed,
        latest: refreshed[0] || null,
      });
    }

    return NextResponse.json({
      records,
      latest: latestOnly ? (records[0] || null) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load weekly digest records.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

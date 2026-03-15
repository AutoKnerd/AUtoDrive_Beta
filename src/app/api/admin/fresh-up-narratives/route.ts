import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import { loadFreshUpSessionsForExport, loadNamesById } from '@/lib/fresh-up-export/query';
import type { FreshUpNarrativeRequest } from '@/lib/fresh-up-narrative/types';
import { generateFreshUpNarrative } from '@/lib/fresh-up-narrative/engine';
import { loadActiveRiskHighlights } from '@/lib/fresh-up-risk-radar/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdminOrDeveloper(req: Request): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
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
  if (user.role !== 'Admin' && user.role !== 'Developer') {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: Admin access required.' }, { status: 403 }) };
  }
  return { ok: true };
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdminOrDeveloper(req);
    if (!auth.ok) return auth.response;
    const body = await req.json() as FreshUpNarrativeRequest;
    if (!body?.narrativeType || !body?.lengthMode) {
      return NextResponse.json({ message: 'Missing narrativeType or lengthMode.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const filters = {
      includeSandboxData: false,
      ...(body.filters ?? {}),
    };
    const sessions = await loadFreshUpSessionsForExport({
      adminDb,
      filters,
    });
    const { dealerNameById, userNameById } = await loadNamesById({
      adminDb,
      sessions,
    });

    const result = generateFreshUpNarrative({
      narrativeType: body.narrativeType,
      lengthMode: body.lengthMode,
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
      db: adminDb,
      environment: filters.includeSandboxData === true ? 'sandbox' : 'production',
      entityType: body.entityId ? 'dealer' : 'platform',
      entityId: body.entityId,
      limit: 2,
    });
    if (riskHighlights.length > 0) {
      result.narrative = `${result.narrative}\n\nRisk Radar: ${riskHighlights.join(' ')}`;
      result.interpretationLabels = Array.from(new Set([...result.interpretationLabels, 'recurring friction']));
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate narrative.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

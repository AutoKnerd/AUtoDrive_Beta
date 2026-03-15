import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import { runFreshUpBenchmark } from '@/lib/fresh-up-benchmark/engine';
import type { FreshUpBenchmarkRequest } from '@/lib/fresh-up-benchmark/types';
import { loadFreshUpSessionsForExport, loadNamesById } from '@/lib/fresh-up-export/query';

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
    const body = await req.json() as FreshUpBenchmarkRequest;
    if (!body?.benchmarkType) {
      return NextResponse.json({ message: 'Missing benchmarkType.' }, { status: 400 });
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

    const userIds = Array.from(new Set(sessions.map((row) => row.userId).filter(Boolean)));
    const dealerIds = Array.from(new Set(sessions.map((row) => row.dealerId).filter(Boolean)));
    const userMetadataById = new Map<string, Record<string, unknown>>();
    const dealerMetadataById = new Map<string, Record<string, unknown>>();

    await Promise.all(userIds.map(async (userId) => {
      const snap = await adminDb.collection('users').doc(userId).get();
      if (!snap.exists) return;
      userMetadataById.set(userId, (snap.data() as Record<string, unknown>) ?? {});
    }));
    await Promise.all(dealerIds.map(async (dealerId) => {
      const snap = await adminDb.collection('dealerships').doc(dealerId).get();
      if (!snap.exists) return;
      dealerMetadataById.set(dealerId, (snap.data() as Record<string, unknown>) ?? {});
    }));

    const result = runFreshUpBenchmark({
      request: body,
      context: {
        sessions,
        filters,
        userNameById,
        dealerNameById,
        userMetadataById,
        dealerMetadataById,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate benchmark.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

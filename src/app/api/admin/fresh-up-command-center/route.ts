import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import { buildFreshUpCommandCenter } from '@/lib/fresh-up-command-center/engine';
import type { FreshUpCommandCenterRequest } from '@/lib/fresh-up-command-center/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set([
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
  if (!ALLOWED_ROLES.has(user.role)) {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: Manager/admin access required.' }, { status: 403 }) };
  }
  return { ok: true, user };
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthorized(req);
    if (!auth.ok) return auth.response;
    const body = await req.json() as FreshUpCommandCenterRequest;
    if (!body?.entityMode) {
      return NextResponse.json({ message: 'Missing entityMode.' }, { status: 400 });
    }

    const isAdminScope = auth.user.role === 'Admin' || auth.user.role === 'Developer';
    const managerDealerIds = new Set([
      ...(auth.user.dealershipIds || []),
      ...(auth.user.selfDeclaredDealershipId ? [auth.user.selfDeclaredDealershipId] : []),
    ]);
    if (!isAdminScope && body.entityMode === 'dealer' && body.entityId && !managerDealerIds.has(body.entityId)) {
      return NextResponse.json({ message: 'Forbidden: Dealer scope not assigned to this manager.' }, { status: 403 });
    }

    const result = await buildFreshUpCommandCenter({
      db: getAdminDb(),
      request: {
        ...body,
        filters: {
          includeSandboxData: false,
          ...(body.filters || {}),
        },
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build command center.';
    return NextResponse.json({ message }, { status: 500 });
  }
}


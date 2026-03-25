import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import { getGmDashboardData } from '@/lib/dealer-dashboard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAuthenticatedUser(req: Request): Promise<{ user: User } | { response: NextResponse }> {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return { response: NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 }) };
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return { response: NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 }) };
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const decoded = await adminAuth.verifyIdToken(match[1].trim());
  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();

  if (!userDoc.exists) {
    return { response: NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 }) };
  }

  return { user: userDoc.data() as User };
}

export async function GET(req: Request) {
  try {
    const auth = await requireAuthenticatedUser(req);
    if ('response' in auth) {
      return auth.response;
    }

    const { user } = auth;
    const allowedRoles = new Set(['General Manager', 'manager', 'Owner', 'Admin', 'Developer']);
    if (!allowedRoles.has(user.role)) {
      return NextResponse.json({ message: 'Forbidden: GM access required.' }, { status: 403 });
    }

    const url = new URL(req.url);
    const requestedDealershipId = (url.searchParams.get('dealershipId') || '').trim();
    const isAdminOverride = user.role === 'Admin' || user.role === 'Developer';
    const assignedDealershipIds = new Set([
      ...(user.dealershipIds || []),
      ...(user.selfDeclaredDealershipId ? [user.selfDeclaredDealershipId] : []),
    ]);
    const dealershipId = requestedDealershipId || user.dealershipIds?.[0] || user.selfDeclaredDealershipId || '';

    if (!isAdminOverride && requestedDealershipId && !assignedDealershipIds.has(requestedDealershipId)) {
      return NextResponse.json({ message: 'Forbidden: You do not have access to this dealership.' }, { status: 403 });
    }

    if (!dealershipId) {
      return NextResponse.json({ message: 'No dealership assigned.' }, { status: 400 });
    }

    const data = await getGmDashboardData(dealershipId);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load GM dashboard.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import { getSalespersonDashboardData, markSalespersonMissionComplete } from '@/lib/dealer-dashboard';

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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req);
    if ('response' in auth) {
      return auth.response;
    }

    const data = await getSalespersonDashboardData(auth.user);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load salesperson dashboard.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req);
    if ('response' in auth) {
      return auth.response;
    }

    await markSalespersonMissionComplete(auth.user);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete mission.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedRoles = new Set([
  'Admin',
  'Developer',
  'Owner',
  'Trainer',
  'General Manager',
  'manager',
  'Service Manager',
  'Parts Manager',
  'Finance Manager',
]);

const globalRoles = new Set(['Admin', 'Developer', 'Trainer']);

export async function GET(req: Request) {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match || !match[1]) {
    return NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 });
  }

  const dealershipId = new URL(req.url).searchParams.get('dealershipId');
  if (!dealershipId) {
    return NextResponse.json({ message: 'Bad Request: dealershipId is required.' }, { status: 400 });
  }

  try {
    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(match[1].trim());

    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 });
    }

    const user = userDoc.data() as User;
    if (!allowedRoles.has(user.role)) {
      return NextResponse.json({ message: 'Forbidden: Insufficient permissions.' }, { status: 403 });
    }

    const isGlobalRole = globalRoles.has(user.role);
    const hasDealershipAccess = Array.isArray(user.dealershipIds) && user.dealershipIds.includes(dealershipId);
    if (!isGlobalRole && !hasDealershipAccess) {
      return NextResponse.json({ message: 'Forbidden: No access to this dealership.' }, { status: 403 });
    }

    const snapshot = await adminDb
      .collection('emailInvitations')
      .where('dealershipId', '==', dealershipId)
      .get();

    const pendingInvitations = snapshot.docs
      .map((doc) => ({ token: doc.id, ...doc.data() }))
      .filter((invite: any) => !invite.claimed)
      .sort((a: any, b: any) => {
        const aMs = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
        const bMs = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
        return bMs - aMs;
      })
      .map((invite: any) => ({
        token: invite.token,
        dealershipId: invite.dealershipId,
        dealershipName: invite.dealershipName,
        role: invite.role,
        email: invite.email,
        claimed: !!invite.claimed,
        inviterId: invite.inviterId,
        createdAt: invite.createdAt?.toDate?.()?.toISOString?.() ?? null,
        expiresAt: invite.expiresAt?.toDate?.()?.toISOString?.() ?? null,
      }));

    return NextResponse.json({ pendingInvitations }, { status: 200 });
  } catch (error: any) {
    console.error('[API PendingInvitations] Error:', error);

    if (error?.code === 'admin/not-initialized') {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (error?.code?.startsWith?.('auth/')) {
      return NextResponse.json({ message: `Unauthorized: ${error.message}` }, { status: 401 });
    }

    return NextResponse.json(
      { message: error?.message || 'Internal Server Error', code: error?.code || 'INTERNAL_SERVER_ERROR' },
      { status: 500 }
    );
  }
}

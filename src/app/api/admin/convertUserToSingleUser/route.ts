import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = new Set([
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

const GLOBAL_ROLES = new Set(['Admin', 'Developer']);

export async function POST(req: Request) {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 });
  }

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(match[1].trim());

    const actorSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!actorSnap.exists) {
      return NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 });
    }

    const actor = actorSnap.data() as User;
    if (!ALLOWED_ROLES.has(actor.role)) {
      return NextResponse.json({ message: 'Forbidden: Insufficient permissions.' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const targetUserId = body?.targetUserId;
    if (!targetUserId || typeof targetUserId !== 'string') {
      return NextResponse.json({ message: 'Bad Request: targetUserId is required.' }, { status: 400 });
    }

    const targetRef = adminDb.collection('users').doc(targetUserId);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return NextResponse.json({ message: 'Not Found: Target user profile not found.' }, { status: 404 });
    }

    const target = targetSnap.data() as User;
    if (!GLOBAL_ROLES.has(actor.role)) {
      const actorDealershipIds = Array.isArray(actor.dealershipIds) ? actor.dealershipIds : [];
      const targetDealershipIds = Array.isArray(target.dealershipIds) ? target.dealershipIds : [];
      const sharesDealership = targetDealershipIds.some((id) => actorDealershipIds.includes(id));
      if (!sharesDealership) {
        return NextResponse.json({ message: 'Forbidden: You can only update users in your assigned stores.' }, { status: 403 });
      }
    }

    const nextSelfDeclaredDealershipId =
      target.selfDeclaredDealershipId ||
      (Array.isArray(target.dealershipIds) ? target.dealershipIds[0] : undefined) ||
      undefined;

    await targetRef.update({
      dealershipIds: [],
      selfDeclaredDealershipId: nextSelfDeclaredDealershipId ?? null,
      subscriptionStatus: 'inactive',
      trialStartedAt: null,
      trialEndsAt: null,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error('[API convertUserToSingleUser] Error:', { message: e?.message, code: e?.code });
    if (e?.code === 'admin/not-initialized') {
      return NextResponse.json({ message: e.message }, { status: 503 });
    }
    return NextResponse.json({ message: e?.message || 'Failed to convert user.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { UserRole } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_SELF_SELECT_ROLES = new Set<UserRole>([
  'Sales Consultant',
  'manager',
  'Service Writer',
  'Service Manager',
  'Finance Manager',
  'Parts Consultant',
  'Parts Manager',
  'General Manager',
]);
const PRIVACY_POLICY_VERSION = '2026-02-28';

export async function POST(req: Request) {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return NextResponse.json({ message: 'Missing Authorization header.' }, { status: 401 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return NextResponse.json({ message: 'Invalid Authorization header.' }, { status: 401 });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const role = payload?.role as UserRole | undefined;
    const acceptPrivacyPolicy = payload?.acceptPrivacyPolicy === true;

    if (!role && !acceptPrivacyPolicy) {
      return NextResponse.json({ message: 'No profile updates were provided.' }, { status: 400 });
    }

    if (role && !ALLOWED_SELF_SELECT_ROLES.has(role)) {
      return NextResponse.json({ message: 'Selected role is not allowed.' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(match[1].trim());
    const userRef = adminDb.collection('users').doc(decoded.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ message: 'User profile not found.' }, { status: 404 });
    }

    const user = userSnap.data() as { dealershipIds?: string[] };
    if (role && Array.isArray(user.dealershipIds) && user.dealershipIds.length > 0) {
      return NextResponse.json(
        { message: 'Role can only be self-selected before dealership assignment.' },
        { status: 403 }
      );
    }

    const patch: Record<string, unknown> = {};
    if (role) {
      patch.role = role;
    }
    if (acceptPrivacyPolicy) {
      patch.privacyPolicyAcceptedAt = new Date().toISOString();
      patch.privacyPolicyVersion = PRIVACY_POLICY_VERSION;
    }

    await userRef.set(patch, { merge: true });
    return NextResponse.json(
      {
        ok: true,
        role: role || null,
        privacyPolicyAccepted: acceptPrivacyPolicy,
        privacyPolicyVersion: acceptPrivacyPolicy ? PRIVACY_POLICY_VERSION : null,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API Profile Select Role] Error:', error);
    return NextResponse.json(
      { message: error?.message || 'Could not update role.' },
      { status: 500 }
    );
  }
}

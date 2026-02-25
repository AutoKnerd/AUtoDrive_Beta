import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { Dealership, User, UserRole } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const allowedInviterRoles = new Set<UserRole>([
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

const globalRoles = new Set<UserRole>(['Admin', 'Developer', 'Trainer']);

function getPublicOrigin(req: Request): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (host) return `${proto}://${host}`;

  return 'http://localhost:3000';
}

function getAllowedEnrollmentRoles(inviterRole: UserRole): UserRole[] {
  switch (inviterRole) {
    case 'manager':
      return ['Sales Consultant'];
    case 'Service Manager':
      return ['Service Writer'];
    case 'Parts Manager':
      return ['Parts Consultant'];
    case 'Finance Manager':
      return ['Finance Manager'];
    case 'General Manager':
    case 'Owner':
    case 'Trainer':
    case 'Admin':
    case 'Developer':
      return [
        'Owner',
        'General Manager',
        'manager',
        'Service Manager',
        'Parts Manager',
        'Finance Manager',
        'Sales Consultant',
        'Service Writer',
        'Parts Consultant',
      ];
    default:
      return [];
  }
}

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
    const inviterId = decoded.uid;

    const inviterSnap = await adminDb.collection('users').doc(inviterId).get();
    if (!inviterSnap.exists) {
      return NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 });
    }

    const inviter = inviterSnap.data() as User;
    if (!allowedInviterRoles.has(inviter.role)) {
      return NextResponse.json({ message: 'Forbidden: Insufficient permissions.' }, { status: 403 });
    }

    const { dealershipId } = await req.json();
    if (!dealershipId || typeof dealershipId !== 'string') {
      return NextResponse.json({ message: 'Bad Request: dealershipId is required.' }, { status: 400 });
    }

    const isGlobalRole = globalRoles.has(inviter.role);
    const hasScopedAccess = Array.isArray(inviter.dealershipIds) && inviter.dealershipIds.includes(dealershipId);
    if (!isGlobalRole && !hasScopedAccess) {
      return NextResponse.json({ message: 'Forbidden: No access to this dealership.' }, { status: 403 });
    }

    const dealershipSnap = await adminDb.collection('dealerships').doc(dealershipId).get();
    if (!dealershipSnap.exists) {
      return NextResponse.json({ message: 'Bad Request: Dealership not found.' }, { status: 400 });
    }

    const dealership = dealershipSnap.data() as Dealership;
    const allowedRoles = getAllowedEnrollmentRoles(inviter.role);
    if (!allowedRoles.length) {
      return NextResponse.json({ message: 'No enrollable roles available for your account.' }, { status: 400 });
    }

    const enrollmentRef = adminDb.collection('dealershipEnrollmentLinks').doc();
    const enrollmentToken = enrollmentRef.id;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const { Timestamp } = await import('firebase-admin/firestore');

    await enrollmentRef.set({
      token: enrollmentToken,
      dealershipId,
      dealershipName: dealership.name,
      allowedRoles,
      inviterId,
      active: true,
      createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromDate(expiresAt),
      usageCount: 0,
      lastUsedAt: null,
    });

    const origin = getPublicOrigin(req);
    const inviteUrl = `${origin}/enroll?token=${enrollmentToken}`;

    return NextResponse.json(
      {
        token: enrollmentToken,
        inviteUrl,
        dealershipId,
        dealershipName: dealership.name,
        allowedRoles,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API CreateEnrollmentLink] Error:', error);

    if (error && error.code === 'admin/not-initialized') {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (error?.code?.startsWith?.('auth/')) {
      return NextResponse.json({ message: `Unauthorized: ${error.message}` }, { status: 401 });
    }

    return NextResponse.json(
      {
        message: error?.message || 'Internal Server Error',
        code: error?.code || 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

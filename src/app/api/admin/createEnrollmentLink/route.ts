import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { Dealership, User, UserRole } from '@/lib/definitions';
import {
  canUseEnrollmentScope,
  getAllowedEnrollmentRolesForScope,
  getMaxEnrollmentScopeForInviter,
  isEnrollmentScope,
  type EnrollmentScope,
} from '@/lib/enrollment/role-scope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const globalRoles = new Set<UserRole>(['Admin', 'Developer', 'Trainer']);

function normalizeOrigin(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function hostFromOrigin(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

function isLocalHost(host?: string | null): boolean {
  if (!host) return false;
  const normalized = host.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0' || normalized === '::1';
}

function getPublicOrigin(req: Request): string {
  const explicit = normalizeOrigin(
    process.env.NEXT_PUBLIC_INVITE_BASE_URL
    || process.env.INVITE_BASE_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.APP_URL
  );
  const explicitHost = hostFromOrigin(explicit);
  const defaultCanonical = normalizeOrigin('https://autodrivecx.com');

  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  const forwardedHostRaw = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const forwardedHost = forwardedHostRaw?.split(',')[0]?.trim() || null;
  const forwardedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : null;
  const forwardedHostName = forwardedHost?.split(':')[0] || null;

  // If explicit URL is non-local, trust it.
  if (explicit && !isLocalHost(explicitHost)) return explicit;
  if (defaultCanonical) return defaultCanonical;

  // If explicit is local but current request is non-local, prefer request host.
  if (forwardedOrigin && !isLocalHost(forwardedHostName)) return forwardedOrigin;

  // Fallback to explicit/local and then request host.
  if (explicit) return explicit;
  if (forwardedOrigin) return forwardedOrigin;

  return 'http://localhost:3000';
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
    const maxScope = getMaxEnrollmentScopeForInviter(inviter.role);
    if (!maxScope) {
      return NextResponse.json({ message: 'Forbidden: Insufficient permissions.' }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const dealershipId = payload?.dealershipId;
    const requestedScope = payload?.enrollmentScope as EnrollmentScope | undefined;
    if (!dealershipId || typeof dealershipId !== 'string') {
      return NextResponse.json({ message: 'Bad Request: dealershipId is required.' }, { status: 400 });
    }
    if (requestedScope !== undefined && !isEnrollmentScope(requestedScope)) {
      return NextResponse.json({ message: 'Bad Request: enrollmentScope is invalid.' }, { status: 400 });
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
    const selectedScope = requestedScope ?? maxScope;
    if (!canUseEnrollmentScope(inviter.role, selectedScope)) {
      return NextResponse.json(
        { message: 'Forbidden: The selected enrollment scope exceeds your role permissions.' },
        { status: 403 }
      );
    }

    const allowedRoles = getAllowedEnrollmentRolesForScope(selectedScope);
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
      enrollmentScope: selectedScope,
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
        enrollmentScope: selectedScope,
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

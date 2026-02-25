import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User, UserRole } from '@/lib/definitions';
import { buildDefaultPppState } from '@/lib/ppp/state';
import { buildDefaultSaasPppState } from '@/lib/saas-ppp/state';
import { buildTrialWindow } from '@/lib/billing/trial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASELINE = 60;

type EnrollmentDoc = {
  token: string;
  dealershipId: string;
  dealershipName: string;
  allowedRoles: UserRole[];
  active?: boolean;
  usageCount?: number;
  expiresAt?: { toDate?: () => Date } | Date;
};

function buildDefaultStats(now: Date) {
  return {
    empathy: { score: BASELINE, lastUpdated: now },
    listening: { score: BASELINE, lastUpdated: now },
    trust: { score: BASELINE, lastUpdated: now },
    followUp: { score: BASELINE, lastUpdated: now },
    closing: { score: BASELINE, lastUpdated: now },
    relationship: { score: BASELINE, lastUpdated: now },
  };
}

function normalizeUserName(decodedName: string | undefined, email: string): string {
  if (decodedName && decodedName.trim().length > 0) return decodedName.trim();
  const localPart = (email || '').split('@')[0] || 'Member';
  return localPart
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function parseExpiry(input: EnrollmentDoc['expiresAt']): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'object' && typeof input.toDate === 'function') {
    const parsed = input.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
  }
  return null;
}

function isEnrollmentLinkValid(enrollment: EnrollmentDoc): { ok: boolean; message?: string } {
  if (enrollment.active === false) {
    return { ok: false, message: 'This enrollment link is inactive.' };
  }

  const expiry = parseExpiry(enrollment.expiresAt);
  if (expiry && expiry.getTime() < Date.now()) {
    return { ok: false, message: 'This enrollment link has expired.' };
  }

  if (!Array.isArray(enrollment.allowedRoles) || enrollment.allowedRoles.length === 0) {
    return { ok: false, message: 'This enrollment link has no valid roles configured.' };
  }

  return { ok: true };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ message: 'Enrollment token is missing.' }, { status: 400 });
  }

  try {
    const adminDb = getAdminDb();
    const enrollmentRef = adminDb.collection('dealershipEnrollmentLinks').doc(token);
    const enrollmentSnap = await enrollmentRef.get();

    if (!enrollmentSnap.exists) {
      return NextResponse.json({ message: 'Enrollment link not found.' }, { status: 404 });
    }

    const enrollment = enrollmentSnap.data() as EnrollmentDoc;
    const validity = isEnrollmentLinkValid(enrollment);
    if (!validity.ok) {
      return NextResponse.json({ message: validity.message }, { status: 410 });
    }

    return NextResponse.json({
      token: enrollmentSnap.id,
      dealershipId: enrollment.dealershipId,
      dealershipName: enrollment.dealershipName,
      allowedRoles: enrollment.allowedRoles,
    });
  } catch (error: any) {
    console.error('[API Enrollment GET] Error:', error);

    if (error && error.code === 'admin/not-initialized') {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');

  if (!authorization) {
    return NextResponse.json({ message: 'Missing Authorization header.' }, { status: 401 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return NextResponse.json({ message: 'Invalid Authorization header.' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const submittedRole = body?.role as UserRole | undefined;
    const submittedToken = body?.token as string | undefined;
    if (submittedToken && token && submittedToken !== token) {
      return NextResponse.json({ message: 'Token mismatch in request.' }, { status: 400 });
    }
    const effectiveToken = submittedToken || token;
    if (!effectiveToken) {
      return NextResponse.json({ message: 'Enrollment token is missing.' }, { status: 400 });
    }

    if (!submittedRole) {
      return NextResponse.json({ message: 'Selected role is required.' }, { status: 400 });
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(match[1].trim());
    const uid = decoded.uid;
    const authedEmail = (decoded.email || '').toLowerCase();
    if (!authedEmail) {
      return NextResponse.json({ message: 'Authenticated user has no email.' }, { status: 400 });
    }

    const enrollmentRef = adminDb.collection('dealershipEnrollmentLinks').doc(effectiveToken);
    const userRef = adminDb.collection('users').doc(uid);

    await adminDb.runTransaction(async (tx: any) => {
      const enrollmentSnap = await tx.get(enrollmentRef);
      if (!enrollmentSnap.exists) throw new Error('Enrollment link not found.');

      const enrollment = enrollmentSnap.data() as EnrollmentDoc;
      const validity = isEnrollmentLinkValid(enrollment);
      if (!validity.ok) throw new Error(validity.message || 'Invalid enrollment link.');

      if (!enrollment.allowedRoles.includes(submittedRole)) {
        throw new Error('Selected role is not allowed for this enrollment link.');
      }

      const dealershipRef = adminDb.collection('dealerships').doc(enrollment.dealershipId);
      const dealershipSnap = await tx.get(dealershipRef);
      if (!dealershipSnap.exists) throw new Error('Dealership not found.');

      const dealershipData = dealershipSnap.data() as any;
      if (dealershipData?.status === 'deactivated') {
        throw new Error('This dealership is deactivated and cannot accept enrollments.');
      }

      const pppEnabled = dealershipData?.status === 'active' && dealershipData?.enablePppProtocol === true;
      const saasPppEnabled = dealershipData?.status === 'active' && dealershipData?.enableSaasPppTraining === true;

      const userSnap = await tx.get(userRef);
      const now = new Date();
      const { Timestamp } = await import('firebase-admin/firestore');

      if (!userSnap.exists) {
        const trialWindow = buildTrialWindow(now);
        const isPrivilegedRole = submittedRole === 'Admin' || submittedRole === 'Developer';

        tx.set(userRef, {
          userId: uid,
          name: normalizeUserName(decoded.name, authedEmail),
          email: authedEmail,
          role: submittedRole,
          dealershipIds: [enrollment.dealershipId],
          avatarUrl:
            'https://images.unsplash.com/photo-1515086828834-023d61380316?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw5fHxzdGVlcmluZyUyMHdoZWVsfGVufDB8fHx8MTc2ODkxMTAyM3ww&ixlib=rb-4.1.0&q=80&w=1080',
          xp: 0,
          isPrivate: false,
          isPrivateFromOwner: false,
          showDealerCriticalOnly: false,
          memberSince: now.toISOString(),
          subscriptionStatus: isPrivilegedRole ? 'active' : 'trialing',
          trialStartedAt: isPrivilegedRole ? null : trialWindow.trialStartedAt,
          trialEndsAt: isPrivilegedRole ? null : trialWindow.trialEndsAt,
          stats: buildDefaultStats(now),
          ...buildDefaultPppState(pppEnabled),
          ...buildDefaultSaasPppState(saasPppEnabled),
        });
      } else {
        const existing = userSnap.data() as User;
        const existingDealershipIds = Array.isArray(existing.dealershipIds) ? existing.dealershipIds : [];
        const nextDealershipIds = existingDealershipIds.includes(enrollment.dealershipId)
          ? existingDealershipIds
          : [...existingDealershipIds, enrollment.dealershipId];

        const existingRole = existing.role;
        const preserveRole = existingRole === 'Admin' || existingRole === 'Developer';

        tx.update(userRef, {
          dealershipIds: nextDealershipIds,
          role: preserveRole ? existingRole : submittedRole,
          ppp_enabled: existing.ppp_enabled === true || pppEnabled,
          saas_ppp_enabled: existing.saas_ppp_enabled === true || saasPppEnabled,
        });
      }

      tx.update(enrollmentRef, {
        usageCount: Number(enrollment.usageCount || 0) + 1,
        lastUsedAt: Timestamp.now(),
      });
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: any) {
    console.error('[API Enrollment POST] Error:', error);

    if (error && error.code === 'admin/not-initialized') {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (error?.code?.startsWith?.('auth/')) {
      return NextResponse.json({ message: `Unauthorized: ${error.message}` }, { status: 401 });
    }

    return NextResponse.json(
      { message: error?.message || 'Failed to claim enrollment link.' },
      { status: 400 }
    );
  }
}

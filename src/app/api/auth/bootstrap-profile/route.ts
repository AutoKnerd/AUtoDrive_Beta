import { NextResponse } from 'next/server';
import { adminInitErrorMessage, getAdminAuth, getAdminDb } from '@/firebase/admin';
import { buildDefaultPppState } from '@/lib/ppp/state';
import { buildDefaultSaasPppState } from '@/lib/saas-ppp/state';
import type { User, UserRole } from '@/lib/definitions';
import { resolveConsultant } from '@/lib/consultant-referral';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASELINE = 60;
const DEFAULT_ROLE: UserRole = 'Sales Consultant';
const DEFAULT_AVATAR_URL =
  'https://images.unsplash.com/photo-1515086828834-023d61380316?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw5fHxzdGVlcmluZyUyMHdoZWVsfGVufDB8fHx8MTc2ODkxMTAyM3ww&ixlib=rb-4.1.0&q=80&w=1080';

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

function normalizeEmail(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

function normalizeName(value?: string | null): string {
  return String(value || '').trim();
}

function normalizeConsultantReferral(value?: string | null): string | undefined {
  const resolved = resolveConsultant(value || '');
  if (resolved) return resolved.code;
  return undefined;
}

type Decoded = {
  uid: string;
  email?: string | null;
};

export async function POST(req: Request) {
  try {
    const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
    if (!authorization) {
      return NextResponse.json({ ok: false, message: 'Missing authentication token.' }, { status: 401 });
    }

    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match?.[1]) {
      return NextResponse.json({ ok: false, message: 'Invalid authentication token format.' }, { status: 401 });
    }

    let decoded: Decoded;
    try {
      const token = match[1].trim();
      const verified = await getAdminAuth().verifyIdToken(token);
      decoded = { uid: verified.uid, email: (verified as { email?: string | null }).email ?? null };
    } catch (error: any) {
      return NextResponse.json(
        { ok: false, message: error?.message || adminInitErrorMessage || 'Invalid authentication token.' },
        { status: 401 }
      );
    }

    const payload = await req.json().catch(() => ({}));
    const requestedName = normalizeName(payload?.name);
    const requestedEmail = normalizeEmail(payload?.email);
    const tokenEmail = normalizeEmail(decoded.email);

    if (requestedName.length < 2) {
      return NextResponse.json({ ok: false, message: 'Please enter your full name.' }, { status: 400 });
    }

    if (!tokenEmail) {
      return NextResponse.json({ ok: false, message: 'Authenticated user email is missing.' }, { status: 400 });
    }

    if (requestedEmail && requestedEmail !== tokenEmail) {
      return NextResponse.json({ ok: false, message: 'Signup email did not match the authenticated user.' }, { status: 400 });
    }

    const signupRoleInterest = payload?.signupRoleInterest as UserRole | undefined;
    const consultantReferral = normalizeConsultantReferral(payload?.consultantReferral);

    const adminDb = getAdminDb();
    const userRef = adminDb.collection('users').doc(decoded.uid);
    const existingUser = await userRef.get();
    if (existingUser.exists) {
      return NextResponse.json({ ok: true, userId: decoded.uid, existed: true }, { status: 200 });
    }

    const now = new Date();
  const newUser: User = {
    userId: decoded.uid,
    name: requestedName,
    email: tokenEmail,
    role: DEFAULT_ROLE,
    signupRoleInterest,
    dealershipIds: [],
    avatarUrl: DEFAULT_AVATAR_URL,
    xp: 0,
      isPrivate: false,
      isPrivateFromOwner: false,
      showDealerCriticalOnly: true,
      memberSince: now.toISOString(),
      subscriptionStatus: 'inactive',
      trialStartedAt: null,
      trialEndsAt: null,
    stats: buildDefaultStats(now),
    ...buildDefaultPppState(false),
    ...buildDefaultSaasPppState(false),
  };

  if (consultantReferral) {
    newUser.consultant_referral = consultantReferral;
  }

  await userRef.set(newUser);

    return NextResponse.json({ ok: true, userId: decoded.uid, existed: false }, { status: 200 });
  } catch (error: any) {
    console.error('[bootstrap-profile] Failed to create profile:', error);
    return NextResponse.json(
      {
        ok: false,
        message: error?.message || adminInitErrorMessage || 'Could not create signup profile.',
      },
      { status: 500 }
    );
  }
}

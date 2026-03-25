import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { ToolboxSavedEntry } from '@/lib/tools/toolbox';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import {
  canAccessFeature,
  FEATURES,
  getUserEntitlements,
  resolveAutoDriveCxAccess,
  resolvePaidAccess,
} from '@/lib/tools/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AuthContext = {
  uid: string;
  user: User;
};

function resolveTier(user: Partial<User> & { tier?: 'free' | 'pro' }): 'free' | 'pro' {
  return resolvePaidAccess({
    tier: user.tier,
    subscriptionStatus: user.subscriptionStatus,
    giftedFullAccess: Boolean(user.toolboxGiftedFullAccess),
  }) ? 'pro' : 'free';
}

async function requireAuth(req: NextRequest): Promise<AuthContext | NextResponse> {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return NextResponse.json({ ok: false, message: 'Unauthorized.' }, { status: 401 });
  }

  const decoded = await getAdminAuth().verifyIdToken(match[1].trim());
  const userSnap = await getAdminDb().collection('users').doc(decoded.uid).get();
  if (!userSnap.exists) {
    return NextResponse.json({ ok: false, message: 'User profile not found.' }, { status: 404 });
  }

  return {
    uid: decoded.uid,
    user: userSnap.data() as User,
  };
}

function entryCollection(uid: string) {
  return getAdminDb().collection('users').doc(uid).collection('toolboxEntries');
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    const entitlements = getUserEntitlements({
      hasAccount: true,
      hasPaidAccess: resolveTier(auth.user as User & { tier?: 'free' | 'pro' }) === 'pro',
      hasAutoDriveCX: resolveAutoDriveCxAccess({
        hasAutoDriveCX: auth.user.hasAutoDriveCX,
        giftedFullAccess: auth.user.toolboxGiftedFullAccess,
      }),
      toolsUsedCount: Number(auth.user.toolboxToolsUsedCount || 0),
    });
    if (!canAccessFeature(entitlements, FEATURES.HISTORY)) {
      return NextResponse.json(
        { ok: false, message: 'Saved history requires paid Tool Shop access.', code: 'PAYMENT_REQUIRED' },
        { status: 402 }
      );
    }

    const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 12)));
    const snap = await entryCollection(auth.uid)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const entries = snap.docs.map((doc) => doc.data() as ToolboxSavedEntry);
    return NextResponse.json({ ok: true, entries }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || 'Could not load entries.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => null);
    const toolId = String(body?.toolId || '').trim();
    const content = String(body?.content || '').trim();

    if (!toolId || !content) {
      return NextResponse.json({ ok: false, message: 'Tool and content are required.' }, { status: 400 });
    }

    const entitlements = getUserEntitlements({
      hasAccount: true,
      hasPaidAccess: resolveTier(auth.user as User & { tier?: 'free' | 'pro' }) === 'pro',
      hasAutoDriveCX: resolveAutoDriveCxAccess({
        hasAutoDriveCX: auth.user.hasAutoDriveCX,
        giftedFullAccess: auth.user.toolboxGiftedFullAccess,
      }),
      toolsUsedCount: Number(auth.user.toolboxToolsUsedCount || 0),
    });
    if (!canAccessFeature(entitlements, FEATURES.CLOUD_SAVE)) {
      return NextResponse.json(
        { ok: false, message: 'Cloud saves require paid Tool Shop access.', code: 'PAYMENT_REQUIRED' },
        { status: 402 }
      );
    }

    const entry: ToolboxSavedEntry = {
      id: randomBytes(8).toString('hex'),
      toolId,
      content,
      createdAt: new Date().toISOString(),
    };

    await entryCollection(auth.uid).doc(entry.id).set(entry, { merge: true });
    return NextResponse.json({ ok: true, entry }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || 'Could not save entry.' }, { status: 500 });
  }
}

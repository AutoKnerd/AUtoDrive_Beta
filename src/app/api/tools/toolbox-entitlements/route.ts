import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import { getUserEntitlements, resolveAutoDriveCxAccess, resolvePaidAccess } from '@/lib/tools/entitlements';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAuth(req: NextRequest): Promise<{ uid: string; user: User } | NextResponse> {
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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const entitlements = getUserEntitlements({
      hasAccount: true,
      hasPaidAccess: resolvePaidAccess({
        tier: auth.user.tier,
        subscriptionStatus: auth.user.subscriptionStatus,
        giftedFullAccess: Boolean(auth.user.toolboxGiftedFullAccess),
      }),
      hasAutoDriveCX: resolveAutoDriveCxAccess({
        hasAutoDriveCX: auth.user.hasAutoDriveCX,
        giftedFullAccess: auth.user.toolboxGiftedFullAccess,
      }),
      toolsUsedCount: Number(auth.user.toolboxToolsUsedCount || 0),
    });

    return NextResponse.json({ ok: true, entitlements }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || 'Could not load entitlements.' }, { status: 500 });
  }
}

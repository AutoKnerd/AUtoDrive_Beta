import { NextRequest, NextResponse } from 'next/server';
import type { ToolboxSavedEntry } from '@/lib/tools/toolbox';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import { hasActiveSubscriptionStatus } from '@/lib/billing/access';
import type { User } from '@/lib/definitions';
import { validateEntryPayload } from '@/lib/tools/toolbox-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AuthContext = {
  uid: string;
  user: User;
};

type BootstrapBody = {
  action: 'bootstrap_free';
  localEntries?: ToolboxSavedEntry[];
};

type UpgradeBody = {
  action: 'upgrade_to_paid';
};

function normalizeTier(user: Partial<User> & { tier?: 'free' | 'pro' }): 'free' | 'pro' {
  if (user.tier === 'pro') return 'pro';
  if (hasActiveSubscriptionStatus(user.subscriptionStatus)) return 'pro';
  return 'free';
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

  const adminAuth = getAdminAuth();
  const decoded = await adminAuth.verifyIdToken(match[1].trim());
  const userSnap = await getAdminDb().collection('users').doc(decoded.uid).get();

  if (!userSnap.exists) {
    return NextResponse.json({ ok: false, message: 'User profile not found.' }, { status: 404 });
  }

  return {
    uid: decoded.uid,
    user: userSnap.data() as User,
  };
}

async function migrateLocalEntries(uid: string, entries: ToolboxSavedEntry[]): Promise<void> {
  if (!entries.length) return;

  const adminDb = getAdminDb();
  const batch = adminDb.batch();

  entries.forEach((entry) => {
    const docRef = adminDb
      .collection('users')
      .doc(uid)
      .collection('toolboxEntries')
      .doc(entry.id);

    batch.set(docRef, {
      id: entry.id,
      toolId: entry.toolId,
      content: entry.content,
      createdAt: entry.createdAt,
    }, { merge: true });
  });

  await batch.commit();
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json().catch(() => null);
    const action = String(body?.action || '').trim();

    if (action === 'bootstrap_free') {
      return await handleBootstrapFree(auth, body as BootstrapBody);
    }

    if (action === 'upgrade_to_paid') {
      return await handleUpgradeToPaid(auth, body as UpgradeBody);
    }

    return NextResponse.json({ ok: false, message: 'Unsupported action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || 'Account request failed.' }, { status: 500 });
  }
}

async function handleBootstrapFree(auth: AuthContext, body: BootstrapBody) {
  const currentTier = normalizeTier(auth.user as User & { tier?: 'free' | 'pro' });
  const targetTier = currentTier === 'pro' ? 'pro' : 'free';
  const toolAccessLevel = targetTier === 'pro' ? 999 : 3;

  await getAdminDb().collection('users').doc(auth.uid).set(
    {
      tier: targetTier,
      toolAccessLevel,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  const localEntries = Array.isArray(body?.localEntries) ? body.localEntries.filter(validateEntryPayload) : [];
  if (localEntries.length) {
    await migrateLocalEntries(auth.uid, localEntries);
  }

  return NextResponse.json({ ok: true, tier: targetTier, toolAccessLevel }, { status: 200 });
}

async function handleUpgradeToPaid(auth: AuthContext, _body: UpgradeBody) {
  const toolAccessLevel = 999;

  await getAdminDb().collection('users').doc(auth.uid).set(
    {
      tier: 'pro',
      toolAccessLevel,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, tier: 'pro', toolAccessLevel }, { status: 200 });
}

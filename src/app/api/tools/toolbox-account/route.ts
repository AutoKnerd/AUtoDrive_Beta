import { NextRequest, NextResponse } from 'next/server';
import type { ToolboxSavedEntry } from '@/lib/tools/toolbox';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { Dealership, User } from '@/lib/definitions';
import { resolveBillingAccess } from '@/lib/billing/access';
import {
  getUserEntitlements,
  normalizeLegacyToolboxRole,
  resolveAutoDriveCxAccess,
  resolvePaidAccess,
  type ToolboxCapturedRole,
} from '@/lib/tools/entitlements';
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
  toolsUsedCount?: number;
  accountProfile?: {
    email?: string;
    role?: ToolboxCapturedRole;
  } | null;
};

type SyncPaidStatusBody = {
  action: 'sync_paid_status';
};

async function getDealershipSupport(user: User): Promise<boolean> {
  const dealershipIds = Array.isArray(user.dealershipIds) ? user.dealershipIds.filter(Boolean) : [];
  if (!dealershipIds.length) return false;

  const adminDb = getAdminDb();
  const refs = dealershipIds.map((id) => adminDb.collection('dealerships').doc(id));
  const snaps = await adminDb.getAll(...refs);
  const dealerships: Dealership[] = snaps
    .filter((snap) => snap.exists)
    .map((snap) => ({ id: snap.id, ...(snap.data() as Omit<Dealership, 'id'>) }));

  const billing = resolveBillingAccess(user, dealerships);
  return billing.accessGranted && billing.source === 'dealership';
}

function normalizeTier(user: Partial<User> & { tier?: 'free' | 'pro' }, dealershipSupported = false): 'free' | 'pro' {
  return resolvePaidAccess({
    tier: user.tier,
    subscriptionStatus: user.subscriptionStatus,
    giftedFullAccess: Boolean(user.toolboxGiftedFullAccess),
    dealershipSupported,
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
      return NextResponse.json(
        {
          ok: false,
          message: 'Direct upgrade is disabled. Complete payment through checkout first.',
          code: 'PAYMENT_REQUIRED',
        },
        { status: 402 }
      );
    }

    if (action === 'sync_paid_status') {
      return await handleSyncPaidStatus(auth, body as SyncPaidStatusBody);
    }

    return NextResponse.json({ ok: false, message: 'Unsupported action.' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || 'Account request failed.' }, { status: 500 });
  }
}

async function handleBootstrapFree(auth: AuthContext, body: BootstrapBody) {
  const dealershipSupported = await getDealershipSupport(auth.user);
  const currentTier = normalizeTier(auth.user as User & { tier?: 'free' | 'pro' }, dealershipSupported);
  const targetTier = currentTier === 'pro' ? 'pro' : 'free';
  const toolAccessLevel = 999;
  const normalizedToolsUsedCount = Math.max(0, Math.floor(Number(body?.toolsUsedCount || 0)));
  const capturedEmail = String(body?.accountProfile?.email || '').trim().toLowerCase();
  const capturedRole = normalizeLegacyToolboxRole(body?.accountProfile?.role);

  await getAdminDb().collection('users').doc(auth.uid).set(
    {
      tier: targetTier,
      toolAccessLevel,
      ...(capturedEmail ? { toolboxAccountEmail: capturedEmail } : {}),
      toolboxAccountRole: capturedRole,
      toolboxToolsUsedCount: normalizedToolsUsedCount,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  const localEntries = Array.isArray(body?.localEntries) ? body.localEntries.filter(validateEntryPayload) : [];
  if (localEntries.length) {
    await migrateLocalEntries(auth.uid, localEntries);
  }

  const entitlements = getUserEntitlements({
    hasAccount: true,
    hasPaidAccess: targetTier === 'pro',
    hasAutoDriveCX: resolveAutoDriveCxAccess({
      hasAutoDriveCX: auth.user.hasAutoDriveCX,
      giftedFullAccess: auth.user.toolboxGiftedFullAccess,
      dealershipSupported,
    }),
    toolsUsedCount: normalizedToolsUsedCount,
  });

  return NextResponse.json({ ok: true, tier: targetTier, toolAccessLevel, entitlements }, { status: 200 });
}

async function handleSyncPaidStatus(auth: AuthContext, _body: SyncPaidStatusBody) {
  const dealershipSupported = await getDealershipSupport(auth.user);
  const detectedTier = normalizeTier(auth.user as User & { tier?: 'free' | 'pro' }, dealershipSupported);
  const isPaid = detectedTier === 'pro';
  const toolAccessLevel = 999;
  const toolsUsedCount = Number(auth.user.toolboxToolsUsedCount || 0);

  await getAdminDb().collection('users').doc(auth.uid).set({
    tier: detectedTier,
    toolAccessLevel,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  const entitlements = getUserEntitlements({
    hasAccount: true,
    hasPaidAccess: isPaid,
    hasAutoDriveCX: resolveAutoDriveCxAccess({
      hasAutoDriveCX: auth.user.hasAutoDriveCX,
      giftedFullAccess: auth.user.toolboxGiftedFullAccess,
      dealershipSupported,
    }),
    toolsUsedCount,
  });

  return NextResponse.json({ ok: true, tier: detectedTier, toolAccessLevel, isPaid, entitlements }, { status: 200 });
}

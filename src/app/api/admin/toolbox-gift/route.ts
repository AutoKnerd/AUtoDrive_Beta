import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import { hasActiveSubscriptionStatus } from '@/lib/billing/access';
import type { BillingSubscriptionStatus, User } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdminOrDeveloper(req: NextRequest): Promise<{ ok: true; actor: User; actorId: string } | { ok: false; response: NextResponse }> {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 }) };
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 }) };
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const decoded = await adminAuth.verifyIdToken(match[1].trim());
  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userDoc.exists) {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 }) };
  }

  const actor = userDoc.data() as User;
  if (actor.role !== 'Admin' && actor.role !== 'Developer') {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: Admin or Developer access required.' }, { status: 403 }) };
  }

  return { ok: true, actor, actorId: decoded.uid };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminOrDeveloper(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => null);
    const action = String(body?.action || 'gift').trim().toLowerCase();
    const targetUserId = String(body?.targetUserId || '').trim();
    if (!targetUserId) {
      return NextResponse.json({ message: 'Bad Request: targetUserId is required.' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const targetRef = adminDb.collection('users').doc(targetUserId);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) {
      return NextResponse.json({ message: 'Not Found: Target user profile not found.' }, { status: 404 });
    }

    const target = targetSnap.data() as User & {
      toolboxGiftedFullAccess?: boolean;
      toolboxGiftPreviousTier?: 'free' | 'pro';
      toolboxGiftPreviousToolAccessLevel?: number;
      toolboxGiftPreviousHasAutoDriveCX?: boolean;
      toolboxGiftPreviousSubscriptionStatus?: BillingSubscriptionStatus;
    };
    const nowIso = new Date().toISOString();

    if (action === 'revert') {
      const restoredTier = target.toolboxGiftPreviousTier
        ?? (hasActiveSubscriptionStatus(target.subscriptionStatus) ? 'pro' : 'free');
      const restoredToolAccessLevel = Number.isFinite(target.toolboxGiftPreviousToolAccessLevel)
        ? Number(target.toolboxGiftPreviousToolAccessLevel)
        : (restoredTier === 'pro' ? 999 : 3);
      const restoredAutoDriveCx = typeof target.toolboxGiftPreviousHasAutoDriveCX === 'boolean'
        ? target.toolboxGiftPreviousHasAutoDriveCX
        : false;
      const restoredSubscriptionStatus = target.toolboxGiftPreviousSubscriptionStatus
        ?? (restoredTier === 'pro' ? 'active' : (target.subscriptionStatus || 'inactive'));

      await targetRef.set({
        tier: restoredTier,
        toolAccessLevel: restoredToolAccessLevel,
        hasAutoDriveCX: restoredAutoDriveCx,
        subscriptionStatus: restoredSubscriptionStatus,
        toolboxGiftedFullAccess: false,
        toolboxGiftRevertedAt: nowIso,
        toolboxGiftRevertedBy: auth.actorId,
        updatedAt: nowIso,
      }, { merge: true });
    } else {
      const shouldCapturePreviousState = target.toolboxGiftedFullAccess !== true;
      const payload: Record<string, unknown> = {
        tier: 'pro',
        toolAccessLevel: 999,
        hasAutoDriveCX: true,
        subscriptionStatus: 'active',
        toolboxGiftedFullAccess: true,
        toolboxGiftedAt: nowIso,
        toolboxGiftedBy: auth.actorId,
        toolboxGiftSource: 'developer_settings',
        updatedAt: nowIso,
      };

      if (shouldCapturePreviousState) {
        payload.toolboxGiftPreviousTier = target.tier === 'pro' ? 'pro' : 'free';
        payload.toolboxGiftPreviousToolAccessLevel = Number.isFinite(target.toolAccessLevel)
          ? Number(target.toolAccessLevel)
          : (target.tier === 'pro' ? 999 : 3);
        payload.toolboxGiftPreviousHasAutoDriveCX = Boolean(target.hasAutoDriveCX);
        payload.toolboxGiftPreviousSubscriptionStatus = target.subscriptionStatus || 'inactive';
      }

      await targetRef.set(payload, { merge: true });
    }

    const updatedSnap = await targetRef.get();
    const updated = updatedSnap.data() as User;
    return NextResponse.json({
      ok: true,
      action: action === 'revert' ? 'revert' : 'gift',
      user: {
        userId: targetUserId,
        name: updated.name,
        email: updated.email,
        tier: updated.tier,
        hasAutoDriveCX: Boolean(updated.hasAutoDriveCX),
        toolAccessLevel: updated.toolAccessLevel ?? 3,
      },
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Failed to gift AutoShop access.' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import { buildDefaultPppState } from '@/lib/ppp/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANAGER_ROLES = new Set(['Admin', 'Developer']);

async function authenticateRequest(req: Request): Promise<{ uid: string; user: User }> {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    throw new Error('Unauthorized: Missing token.');
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    throw new Error('Unauthorized: Invalid token format.');
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const decoded = await adminAuth.verifyIdToken(match[1].trim());
  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();

  if (!userDoc.exists) {
    throw new Error('Forbidden: User profile not found.');
  }

  const user = userDoc.data() as User;
  return { uid: decoded.uid, user };
}

async function authorizeManagerRequest(req: Request): Promise<{ uid: string; user: User }> {
  const authenticated = await authenticateRequest(req);
  if (!MANAGER_ROLES.has(authenticated.user.role)) {
    throw new Error('Forbidden: Insufficient permissions.');
  }
  return authenticated;
}

export async function GET(req: Request) {
  try {
    await authenticateRequest(req);

    const adminDb = getAdminDb();
    const configDoc = await adminDb.collection('systemSettings').doc('ppp').get();
    const enabled = configDoc.exists && configDoc.data()?.enabled === true;

    return NextResponse.json({ enabled }, { status: 200 });
  } catch (error: any) {
    if (error?.code === 'admin/not-initialized') {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    const message = String(error?.message || 'Failed to load PPP config.');
    if (message.startsWith('Unauthorized:')) {
      return NextResponse.json({ message }, { status: 401 });
    }
    if (message.startsWith('Forbidden:')) {
      return NextResponse.json({ message }, { status: 403 });
    }

    console.error('[API PPP Config][GET] Error:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { uid } = await authorizeManagerRequest(req);

    const body = await req.json().catch(() => null);
    if (!body || typeof body.enabled !== 'boolean') {
      return NextResponse.json({ message: 'Bad Request: enabled must be boolean.' }, { status: 400 });
    }

    const enabled = body.enabled === true;
    const adminDb = getAdminDb();
    const nowIso = new Date().toISOString();

    await adminDb.collection('systemSettings').doc('ppp').set(
      {
        enabled,
        updatedAt: nowIso,
        updatedBy: uid,
      },
      { merge: true }
    );

    const usersSnap = await adminDb.collection('users').get();
    const defaults = buildDefaultPppState(enabled);

    let batch = adminDb.batch();
    let batchCount = 0;
    let updatedUsers = 0;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data() as User;
      const patch: Partial<User> = { ppp_enabled: enabled };

      if (enabled) {
        if (typeof userData.ppp_level !== 'number') patch.ppp_level = defaults.ppp_level;
        if (!userData.ppp_lessons_passed || typeof userData.ppp_lessons_passed !== 'object') {
          patch.ppp_lessons_passed = defaults.ppp_lessons_passed;
        }
        if (typeof userData.ppp_progress_percentage !== 'number') {
          patch.ppp_progress_percentage = defaults.ppp_progress_percentage;
        }
        if (typeof userData.ppp_badge !== 'string') patch.ppp_badge = defaults.ppp_badge;
        if (typeof userData.ppp_abandonment_counter !== 'number') {
          patch.ppp_abandonment_counter = defaults.ppp_abandonment_counter;
        }
        if (typeof userData.ppp_certified !== 'boolean') patch.ppp_certified = defaults.ppp_certified;
      }

      batch.set(userDoc.ref, patch, { merge: true });
      batchCount += 1;
      updatedUsers += 1;

      if (batchCount >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ enabled, updatedUsers }, { status: 200 });
  } catch (error: any) {
    if (error?.code === 'admin/not-initialized') {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    const message = String(error?.message || 'Failed to update PPP config.');
    if (message.startsWith('Unauthorized:')) {
      return NextResponse.json({ message }, { status: 401 });
    }
    if (message.startsWith('Forbidden:')) {
      return NextResponse.json({ message }, { status: 403 });
    }

    console.error('[API PPP Config][POST] Error:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    return NextResponse.json({ message }, { status: 500 });
  }
}

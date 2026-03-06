import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import {
  DEFAULT_CX_AGGRESSIVENESS,
  normalizeCxAggressiveness,
} from '@/lib/stats/updateRollingStats';

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
    const configDoc = await adminDb.collection('systemSettings').doc('cx').get();
    const aggressiveness = normalizeCxAggressiveness(configDoc.data()?.aggressiveness);

    return NextResponse.json({ aggressiveness }, { status: 200 });
  } catch (error: any) {
    if (error?.code === 'admin/not-initialized') {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    const message = String(error?.message || 'Failed to load CX config.');
    if (message.startsWith('Unauthorized:')) {
      return NextResponse.json({ message }, { status: 401 });
    }
    if (message.startsWith('Forbidden:')) {
      return NextResponse.json({ message }, { status: 403 });
    }

    console.error('[API CX Config][GET] Error:', {
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
    const aggressiveness = normalizeCxAggressiveness(body?.aggressiveness ?? DEFAULT_CX_AGGRESSIVENESS);
    const adminDb = getAdminDb();
    const nowIso = new Date().toISOString();

    await adminDb.collection('systemSettings').doc('cx').set(
      {
        aggressiveness,
        updatedAt: nowIso,
        updatedBy: uid,
      },
      { merge: true }
    );

    return NextResponse.json({ aggressiveness }, { status: 200 });
  } catch (error: any) {
    if (error?.code === 'admin/not-initialized') {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    const message = String(error?.message || 'Failed to update CX config.');
    if (message.startsWith('Unauthorized:')) {
      return NextResponse.json({ message }, { status: 401 });
    }
    if (message.startsWith('Forbidden:')) {
      return NextResponse.json({ message }, { status: 403 });
    }

    console.error('[API CX Config][POST] Error:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    return NextResponse.json({ message }, { status: 500 });
  }
}

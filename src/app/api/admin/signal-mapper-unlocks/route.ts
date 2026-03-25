import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLLECTION = 'signalMapperUnlocks';

async function requireAdminOrDeveloper(req: NextRequest): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
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

  const user = userDoc.data() as User;
  const role = String(user.role || '');
  if (role !== 'Admin' && role !== 'Developer') {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: Admin or Developer access required.' }, { status: 403 }) };
  }

  return { ok: true };
}

type UnlockAggregate = {
  email: string;
  firstUnlockedAt: string;
  lastUnlockedAt: string;
  count: number;
};

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdminOrDeveloper(req);
    if (!auth.ok) return auth.response;

    const adminDb = getAdminDb();
    const snap = await adminDb.collection(COLLECTION).orderBy('createdAt', 'desc').limit(1000).get();
    const map = new Map<string, UnlockAggregate>();

    snap.docs.forEach((doc) => {
      const data = doc.data() as Record<string, unknown>;
      const email = String(data.email || '').trim().toLowerCase();
      const createdAt = String(data.createdAt || '').trim();
      if (!email || !createdAt) return;

      const existing = map.get(email);
      if (!existing) {
        map.set(email, {
          email,
          firstUnlockedAt: createdAt,
          lastUnlockedAt: createdAt,
          count: 1,
        });
        return;
      }

      existing.count += 1;
      if (createdAt < existing.firstUnlockedAt) existing.firstUnlockedAt = createdAt;
      if (createdAt > existing.lastUnlockedAt) existing.lastUnlockedAt = createdAt;
    });

    const records = Array.from(map.values()).sort((a, b) => b.lastUnlockedAt.localeCompare(a.lastUnlockedAt));
    return NextResponse.json({ records }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Failed to load signal mapper unlock emails.' }, { status: 500 });
  }
}

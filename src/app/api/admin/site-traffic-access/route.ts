import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';

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

  const decoded = await getAdminAuth().verifyIdToken(match[1].trim());
  const userDoc = await getAdminDb().collection('users').doc(decoded.uid).get();
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
    const action = String(body?.action || 'grant').trim().toLowerCase();
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

    const nowIso = new Date().toISOString();
    if (action === 'revoke') {
      await targetRef.set({
        hasSiteTrafficAccess: false,
        siteTrafficAccessRevokedAt: nowIso,
        siteTrafficAccessRevokedBy: auth.actorId,
        updatedAt: nowIso,
      }, { merge: true });
    } else {
      await targetRef.set({
        hasSiteTrafficAccess: true,
        siteTrafficAccessGrantedAt: nowIso,
        siteTrafficAccessGrantedBy: auth.actorId,
        updatedAt: nowIso,
      }, { merge: true });
    }

    const updatedSnap = await targetRef.get();
    const updated = updatedSnap.data() as User;
    return NextResponse.json({
      ok: true,
      action: action === 'revoke' ? 'revoke' : 'grant',
      user: {
        userId: targetUserId,
        name: updated.name,
        email: updated.email,
        hasSiteTrafficAccess: Boolean(updated.hasSiteTrafficAccess),
      },
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Failed to update site traffic access.' }, { status: 500 });
  }
}

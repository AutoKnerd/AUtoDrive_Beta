import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User, UserRole } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GLOBAL_ROLES = new Set<UserRole>(['Admin', 'Developer']);
const ALLOWED_ROLES = new Set<UserRole>([
  'Admin',
  'Developer',
  'Owner',
  'Trainer',
  'General Manager',
  'manager',
  'Service Manager',
  'Parts Manager',
  'Finance Manager',
]);

export async function POST(req: Request) {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 });
  }

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(match[1].trim());

    const actorSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!actorSnap.exists) {
      return NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 });
    }

    const actor = actorSnap.data() as User;
    if (!ALLOWED_ROLES.has(actor.role)) {
      return NextResponse.json({ message: 'Forbidden: Insufficient permissions.' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const dealershipId = body?.dealershipId;
    if (!dealershipId || typeof dealershipId !== 'string') {
      return NextResponse.json({ message: 'Bad Request: dealershipId is required.' }, { status: 400 });
    }

    if (!GLOBAL_ROLES.has(actor.role)) {
      const actorDealershipIds = Array.isArray(actor.dealershipIds) ? actor.dealershipIds : [];
      if (!actorDealershipIds.includes(dealershipId)) {
        return NextResponse.json({ message: 'Forbidden: No access to this dealership.' }, { status: 403 });
      }
    }

    const usersSnap = await adminDb
      .collection('users')
      .where('dealershipIds', 'array-contains', dealershipId)
      .get();

    const userIds = usersSnap.docs.map((doc) => doc.id);
    if (userIds.length === 0) {
      return NextResponse.json({ ok: true, deletedCount: 0, message: 'No users found for dealership.' }, { status: 200 });
    }

    const assignmentsRef = adminDb.collection('lessonAssignments');
    let deletedCount = 0;

    for (const userId of userIds) {
      const pendingAssignments = await assignmentsRef
        .where('userId', '==', userId)
        .where('completed', '==', false)
        .get();

      if (pendingAssignments.empty) continue;

      const docs = pendingAssignments.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const chunk = docs.slice(i, i + 400);
        const batch = adminDb.batch();
        chunk.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
        deletedCount += chunk.length;
      }
    }

    return NextResponse.json({ ok: true, deletedCount }, { status: 200 });
  } catch (e: any) {
    console.error('[API clearDealershipAssignments] Error:', { message: e?.message, code: e?.code });
    if (e?.code === 'admin/not-initialized') {
      return NextResponse.json({ message: e.message }, { status: 503 });
    }
    return NextResponse.json({ message: e?.message || 'Failed to clear dealership assignments.' }, { status: 500 });
  }
}

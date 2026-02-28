import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/firebase/admin';
import { User } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authorization =
    req.headers.get('authorization') ?? req.headers.get('Authorization');

  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 });
  }

  const token = match[1].trim();

  try {
    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const currentUserId = decodedToken.uid;

    // Get current user to check permissions
    const currentUserDoc = await adminDb.collection('users').doc(currentUserId).get();
    if (!currentUserDoc.exists) {
      return NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 });
    }

    const currentUser = currentUserDoc.data() as User;

    const { targetUserId, dealershipIds } = await req.json();

    if (!targetUserId || !Array.isArray(dealershipIds)) {
      return NextResponse.json({ message: 'Bad Request: Missing or invalid parameters.' }, { status: 400 });
    }

    // Only Admin/Developer can assign to all dealerships
    // Owners can only assign to their own dealerships
    if (currentUser.role === 'Owner') {
      const ownerDealershipIds = currentUser.dealershipIds || [];
      const isValidAssignment = dealershipIds.every(id => ownerDealershipIds.includes(id));
      
      if (!isValidAssignment) {
        return NextResponse.json(
          { message: 'Forbidden: You can only assign users to your managed dealerships.' },
          { status: 403 }
        );
      }
    } else if (!['Admin', 'Developer', 'Trainer', 'General Manager', 'manager'].includes(currentUser.role)) {
      return NextResponse.json({ message: 'Forbidden: Insufficient permissions.' }, { status: 403 });
    }

    // Update the target user's dealership assignments
    const targetUserRef = adminDb.collection('users').doc(targetUserId);
    await targetUserRef.update({ dealershipIds });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error('[API UpdateUserDealerships] Error:', { message: e?.message, code: e?.code, stack: e?.stack });

    if (e && e.code === 'admin/not-initialized') {
      return NextResponse.json({ message: e.message }, { status: 503 });
    }

    return NextResponse.json({ message: e.message || 'Failed to update user dealerships' }, { status: 500 });
  }
}

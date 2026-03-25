import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import { updateCommissionRecordStatus } from '@/lib/consultant-commissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdminUser(req: Request): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
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
  if (user.role !== 'Admin' && user.role !== 'Developer') {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: Admin access required.' }, { status: 403 }) };
  }

  return { ok: true };
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdminUser(req);
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;
    const body = await req.json();
    const action = String(body?.action || '').trim().toLowerCase();

    if (!id) {
      return NextResponse.json({ message: 'Commission record ID is required.' }, { status: 400 });
    }

    if (action !== 'approve' && action !== 'mark_paid') {
      return NextResponse.json({ message: 'Action must be approve or mark_paid.' }, { status: 400 });
    }

    const status = action === 'approve' ? 'approved' : 'paid';
    const record = await updateCommissionRecordStatus(id, status);
    return NextResponse.json({ record }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update payout record.';
    const status = message === 'Commission record not found.' ? 404 : 500;
    return NextResponse.json({ message }, { status });
  }
}

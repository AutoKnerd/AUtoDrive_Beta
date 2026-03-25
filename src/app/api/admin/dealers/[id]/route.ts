import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import { adminUpdateDealerPipeline } from '@/lib/dealer-pipeline-store';
import type { User } from '@/lib/definitions';

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
  if (user.role !== 'Admin') {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: Admin access required.' }, { status: 403 }) };
  }

  return { ok: true };
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminUser(req);
    if (!auth.ok) {
      return auth.response;
    }

    const { id } = await context.params;
    const body = await req.json();

    const record = await adminUpdateDealerPipeline({
      id,
      dealer_name: body?.dealer_name ?? '',
      contact_name: body?.contact_name ?? '',
      contact_email: body?.contact_email ?? '',
      contact_phone: body?.contact_phone ?? '',
      city: body?.city ?? '',
      state: body?.state ?? '',
      consultant_id: body?.consultant_id ?? '',
      stage: body?.stage ?? '',
      notes: body?.notes ?? '',
    });

    return NextResponse.json({ record }, { status: 200 });
  } catch (error: any) {
    console.error('[API Admin Dealers PATCH] Error:', error);
    const badRequestMessages = new Set([
      'Pipeline id, dealer name, contact name, contact email, consultant id, and stage are required.',
      'Invalid stage value.',
      'Dealer pipeline record not found.',
    ]);
    const message = error?.message || 'Failed to update dealer pipeline record.';
    return NextResponse.json({ message }, { status: badRequestMessages.has(message) ? 400 : 500 });
  }
}

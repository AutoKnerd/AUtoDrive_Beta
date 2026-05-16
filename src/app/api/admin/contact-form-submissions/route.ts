import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdminOrDeveloper(req: Request): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
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

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdminOrDeveloper(req);
    if (!auth.ok) return auth.response;

    const body = await req.json() as { submissionId?: string; isTended?: boolean; isSpam?: boolean };
    if (!body.submissionId) {
      return NextResponse.json({ message: 'submissionId is required.' }, { status: 400 });
    }

    const now = Timestamp.fromDate(new Date());
    await getAdminDb().collection('contactFormSubmissions').doc(body.submissionId).set({
      ...(typeof body.isTended === 'boolean' ? {
        isTended: body.isTended,
        tendedAt: body.isTended === true ? now : null,
      } : {}),
      ...(typeof body.isSpam === 'boolean' ? {
        isSpam: body.isSpam,
        spamAt: body.isSpam === true ? now : null,
      } : {}),
      updatedAt: now,
    }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update contact form submission.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

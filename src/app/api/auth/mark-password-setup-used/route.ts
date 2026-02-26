import { NextResponse } from 'next/server';
import { getAdminDb } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { email, setupToken } = (await req.json()) as {
      email?: string;
      setupToken?: string;
    };

    const normalizedEmail = String(email || '').toLowerCase().trim();
    const normalizedToken = String(setupToken || '').trim();
    if (!normalizedEmail || !normalizedToken) {
      return NextResponse.json(
        { message: 'Bad Request: email and setupToken are required.' },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    const userQuery = await adminDb
      .collection('users')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();

    if (userQuery.empty) {
      return NextResponse.json({ message: 'User not found.' }, { status: 404 });
    }

    const userDoc = userQuery.docs[0];
    const existingSetup = userDoc.data()?.passwordSetup || {};

    if (existingSetup.setupToken !== normalizedToken) {
      return NextResponse.json({ message: 'Invalid setup token.' }, { status: 403 });
    }

    await userDoc.ref.set(
      {
        passwordSetup: {
          ...existingSetup,
          status: 'used',
          usedAt: new Date().toISOString(),
          link: null,
          setupToken: null,
          error: null,
        },
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[API mark-password-setup-used] Error:', {
      message: error?.message,
      code: error?.code,
    });
    return NextResponse.json(
      {
        message: error?.message || 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}



import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import { EmailInvitation } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


async function resolveByEmail(userEmail: string) {
  const adminDb = getAdminDb();
  const invitationsRef = adminDb.collection('emailInvitations');
  const q = invitationsRef
    .where('email', '==', userEmail.toLowerCase())
    .where('claimed', '==', false)
    .limit(1);

  const querySnapshot = await q.get();

  if (querySnapshot.empty) {
    return NextResponse.json({ message: 'No pending invitation found for this user.' }, { status: 404 });
  }

  const invitationDoc = querySnapshot.docs[0];
  const invitationData = invitationDoc.data() as EmailInvitation;

  return NextResponse.json({ ...invitationData, token: invitationDoc.id });
}

async function resolveByToken(token: string) {
  const adminDb = getAdminDb();
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ message: 'Bad Request: Missing invitation token.' }, { status: 400 });
  }

  const docRef = adminDb.collection('emailInvitations').doc(token);
  const snap = await docRef.get();

  if (!snap.exists) {
    return NextResponse.json({ message: 'Invitation not found.' }, { status: 404 });
  }

  const data = snap.data() as EmailInvitation;

  if (!data) {
    return NextResponse.json({ message: 'Invitation not found.' }, { status: 404 });
  }

  // Basic safety checks
  if ((data as any).claimed === true) {
    return NextResponse.json({ message: 'Invitation has already been claimed.' }, { status: 409 });
  }

  // Optional expiry support if your invitation docs include `expiresAt`
  const expiresAt: any = (data as any).expiresAt;
  if (expiresAt) {
    const expMs = typeof expiresAt?.toMillis === 'function' ? expiresAt.toMillis() : Date.parse(expiresAt);
    if (!Number.isNaN(expMs) && Date.now() > expMs) {
      return NextResponse.json({ message: 'Invitation has expired.' }, { status: 410 });
    }
  }

  return NextResponse.json({ ...data, token: snap.id });
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  try {
    if (token) {
      return await resolveByToken(token);
    }

    return NextResponse.json(
      { message: 'Bad Request: Provide token as ?token=...' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[API ResolveInvitation][GET] Error:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    if (error && error.code === 'admin/not-initialized') {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (error?.message && error.message.includes('Firebase Admin not initialized')) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authorization = req.headers.get('authorization');

  try {
    // If the caller is already authenticated, keep the original behavior
    if (authorization) {
      const idToken = authorization.replace('Bearer ', '');
      const adminAuth = getAdminAuth();
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const userEmail = decodedToken.email;

      if (!userEmail) {
        return NextResponse.json({ message: 'Forbidden: Auth token is missing email claim.' }, { status: 403 });
      }

      return await resolveByEmail(userEmail);
    }

    // Otherwise, allow resolving by invitation token (from body)
    const body = await req.json().catch(() => ({} as any));
    const token = body?.token as string | undefined;

    if (!token) {
      return NextResponse.json(
        { message: 'Unauthorized: Missing token. Provide Authorization header OR { token } in body.' },
        { status: 401 }
      );
    }

    return await resolveByToken(token);
  } catch (error: any) {
    console.error('[API ResolveInvitation][POST] Error:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });

    if (error && error.code === 'admin/not-initialized') {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (error?.message && error.message.includes('Firebase Admin not initialized')) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (error?.code && String(error.code).startsWith('auth/')) {
      return NextResponse.json(
        {
          code: error.code,
          message: `Unauthorized: ${error.message}`,
        },
        { status: 401 }
      );
    }

    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}

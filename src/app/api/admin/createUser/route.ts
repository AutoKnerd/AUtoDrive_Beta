import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/firebase/admin';

type Decoded = { uid: string; email?: string | null };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function systemHasUsers(adminDb: any): Promise<boolean> {
  try {
    const usersSnapshot = await adminDb
      .collection('users')
      .limit(1)
      .get();
    return !usersSnapshot.empty;
  } catch (error) {
    console.error('[API CreateUser] Error checking if system has users:', error);
    return true;
  }
}

export async function POST(req: Request) {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  let decoded: Decoded | null = null;

  try {
    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();

    const systemEmpty = !(await systemHasUsers(adminDb));

    if (!systemEmpty) {
      if (!authorization) {
        return NextResponse.json(
          { message: 'Unauthorized: Missing authentication token.' },
          { status: 401 }
        );
      }

      const match = /^Bearer\s+(.+)$/i.exec(authorization);
      if (!match?.[1]) {
        return NextResponse.json(
          { message: 'Unauthorized: Invalid token format.' },
          { status: 401 }
        );
      }

      const token = match[1].trim();

      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        decoded = { uid: decodedToken.uid, email: (decodedToken as any).email ?? null };
      } catch (authError: any) {
        return NextResponse.json(
          { message: `Unauthorized: ${authError.message || 'Invalid authentication token.'}` },
          { status: 401 }
        );
      }

      const userDoc = await adminDb.collection('users').doc(decoded.uid).get();

      if (!userDoc.exists) {
        console.log('[API CreateUser] User verified in Firebase Auth but no Firestore record found. Allowing creation for bootstrapping.');
      } else {
        const userRole = userDoc.data()?.role;
        if (!['Admin', 'Developer'].includes(userRole)) {
          return NextResponse.json(
            { message: 'Forbidden: Only Admin or Developer roles can create users.' },
            { status: 403 }
          );
        }
      }
    } else {
      if (authorization) {
        console.log('[API CreateUser] Bootstrap mode: Authorization header provided. Attempting to verify.');
        const match = /^Bearer\s+(.+)$/i.exec(authorization);
        if (match?.[1]) {
          try {
            const decodedToken = await adminAuth.verifyIdToken(match[1].trim());
            decoded = { uid: decodedToken.uid, email: (decodedToken as any).email ?? null };
          } catch (e) {
            console.warn('[API CreateUser] Bootstrap mode: token verification failed; continuing without decoded user.');
          }
        }
      } else {
        console.log('[API CreateUser] Bootstrap mode enabled - system has no users yet, no auth required.');
      }
    }

    const { name, email, phone, role } = await req.json();

    const normalizedEmail = String(email || '').toLowerCase().trim();
    const requestedRole = role;

    if (!name || !normalizedEmail || !requestedRole) {
      return NextResponse.json(
        {
          message: 'Bad Request: name, email, and role are required.',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      );
    }

    const allowedBootstrapRoles = ['Owner', 'General Manager', 'manager'];
    const allowedSelfSignupRoles = ['Sales Consultant', 'Service Writer', 'manager', 'Owner', 'General Manager'];

    let finalRole = requestedRole;

    if (decoded) {
      if (!allowedSelfSignupRoles.includes(finalRole)) {
        finalRole = 'Sales Consultant';
      }
    } else {
      if (!allowedBootstrapRoles.includes(finalRole)) {
        return NextResponse.json(
          {
            message: `Bad Request: Only ${allowedBootstrapRoles.join(', ')} roles can be created without authentication.`,
            code: 'INVALID_ROLE',
          },
          { status: 400 }
        );
      }
    }

    if (decoded?.email && decoded.email.toLowerCase() !== normalizedEmail) {
      return NextResponse.json(
        { message: 'Forbidden: Email does not match authenticated user.', code: 'EMAIL_MISMATCH' },
        { status: 403 }
      );
    }

    const existingUserQuery = await adminDb
      .collection('users')
      .where('email', '==', normalizedEmail)
      .get();

    if (!existingUserQuery.empty) {
      return NextResponse.json(
        {
          message: 'Bad Request: A user with this email already exists.',
          code: 'USER_EXISTS',
        },
        { status: 400 }
      );
    }

    const newUserId = decoded?.uid ?? adminDb.collection('users').doc().id;
    const newUserRef = adminDb.collection('users').doc(newUserId);

    const newUserData = {
      userId: newUserId,
      name,
      email: normalizedEmail,
      role: finalRole,
      dealershipIds: [],
      avatarUrl: 'https://images.unsplash.com/photo-1515086828834-023d61380316?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw5fHxzdGVlcmluZyUyMHdoZWVsfGVufDB8fHx8MTc2ODkxMTAyM3ww&ixlib=rb-4.1.0&q=80&w=1080',
      xp: 0,
      isPrivate: false,
      isPrivateFromOwner: false,
      showDealerCriticalOnly: false,
      memberSince: new Date().toISOString(),
      phone: phone || undefined,
    };

    await newUserRef.set(newUserData, { merge: true });

    console.log(`[API CreateUser] User created successfully: ${newUserId} (${normalizedEmail}, role: ${finalRole})`);

    return NextResponse.json(
      {
        ...newUserData,
        message: 'User created successfully. They can now sign up to access the system.',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API CreateUser] Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    if (error && error.code === 'admin/not-initialized') {
      return NextResponse.json(
        {
          message: 'Service temporarily unavailable. Firebase Admin is not initialized.',
          code: 'SERVICE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    if (error.code && error.code.startsWith('auth/')) {
      return NextResponse.json(
        {
          message: `Authentication Error: ${error.message}`,
          code: error.code,
        },
        { status: 401 }
      );
    }

    const errorResponse: { message: string; code?: string } = {
      message: error.message || 'Internal Server Error',
      code: error.code || 'INTERNAL_SERVER_ERROR',
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

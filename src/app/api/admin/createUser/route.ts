import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Check if any users exist in the system.
 * Used to determine if bootstrap mode is enabled.
 */
async function systemHasUsers(adminDb: any): Promise<boolean> {
  try {
    const usersSnapshot = await adminDb
      .collection('users')
      .limit(1)
      .get();
    return !usersSnapshot.empty;
  } catch (error) {
    // If we can't check, assume users exist (safer default)
    console.error('[API CreateUser] Error checking if system has users:', error);
    return true;
  }
}

export async function POST(req: Request) {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');

  try {
    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();

    // Check if this is a bootstrap scenario (no users exist in the system yet)
    const systemEmpty = !(await systemHasUsers(adminDb));

    // If system has users, require authentication
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

      let decodedToken;
      try {
        decodedToken = await adminAuth.verifyIdToken(token);
      } catch (authError: any) {
        return NextResponse.json(
          { message: `Unauthorized: ${authError.message || 'Invalid authentication token.'}` },
          { status: 401 }
        );
      }

      const userId = decodedToken.uid;
      const userDoc = await adminDb.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        // Special case: If token is valid but user doesn't exist in Firestore,
        // this might be a developer setting up the system. Log and continue.
        // The token verification succeeded, so the user is authenticated in Firebase.
        console.log('[API CreateUser] User verified in Firebase Auth but no Firestore record found. Allowing creation for bootstrapping.');
      } else {
        // User exists in Firestore, verify they have proper role
        const userRole = userDoc.data()?.role;
        if (!['Admin', 'Developer'].includes(userRole)) {
          return NextResponse.json(
            { message: 'Forbidden: Only Admin or Developer roles can create users.' },
            { status: 403 }
          );
        }
      }
    } else {
      // Bootstrap mode: System is empty, allow creation without auth
      // If a token was provided but can't be verified, that's ok - we skip validation
      if (authorization) {
        console.log('[API CreateUser] Bootstrap mode: Authorization header provided but not required.');
      } else {
        console.log('[API CreateUser] Bootstrap mode enabled - system has no users yet, no auth required.');
      }
    }

    const { name, email, phone, role } = await req.json();

    // Validate required fields
    if (!name || !email || !role) {
      return NextResponse.json(
        {
          message: 'Bad Request: name, email, and role are required.',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      );
    }

    // Validate role is one of the allowed bootstrap roles
    const allowedBootstrapRoles = ['Owner', 'General Manager', 'manager'];
    if (!allowedBootstrapRoles.includes(role)) {
      return NextResponse.json(
        {
          message: `Bad Request: Only ${allowedBootstrapRoles.join(', ')} roles can be created.`,
          code: 'INVALID_ROLE',
        },
        { status: 400 }
      );
    }

    // Check if user already exists by email
    const existingUserQuery = await adminDb
      .collection('users')
      .where('email', '==', email)
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

    // Create the new user
    const newUserRef = adminDb.collection('users').doc();
    const newUserId = newUserRef.id;

    const newUserData = {
      userId: newUserId,
      name,
      email,
      role,
      dealershipIds: [],
      avatarUrl: 'https://images.unsplash.com/photo-1515086828834-023d61380316?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHw5fHxzdGVlcmluZyUyMHdoZWVsfGVufDB8fHx8MTc2ODkxMTAyM3ww&ixlib=rb-4.1.0&q=80&w=1080',
      xp: 0,
      isPrivate: false,
      isPrivateFromOwner: false,
      memberSince: new Date().toISOString(),
      subscriptionStatus: 'active',
      phone: phone || undefined,
    };

    // Set custom claims for Firebase Auth
    await adminAuth.setCustomUserClaims(newUserId, {
      role,
      initialized: false,
    });

    // Save the user document
    await newUserRef.set(newUserData);

    console.log(`[API CreateUser] User created successfully: ${newUserId} (${email}, role: ${role})`);

    return NextResponse.json(
      {
        ...newUserData,
        message: 'User created successfully.',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[API CreateUser] Error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });

    // If Admin SDK is not initialized, return 503
    if (error && error.code === 'admin/not-initialized') {
      return NextResponse.json(
        {
          message: 'Service temporarily unavailable. Firebase Admin is not initialized.',
          code: 'SERVICE_UNAVAILABLE',
        },
        { status: 503 }
      );
    }

    // Authentication errors from Firebase
    if (error.code && error.code.startsWith('auth/')) {
      return NextResponse.json(
        {
          message: `Authentication Error: ${error.message}`,
          code: error.code,
        },
        { status: 401 }
      );
    }

    // Generic server error
    const errorResponse: { message: string; code?: string } = {
      message: error.message || 'Internal Server Error',
      code: error.code || 'INTERNAL_SERVER_ERROR',
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

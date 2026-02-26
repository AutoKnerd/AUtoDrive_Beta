import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/firebase/admin';
import { buildDefaultPppState } from '@/lib/ppp/state';
import { buildDefaultSaasPppState } from '@/lib/saas-ppp/state';
import { buildTrialWindow } from '@/lib/billing/trial';

type Decoded = { uid: string; email?: string | null };

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASELINE = 60;

function buildDefaultStats(now: Date) {
  return {
    empathy: { score: BASELINE, lastUpdated: now },
    listening: { score: BASELINE, lastUpdated: now },
    trust: { score: BASELINE, lastUpdated: now },
    followUp: { score: BASELINE, lastUpdated: now },
    closing: { score: BASELINE, lastUpdated: now },
    relationship: { score: BASELINE, lastUpdated: now },
  };
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Lazy-load Timestamp to avoid firebase-admin being imported at build-time
const getTimestamp = async () => {
  const { Timestamp } = await import('firebase-admin/firestore');
  return Timestamp;
};

function normalizeOrigin(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function hostFromOrigin(raw?: string | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).hostname;
  } catch {
    return null;
  }
}

function isLocalHost(host?: string | null): boolean {
  if (!host) return false;
  const normalized = host.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '0.0.0.0' || normalized === '::1';
}

function getPublicOrigin(req: Request): string {
  const explicit = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL);
  const explicitHost = hostFromOrigin(explicit);

  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  const forwardedHostRaw = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const forwardedHost = forwardedHostRaw?.split(',')[0]?.trim() || null;
  const forwardedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : null;
  const forwardedHostName = forwardedHost?.split(':')[0] || null;

  if (explicit && !isLocalHost(explicitHost)) return explicit;
  if (forwardedOrigin && !isLocalHost(forwardedHostName)) return forwardedOrigin;
  if (explicit) return explicit;
  if (forwardedOrigin) return forwardedOrigin;
  return 'http://localhost:3000';
}

function toCustomPasswordSetupLinkWithToken(
  generatedLink: string,
  req: Request,
  email: string,
  setupToken: string
): string | null {
  try {
    const parsed = new URL(generatedLink);
    const oobCode = parsed.searchParams.get('oobCode');
    if (!oobCode) return null;

    const custom = new URL('/set-password', getPublicOrigin(req));
    custom.searchParams.set('oobCode', oobCode);
    custom.searchParams.set('email', email);
    custom.searchParams.set('setupToken', setupToken);
    return custom.toString();
  } catch {
    return null;
  }
}

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
  let decoded: Decoded | null = null;
  let isPrivilegedCreator = false;
  let isBootstrapMode = false;

  try {
    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();

    // Check if this is a bootstrap scenario (no users exist in the system yet)
    const systemEmpty = !(await systemHasUsers(adminDb));
    isBootstrapMode = systemEmpty;

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

      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        decoded = { uid: decodedToken.uid, email: (decodedToken as any).email ?? null };
      } catch (authError: any) {
        return NextResponse.json(
          { message: `Unauthorized: ${authError.message || 'Invalid authentication token.'}` },
          { status: 401 }
        );
      }

      const userId = decoded.uid;
      const userDoc = await adminDb.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        return NextResponse.json(
          { message: 'Forbidden: User profile not found.' },
          { status: 403 }
        );
      }

      // User exists in Firestore, verify they have proper role
      const userRole = userDoc.data()?.role;
      if (!['Admin', 'Developer'].includes(userRole)) {
        return NextResponse.json(
          { message: 'Forbidden: Only Admin or Developer roles can create users.' },
          { status: 403 }
        );
      }
      isPrivilegedCreator = true;
    } else {
      // Bootstrap mode: system has no users yet. Auth is not required, but if provided we will verify it.
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

    const payload = await req.json();
    const {
      name,
      email,
      phone,
      role,
      dealershipId,
      newDealership,
    } = payload as {
      name?: string;
      email?: string;
      phone?: string;
      role?: string;
      dealershipId?: string;
      newDealership?: {
        name?: string;
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
      };
    };

    const normalizedEmail = String(email || '').toLowerCase().trim();
    const normalizedPhone = normalizeOptionalString(phone);
    const requestedRole = role;
    const requestedDealershipId = normalizeOptionalString(dealershipId);
    const requestedNewDealershipName = normalizeOptionalString(newDealership?.name);
    const requestedNewDealershipAddress: Record<string, string> = {};
    const street = normalizeOptionalString(newDealership?.street);
    const city = normalizeOptionalString(newDealership?.city);
    const state = normalizeOptionalString(newDealership?.state);
    const zip = normalizeOptionalString(newDealership?.zip);
    if (street) requestedNewDealershipAddress.street = street;
    if (city) requestedNewDealershipAddress.city = city;
    if (state) requestedNewDealershipAddress.state = state;
    if (zip) requestedNewDealershipAddress.zip = zip;

    // Validate required fields
    if (!name || !normalizedEmail || !requestedRole) {
      return NextResponse.json(
        {
          message: 'Bad Request: name, email, and role are required.',
          code: 'MISSING_FIELDS',
        },
        { status: 400 }
      );
    }

    if (requestedDealershipId && requestedNewDealershipName) {
      return NextResponse.json(
        {
          message: 'Bad Request: Choose an existing dealership or create a new one, not both.',
          code: 'INVALID_DEALERSHIP_INPUT',
        },
        { status: 400 }
      );
    }

    if (requestedNewDealershipName && !isPrivilegedCreator) {
      return NextResponse.json(
        {
          message: 'Forbidden: Only Admin or Developer can create a dealership from this flow.',
          code: 'FORBIDDEN_NEW_DEALERSHIP',
        },
        { status: 403 }
      );
    }

    if (requestedDealershipId) {
      const dealershipSnap = await adminDb.collection('dealerships').doc(requestedDealershipId).get();
      if (!dealershipSnap.exists) {
        return NextResponse.json(
          {
            message: 'Bad Request: Selected dealership does not exist.',
            code: 'INVALID_DEALERSHIP_ID',
          },
          { status: 400 }
        );
      }
    }

    // Role rules:
    // - Privileged Admin/Developer creators can provision any supported app role.
    // - Bootstrap mode allows only initial managerial roles.
    const allowedBootstrapRoles = ['Owner', 'General Manager', 'manager'];
    const allowedPrivilegedRoles = [
      'Sales Consultant',
      'Service Writer',
      'manager',
      'Service Manager',
      'Finance Manager',
      'Parts Consultant',
      'Parts Manager',
      'General Manager',
      'Owner',
      'Trainer',
      'Admin',
      'Developer',
    ];

    let finalRole = requestedRole;

    if (isPrivilegedCreator) {
      if (!allowedPrivilegedRoles.includes(finalRole)) {
        return NextResponse.json(
          {
            message: `Bad Request: Unsupported role "${finalRole}".`,
            code: 'INVALID_ROLE',
          },
          { status: 400 }
        );
      }
    } else {
      // Bootstrap path (system has no users yet)
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

    // Check if a Firestore profile already exists for this email.
    const existingUserQuery = await adminDb
      .collection('users')
      .where('email', '==', normalizedEmail)
      .limit(1)
      .get();
    const existingFirestoreProfile = existingUserQuery.empty ? null : existingUserQuery.docs[0];

    // Ensure a Firebase Auth account exists for the email so the user can actually sign in.
    let authUser: { uid: string } | null = null;
    let authExisted = false;
    try {
      const existingAuthUser = await adminAuth.getUserByEmail(normalizedEmail);
      authUser = { uid: existingAuthUser.uid };
      authExisted = true;
    } catch (authLookupError: any) {
      if (authLookupError?.code !== 'auth/user-not-found') {
        throw authLookupError;
      }
    }

    if (!authUser) {
      const createPayload: Record<string, string> = {
        email: normalizedEmail,
        displayName: String(name || '').trim(),
      };

      // If a legacy Firestore profile already exists, bind Auth UID to that doc ID.
      if (existingFirestoreProfile?.id) {
        createPayload.uid = existingFirestoreProfile.id;
      }

      const createdAuthUser = await adminAuth.createUser(createPayload as any);
      authUser = { uid: createdAuthUser.uid };
      authExisted = false;
    }

    const newUserId = authUser.uid;
    const newUserRef = adminDb.collection('users').doc(newUserId);
    const existingUidProfileSnap = await newUserRef.get();

    const now = new Date();
    const trialWindow = buildTrialWindow(now);
    const isPrivilegedRole = ['Admin', 'Developer'].includes(finalRole);

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
      memberSince: now.toISOString(),
      ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      subscriptionStatus: isPrivilegedRole ? 'active' : 'trialing',
      trialStartedAt: isPrivilegedRole ? null : trialWindow.trialStartedAt,
      trialEndsAt: isPrivilegedRole ? null : trialWindow.trialEndsAt,
      stats: buildDefaultStats(now),
      ...buildDefaultPppState(false),
      ...buildDefaultSaasPppState(false),
    };

    if (!existingUidProfileSnap.exists) {
      await newUserRef.set(newUserData, { merge: true });
    } else {
      // Keep historical data, but align primary profile identity fields.
      await newUserRef.set(
        {
          userId: newUserId,
          name,
          email: normalizedEmail,
          role: finalRole,
          ...(normalizedPhone ? { phone: normalizedPhone } : {}),
        },
        { merge: true }
      );
    }

    // Legacy recovery: if there is an old Firestore profile on a different doc ID with same email,
    // carry over key fields and mark it as migrated so admins can audit duplicates.
    if (existingFirestoreProfile && existingFirestoreProfile.id !== newUserId) {
      const legacyData = existingFirestoreProfile.data() as Record<string, any>;
      const legacyPatch: Record<string, unknown> = {};

      if (Array.isArray(legacyData.dealershipIds) && legacyData.dealershipIds.length > 0) {
        legacyPatch.dealershipIds = legacyData.dealershipIds;
      }
      if (legacyData.stats && typeof legacyData.stats === 'object') {
        legacyPatch.stats = legacyData.stats;
      }
      if (typeof legacyData.subscriptionStatus === 'string') {
        legacyPatch.subscriptionStatus = legacyData.subscriptionStatus;
      }
      if (typeof legacyData.trialStartedAt === 'string' || legacyData.trialStartedAt === null) {
        legacyPatch.trialStartedAt = legacyData.trialStartedAt;
      }
      if (typeof legacyData.trialEndsAt === 'string' || legacyData.trialEndsAt === null) {
        legacyPatch.trialEndsAt = legacyData.trialEndsAt;
      }

      if (Object.keys(legacyPatch).length > 0) {
        await newUserRef.set(legacyPatch, { merge: true });
      }

      const Timestamp = await getTimestamp();
      await existingFirestoreProfile.ref.set(
        {
          mergedIntoUserId: newUserId,
          mergedAt: Timestamp.now(),
        },
        { merge: true }
      );
    }

    let resolvedDealershipId: string | null = requestedDealershipId;
    let createdDealership: { id: string; name: string } | null = null;

    if (!resolvedDealershipId && requestedNewDealershipName) {
      const dealershipRef = adminDb.collection('dealerships').doc();
      const trialWindow = buildTrialWindow(new Date());
      const nextDealershipData: Record<string, unknown> = {
        id: dealershipRef.id,
        name: requestedNewDealershipName,
        status: 'active',
        enableRetakeRecommendedTesting: false,
        enableNewRecommendedTesting: false,
        enablePppProtocol: false,
        enableSaasPppTraining: false,
        billingTier: 'sales_fi',
        billingSubscriptionStatus: 'trialing',
        billingTrialStartedAt: trialWindow.trialStartedAt,
        billingTrialEndsAt: trialWindow.trialEndsAt,
        billingUserCount: 0,
        billingOwnerAccountCount: 0,
        billingStoreCount: 1,
      };

      if (Object.keys(requestedNewDealershipAddress).length > 0) {
        nextDealershipData.address = requestedNewDealershipAddress;
      }

      await dealershipRef.set(nextDealershipData);
      resolvedDealershipId = dealershipRef.id;
      createdDealership = { id: dealershipRef.id, name: requestedNewDealershipName };
    }

    if (resolvedDealershipId) {
      await newUserRef.set(
        {
          dealershipIds: [resolvedDealershipId],
        },
        { merge: true }
      );
      newUserData.dealershipIds = [resolvedDealershipId];
    }

    let setupLink: string | null = null;
    let setupLinkError: string | null = null;
    let setupLinkMode: 'redirect' | 'default' | null = null;
    const continueUrl = `${getPublicOrigin(req)}/login`;
    try {
      setupLink = await adminAuth.generatePasswordResetLink(normalizedEmail, {
        url: continueUrl,
      });
      setupLinkMode = 'redirect';
    } catch (redirectLinkError: any) {
      const redirectReason = redirectLinkError?.message || 'Unknown error while generating redirected setup link.';
      console.warn('[API CreateUser] Redirect setup link failed, retrying default mode:', {
        email: normalizedEmail,
        continueUrl,
        error: redirectReason,
      });

      try {
        // Fallback: generate default Firebase-hosted action link if redirect URL config is not ready.
        setupLink = await adminAuth.generatePasswordResetLink(normalizedEmail);
        setupLinkMode = 'default';
      } catch (fallbackLinkError: any) {
        const fallbackReason = fallbackLinkError?.message || 'Could not generate password setup link.';
        setupLinkError = `Redirect link failed (${redirectReason}). Default link failed (${fallbackReason}).`;
        console.error('[API CreateUser] Failed to generate password setup link in all modes:', {
          email: normalizedEmail,
          continueUrl,
          redirectReason,
          fallbackReason,
        });
      }
    }

    console.log(`[API CreateUser] User created successfully: ${newUserId} (${normalizedEmail}, role: ${finalRole})`);

    let setupToken: string | null = null;
    if (setupLink) {
      setupToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      const customSetupLink = toCustomPasswordSetupLinkWithToken(setupLink, req, normalizedEmail, setupToken);
      if (customSetupLink) {
        setupLink = customSetupLink;
      } else {
        setupToken = null;
        setupLink = null;
        setupLinkError = setupLinkError
          ? `${setupLinkError} Could not convert generated link to custom setup URL.`
          : 'Could not convert generated link to custom setup URL.';
      }
    }

    if (setupLink && setupToken) {
      await newUserRef.set(
        {
          passwordSetup: {
            status: 'pending',
            link: setupLink,
            setupToken,
            createdAt: new Date().toISOString(),
            usedAt: null,
            createdByUserId: decoded?.uid ?? null,
            mode: setupLinkMode,
            error: null,
          },
        },
        { merge: true }
      );
    } else {
      await newUserRef.set(
        {
          passwordSetup: {
            status: 'failed',
            link: null,
            setupToken: null,
            createdAt: new Date().toISOString(),
            usedAt: null,
            createdByUserId: decoded?.uid ?? null,
            mode: setupLinkMode,
            error: setupLinkError ?? 'Password setup link generation failed.',
          },
        },
        { merge: true }
      );
    }

    return NextResponse.json(
      {
        ...newUserData,
        setupLink,
        setupLinkError,
        setupLinkMode,
        setupToken,
        createdDealership,
        authExisted,
        message: setupLink
          ? 'User created successfully. Share the setup link so they can create their password.'
          : 'User created successfully, but setup link generation failed. Check server config and try again.',
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

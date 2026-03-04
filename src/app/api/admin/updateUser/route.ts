import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/firebase/admin';
import { allRoles, type User, type UserRole } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELF_EDITABLE_FIELDS = new Set([
  'name',
  'phone',
  'avatarUrl',
  'brand',
  'address',
  'isPrivate',
  'isPrivateFromOwner',
  'showDealerCriticalOnly',
  'selfDeclaredDealershipId',
]);

const MANAGER_EDITABLE_FIELDS = new Set([
  ...Array.from(SELF_EDITABLE_FIELDS),
  'role',
]);

const ADMIN_EDITABLE_FIELDS = new Set([
  ...Array.from(MANAGER_EDITABLE_FIELDS),
  'email',
  'memberSince',
  'subscriptionStatus',
]);

const MANAGER_ROLES = new Set<UserRole>([
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

const GLOBAL_MANAGER_ROLES = new Set<UserRole>(['Admin', 'Developer']);

function getManageableRoles(managerRole: UserRole): UserRole[] {
  switch (managerRole) {
    case 'manager':
      return ['Sales Consultant', 'BDC'];
    case 'Service Manager':
      return ['Service Writer'];
    case 'Parts Manager':
      return ['Parts Consultant'];
    case 'General Manager':
      return ['Sales Consultant', 'BDC', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager'];
    case 'Owner':
      return ['Sales Consultant', 'BDC', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'General Manager'];
    case 'Trainer':
      return ['Sales Consultant', 'BDC', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'General Manager', 'Owner', 'Developer'];
    case 'Admin':
      return ['Sales Consultant', 'BDC', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'General Manager', 'Owner', 'Trainer', 'Developer', 'Admin'];
    case 'Developer':
      return ['Sales Consultant', 'BDC', 'manager', 'Service Writer', 'Service Manager', 'Finance Manager', 'Parts Consultant', 'Parts Manager', 'General Manager', 'Owner', 'Trainer', 'Admin'];
    default:
      return [];
  }
}

function sharesDealership(actor: User, target: User): boolean {
  const actorDealershipIds = actor.dealershipIds || [];
  const targetDealershipIds = target.dealershipIds || [];
  return targetDealershipIds.some((id) => actorDealershipIds.includes(id));
}

function canManageTarget(actor: User, target: User): boolean {
  if (GLOBAL_MANAGER_ROLES.has(actor.role)) return true;

  const manageableRoles = getManageableRoles(actor.role);
  if (!manageableRoles.includes(target.role)) return false;

  const targetDealershipIds = target.dealershipIds || [];
  if (targetDealershipIds.length === 0) return true;

  return sharesDealership(actor, target);
}

function sanitizeAddress(value: any) {
  if (!value || typeof value !== 'object') return undefined;
  const street = typeof value.street === 'string' ? value.street : '';
  const city = typeof value.city === 'string' ? value.city : '';
  const state = typeof value.state === 'string' ? value.state : '';
  const zip = typeof value.zip === 'string' ? value.zip : '';
  if (!street && !city && !state && !zip) return undefined;
  return { street, city, state, zip };
}

export async function POST(req: Request) {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
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

    const currentUserDoc = await adminDb.collection('users').doc(currentUserId).get();
    if (!currentUserDoc.exists) {
      return NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 });
    }
    const currentUser = currentUserDoc.data() as User;

    const body = await req.json().catch(() => null);
    const targetUserId = body?.targetUserId;
    const rawData = body?.data;

    if (!targetUserId || typeof targetUserId !== 'string' || !rawData || typeof rawData !== 'object') {
      return NextResponse.json({ message: 'Bad Request: Missing or invalid parameters.' }, { status: 400 });
    }

    const targetUserDoc = await adminDb.collection('users').doc(targetUserId).get();
    if (!targetUserDoc.exists) {
      return NextResponse.json({ message: 'Not Found: Target user profile not found.' }, { status: 404 });
    }
    const targetUser = targetUserDoc.data() as User;

    const isSelfUpdate = targetUserId === currentUserId;
    const isAdminActor = GLOBAL_MANAGER_ROLES.has(currentUser.role);

    if (!isSelfUpdate && !MANAGER_ROLES.has(currentUser.role)) {
      return NextResponse.json({ message: 'Forbidden: Insufficient permissions.' }, { status: 403 });
    }

    if (!isSelfUpdate && !canManageTarget(currentUser, targetUser)) {
      return NextResponse.json({ message: 'Forbidden: You cannot edit this user.' }, { status: 403 });
    }

    const allowedFields = isSelfUpdate
      ? SELF_EDITABLE_FIELDS
      : (isAdminActor ? ADMIN_EDITABLE_FIELDS : MANAGER_EDITABLE_FIELDS);

    const sanitizedData: Record<string, any> = {};
    for (const [key, value] of Object.entries(rawData)) {
      if (!allowedFields.has(key)) continue;
      if (value === undefined) continue;
      sanitizedData[key] = value;
    }

    if (isSelfUpdate || !isAdminActor) {
      delete sanitizedData.role;
      delete sanitizedData.subscriptionStatus;
      delete sanitizedData.email;
      delete sanitizedData.memberSince;
    }

    if ('role' in sanitizedData && !allRoles.includes(sanitizedData.role as UserRole)) {
      return NextResponse.json({ message: 'Bad Request: Invalid role.' }, { status: 400 });
    }

    if ('role' in sanitizedData && !isAdminActor && !isSelfUpdate) {
      const manageableRoles = getManageableRoles(currentUser.role);
      if (!manageableRoles.includes(sanitizedData.role as UserRole)) {
        return NextResponse.json({ message: 'Forbidden: You cannot assign that role.' }, { status: 403 });
      }
    }

    if ('address' in sanitizedData) {
      sanitizedData.address = sanitizeAddress(sanitizedData.address);
      if (!sanitizedData.address) {
        delete sanitizedData.address;
      }
    }

    if (Object.keys(sanitizedData).length === 0) {
      return NextResponse.json({ ok: true, updated: false }, { status: 200 });
    }

    const targetUserRef = adminDb.collection('users').doc(targetUserId);
    await targetUserRef.update(sanitizedData);

    return NextResponse.json({ ok: true, updated: true }, { status: 200 });
  } catch (e: any) {
    console.error('[API UpdateUser] Error:', { message: e?.message, code: e?.code, stack: e?.stack });

    if (e && e.code === 'admin/not-initialized') {
      return NextResponse.json({ message: e.message }, { status: 503 });
    }

    return NextResponse.json({ message: e?.message || 'Failed to update user' }, { status: 500 });
  }
}

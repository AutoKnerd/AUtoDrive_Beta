import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/firebase/admin';
import { UserRole, Dealership, User } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getPublicOrigin(req: Request) {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (host) return `${proto}://${host}`;

  return 'http://localhost:3000';
}

function isEmailSendingEnabled() {
  if (process.env.DISABLE_INVITE_EMAILS === 'true') return false;
  return !!process.env.RESEND_API_KEY;
}

export async function POST(req: Request, { params }: { params: Promise<{}> }) {
  await params; // Per Next.js 15
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  
  if (!authorization) {
    return NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 });
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match || !match[1]) {
      return NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 });
  }
  const token = match[1].trim();

  try {
    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const userDoc = await adminDb.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 });
    }
    
    const user = userDoc.data() as User;
    const userRole = user?.role;

    const allowedRoles = ['Admin', 'Developer', 'Owner', 'Trainer', 'General Manager', 'manager', 'Service Manager', 'Parts Manager', 'Finance Manager'];
    if (!allowedRoles.includes(userRole)) {
        return NextResponse.json({ message: 'Forbidden: Insufficient permissions to send invitations.' }, { status: 403 });
    }

    const { dealershipId, email, role } = await req.json();

    if (!dealershipId || !email || !role) {
        return NextResponse.json({ message: 'Bad Request: Missing required invitation details.' }, { status: 400 });
    }

    if (userRole === 'Owner' && !user.dealershipIds?.includes(dealershipId)) {
        return NextResponse.json({ message: 'Forbidden: You can only manage invitations for your assigned dealerships.' }, { status: 403 });
    }

    const dealershipDoc = await adminDb.collection('dealerships').doc(dealershipId).get();
    if (!dealershipDoc.exists) {
        return NextResponse.json({ message: 'Bad Request: Dealership not found.' }, { status: 400 });
    }
    const dealership = dealershipDoc.data() as Dealership;

    const invitationRef = adminDb.collection('emailInvitations').doc();
    const invitationToken = invitationRef.id;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const { Timestamp } = await import('firebase-admin/firestore');
    
    const newInvitationData = {
        token: invitationToken,
        dealershipId: dealershipId,
        dealershipName: dealership.name,
        role: role as UserRole,
        email: email.toLowerCase(),
        claimed: false,
        inviterId: userId,
        createdAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(expiresAt),
    };

    await invitationRef.set(newInvitationData);
    
    const origin = getPublicOrigin(req);
    const inviteUrl = `${origin}/register?token=${invitationToken}`;

    let emailSent = false;
    let emailError: string | undefined;

    if (isEmailSendingEnabled()) {
      try {
        const { sendInvitationEmail } = await import('@/lib/email');
        const emailResult = await sendInvitationEmail({
          toEmail: email,
          inviteUrl,
          inviter: user,
          dealership: dealership,
        });

        emailSent = !!emailResult?.success;
        if (!emailSent) {
          emailError = emailResult?.error || 'Unknown email provider error';
        }
      } catch (e: any) {
        emailSent = false;
        emailError = e?.message || String(e);
      }
    }

    return NextResponse.json(
      {
        token: invitationToken,
        inviteUrl,
        inviteText: `Join ${dealership.name} on AutoDrive: ${inviteUrl}`,
        emailSent,
        ...(emailError ? { emailError } : {}),
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('[API CreateEmailInvitation] Error:', error);

    if (error && error.code === 'admin/not-initialized') {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (error.code && error.code.startsWith('auth/')) {
      return NextResponse.json({
        code: error.code,
        message: `Unauthorized: ${error.message}`
      }, { status: 401 });
    }

    const errorResponse: { message: string, code?: string, stack?: string } = {
      message: error.message || 'Internal Server Error',
      code: error.code || 'INTERNAL_SERVER_ERROR',
    };

    if (process.env.NODE_ENV === 'development') {
      errorResponse.stack = error.stack;
    }

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

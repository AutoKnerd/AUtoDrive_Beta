import { NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/firebase/admin';
import { Address } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ [key: string]: string }> }
) {
  const authorization =
    req.headers.get('authorization') ?? req.headers.get('Authorization');

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
    const userId = decodedToken.uid;

    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 });
    }

    const userRole = userDoc.data()?.role;
    if (!['Admin', 'Developer'].includes(userRole)) {
      return NextResponse.json({ message: 'Forbidden: Insufficient permissions.' }, { status: 403 });
    }

    const { dealershipName, address, trainerId } = await req.json();

    if (!dealershipName) {
      return NextResponse.json({ message: 'Bad Request: Dealership name is required.' }, { status: 400 });
    }

    const dealershipRef = adminDb.collection('dealerships').doc();

    const newDealershipData: any = {
      id: dealershipRef.id,
      name: dealershipName,
      status: 'active',
    };

    if (trainerId) newDealershipData.trainerId = trainerId;

    if (address && Object.values(address).some(val => !!val)) {
      newDealershipData.address = address as Address;
    }

    await dealershipRef.set(newDealershipData);

    return NextResponse.json(newDealershipData, { status: 201 });
  } catch (error: any) {
    console.error('[API CreateDealership] Error:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
    });

    // If Admin SDK is not initialized, return 503 so callers can retry later
    if (error && error.code === 'admin/not-initialized') {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    // Create a structured JSON error response
    const errorResponse: { message: string, code?: string } = {
        message: error.message || 'Internal Server Error',
        code: error.code || 'INTERNAL_SERVER_ERROR',
    };

    if (error.code && error.code.startsWith('auth/')) {
        errorResponse.message = `Unauthorized: ${error.message}`;
        return NextResponse.json(errorResponse, { status: 401 });
    }

    return NextResponse.json(
      errorResponse,
      { status: 500 }
    );
  }
}

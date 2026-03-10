import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/firebase/admin';
import { getConsultantByFirebaseUid } from '@/lib/consultants-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || null;
}

export async function GET(request: NextRequest) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json({ error: 'Missing Authorization header.' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    const consultant = await getConsultantByFirebaseUid(decodedToken.uid);

    if (!consultant) {
      return NextResponse.json({ error: 'Consultant profile not found for this user.' }, { status: 404 });
    }

    return NextResponse.json({ consultant });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to resolve consultant identity.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createConsultant, listConsultants } from '@/lib/consultants-store';
import { getAdminDb } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const adminDb = getAdminDb();
    const consultants = await listConsultants();
    const usersSnapshot = await adminDb.collection('users').limit(500).get();
    const users = usersSnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        userId: doc.id,
        name: String(data.name || ''),
        email: String(data.email || ''),
        role: String(data.role || ''),
      };
    });
    return NextResponse.json({ consultants, users });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load consultants.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const consultant = await createConsultant({
      name: body?.name ?? '',
      email: body?.email ?? '',
      referralCode: body?.referralCode ?? '',
      firebaseUid: body?.firebaseUid ?? '',
    });

    return NextResponse.json({ consultant }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create consultant.';
    const status = message === 'Referral code already exists.' || message === 'Name, email, and referral code are required.'
      ? 400
      : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

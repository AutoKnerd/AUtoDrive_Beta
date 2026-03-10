import { NextRequest, NextResponse } from 'next/server';
import { createConsultant, listConsultants } from '@/lib/consultants-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const consultants = await listConsultants();
    return NextResponse.json({ consultants });
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

import { NextRequest, NextResponse } from 'next/server';
import { deleteConsultant, updateConsultant } from '@/lib/consultants-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const consultant = await updateConsultant(id, {
      name: body?.name ?? '',
      email: body?.email ?? '',
      referralCode: body?.referralCode ?? '',
      firebaseUid: body?.firebaseUid ?? '',
    });

    return NextResponse.json({ consultant });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update consultant.';
    const status =
      message === 'Consultant not found.' ||
      message === 'Referral code already exists.' ||
      message === 'Name, email, and referral code are required.'
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    await deleteConsultant(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete consultant.';
    const status = message === 'Consultant not found.' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { updateDealerRegistration } from '@/lib/dealer-registrations-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const registration = await updateDealerRegistration({
      id,
      consultant: body?.consultant ?? '',
      contact_name: body?.contact_name ?? '',
      contact_email: body?.contact_email ?? '',
      contact_phone: body?.contact_phone ?? '',
      status: body?.status ?? '',
      notes: body?.notes ?? '',
    });

    return NextResponse.json({ registration });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update dealer registration.';
    const badRequestMessages = new Set([
      'Registration id, consultant, contact name, contact email, and status are required.',
      'Invalid status value.',
      'Dealer registration not found.',
      'Forbidden: consultant mismatch.',
    ]);

    return NextResponse.json({ error: message }, { status: badRequestMessages.has(message) ? 400 : 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createDealerRegistration, listDealerRegistrationsByConsultant } from '@/lib/dealer-registrations-store';
import { createDealerPipelineLead } from '@/lib/dealer-pipeline-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const consultant = request.nextUrl.searchParams.get('consultant') ?? '';

  if (!consultant.trim()) {
    return NextResponse.json({ error: 'Missing required query param: consultant' }, { status: 400 });
  }

  try {
    const rows = await listDealerRegistrationsByConsultant(consultant);
    return NextResponse.json({ registrations: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load dealer registrations.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const registration = await createDealerRegistration({
      dealer_name: body?.dealer_name ?? '',
      contact_name: body?.contact_name ?? '',
      contact_email: body?.contact_email ?? '',
      contact_phone: body?.contact_phone ?? '',
      city: body?.city ?? '',
      state: body?.state ?? '',
      consultant: body?.consultant ?? '',
      notes: body?.notes ?? '',
    });

    await createDealerPipelineLead({
      dealer_name: body?.dealer_name ?? '',
      contact_name: body?.contact_name ?? '',
      contact_email: body?.contact_email ?? '',
      contact_phone: body?.contact_phone ?? '',
      city: body?.city ?? '',
      state: body?.state ?? '',
      consultant_id: body?.consultant ?? '',
      notes: body?.notes ?? '',
    });

    return NextResponse.json({ registration }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create dealer registration.';
    const badRequestMessages = new Set([
      'Dealer name, contact name, contact email, and consultant are required.',
      'Dealer name, contact name, contact email, and consultant id are required.',
    ]);
    const status = badRequestMessages.has(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

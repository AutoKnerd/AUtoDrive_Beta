import { NextRequest, NextResponse } from 'next/server';
import { getConsultantCustomers } from '@/lib/consultant-sales';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const consultantId = request.nextUrl.searchParams.get('id') ?? '';

  if (!consultantId.trim()) {
    return NextResponse.json({ error: 'Missing required query param: id' }, { status: 400 });
  }

  try {
    const customers = await getConsultantCustomers(consultantId);
    return NextResponse.json({ consultant: consultantId.trim().toLowerCase(), customers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load consultant customers.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

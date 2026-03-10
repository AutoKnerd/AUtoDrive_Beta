import { NextRequest, NextResponse } from 'next/server';
import { getConsultantSales } from '@/lib/consultant-sales';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const consultantId = request.nextUrl.searchParams.get('id') ?? '';

  if (!consultantId.trim()) {
    return NextResponse.json({ error: 'Missing required query param: id' }, { status: 400 });
  }

  try {
    const sales = await getConsultantSales(consultantId);
    return NextResponse.json(sales);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load consultant sales.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getConsultantMarketingMetrics } from '@/lib/consultant-marketing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const consultantId = request.nextUrl.searchParams.get('id') || '';
    if (!consultantId.trim()) {
      return NextResponse.json({ error: 'Consultant ID is required.' }, { status: 400 });
    }

    const metrics = await getConsultantMarketingMetrics(consultantId);
    return NextResponse.json(metrics, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load marketing metrics.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

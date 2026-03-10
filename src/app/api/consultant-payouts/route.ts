import { NextResponse } from 'next/server';
import { getConsultantPayoutSummary } from '@/lib/consultant-commissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const consultantId = (url.searchParams.get('id') || '').trim();

    if (!consultantId) {
      return NextResponse.json({ error: 'Consultant ID is required.' }, { status: 400 });
    }

    const summary = await getConsultantPayoutSummary(consultantId);
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load consultant payouts.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

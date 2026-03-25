import { NextRequest, NextResponse } from 'next/server';
import { recordConsultantMarketingEvent } from '@/lib/consultant-marketing';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await recordConsultantMarketingEvent({
      consultant_id: body?.consultant_id ?? '',
      event_type: body?.event_type ?? '',
      source: body?.source ?? '',
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to record marketing event.';
    const status = message === 'Consultant id and valid event type are required.' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

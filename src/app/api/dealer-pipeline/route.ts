import { NextRequest, NextResponse } from 'next/server';
import { listDealerPipelineByConsultant } from '@/lib/dealer-pipeline-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const consultant = request.nextUrl.searchParams.get('consultant') ?? '';

  if (!consultant.trim()) {
    return NextResponse.json({ error: 'Missing required query param: consultant' }, { status: 400 });
  }

  try {
    const rows = await listDealerPipelineByConsultant(consultant);
    return NextResponse.json({ pipeline: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load dealer pipeline.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

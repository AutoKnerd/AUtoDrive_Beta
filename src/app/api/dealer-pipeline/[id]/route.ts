import { NextRequest, NextResponse } from 'next/server';
import { updateDealerPipelineByConsultant } from '@/lib/dealer-pipeline-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const record = await updateDealerPipelineByConsultant({
      id,
      consultant_id: body?.consultant_id ?? '',
      stage: body?.stage ?? '',
    });

    return NextResponse.json({ record }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update dealer pipeline.';
    const badRequestMessages = new Set([
      'Pipeline id, consultant id, and valid stage are required.',
      'Invalid stage value.',
      'Dealer pipeline record not found.',
      'Forbidden: consultant mismatch.',
    ]);

    return NextResponse.json({ error: message }, { status: badRequestMessages.has(message) ? 400 : 500 });
  }
}

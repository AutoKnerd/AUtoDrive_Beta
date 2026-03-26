import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enhanceSprocketInsightAi } from '@/ai/flows/sprocket-insight-ai-flow';

const BodySchema = z.object({
  toolId: z.string().min(1),
  userRole: z.string().optional(),
  cxSummary: z.string().optional(),
  output: z.record(z.string(), z.string()),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: 'Invalid payload.' },
        { status: 400 }
      );
    }

    const result = await enhanceSprocketInsightAi(parsed.data);
    return NextResponse.json({ ok: true, output: result.output });
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Unable to enhance Sprocket insight.' },
      { status: 500 }
    );
  }
}

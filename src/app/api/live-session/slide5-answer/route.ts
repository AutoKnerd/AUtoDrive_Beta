import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateLiveSessionSlide5Answer } from '@/ai/flows/live-session-slide5-answer-flow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BodySchema = z.object({
  participantName: z.string().min(1),
  question: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: 'Invalid payload.' },
        { status: 400 },
      );
    }

    const output = await generateLiveSessionSlide5Answer({
      participantName: parsed.data.participantName,
      question: parsed.data.question,
    });

    return NextResponse.json({
      ok: true,
      output,
    });
  } catch (error) {
    console.error('Unable to generate slide 5 answer.', error);
    return NextResponse.json(
      { ok: false, message: 'Unable to generate slide 5 answer.' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BodySchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().optional(),
  deckId: z.string().min(1).default('audienceos'),
  slideStep: z.string().min(1).default('slide5'),
  currentSlide: z.string().optional(),
  responseKey: z.string().min(1).default('audienceos-slide5'),
  sessionToken: z.string().min(1),
  questionId: z.string().min(1),
  audienceStep: z.number().int().positive(),
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

    const input = parsed.data;

    let persisted = false;

    try {
      const responseRouteUrl = new URL('/api/live-session/responses', request.url);
      const persistResponse = await fetch(responseRouteUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: input.userId,
          sessionId: input.sessionId || input.userId,
          slideId: 'slide_05',
          slideNumber: 5,
          audienceStep: input.audienceStep,
          answer: input.question,
          answerLabel: input.question,
          selectedValue: {
            questionId: input.questionId,
            name: input.participantName,
            question: input.question,
          },
          deckId: input.deckId,
          slideStep: input.slideStep,
          currentSlide: input.currentSlide || '05-presentation-slide-05-built-for-live-facilitation.html',
          responseKey: input.responseKey,
          sessionToken: input.sessionToken,
          timestamp: new Date().toISOString(),
        }),
      });

      persisted = persistResponse.ok;
    } catch (error) {
      console.error('Unable to persist slide 5 question.', error);
    }

    return NextResponse.json({
      ok: true,
      persisted,
      questionId: input.questionId,
    });
  } catch (error) {
    console.error('Unable to store slide 5 question.', error);
    return NextResponse.json(
      { ok: false, message: 'Unable to store slide 5 question.' },
      { status: 500 },
    );
  }
}

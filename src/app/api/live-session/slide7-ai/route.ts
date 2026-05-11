import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateLiveSessionSlide7Ai } from '@/ai/flows/live-session-slide7-ai-flow';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const BodySchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().optional(),
  deckId: z.string().min(1).default('audienceos'),
  slideStep: z.string().min(1).default('slide7'),
  currentSlide: z.string().optional(),
  responseKey: z.string().min(1).default('audienceos-slide7'),
  sessionToken: z.string().min(1),
  scenarioId: z.string().min(1),
  scenarioTitle: z.string().min(1),
  detail: z.string().optional(),
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
    const output = await generateLiveSessionSlide7Ai({
      scenarioId: input.scenarioId,
      scenarioTitle: input.scenarioTitle,
      detail: input.detail,
    });

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
          slideId: 'slide_07',
          slideNumber: 7,
          answer: output.trainerResponse,
          answerLabel: input.scenarioTitle,
          selectedValue: {
            scenarioId: input.scenarioId,
            scenarioTitle: output.scenarioTitle,
            detail: typeof input.detail === 'string' ? input.detail.trim() : '',
            trainerResponse: output.trainerResponse,
            coachingNote: output.coachingNote,
          },
          deckId: input.deckId,
          slideStep: input.slideStep,
          currentSlide: input.currentSlide || '07-slide-07-ai-support-layer.html',
          responseKey: input.responseKey,
          sessionToken: input.sessionToken,
          timestamp: new Date().toISOString(),
        }),
      });

      persisted = persistResponse.ok;
    } catch (error) {
      console.error('Unable to persist slide 7 AI response.', error);
    }

    return NextResponse.json({
      ok: true,
      persisted,
      output,
    });
  } catch (error) {
    console.error('Unable to generate slide 7 AI response.', error);
    return NextResponse.json(
      { ok: false, message: 'Unable to generate slide 7 AI response.' },
      { status: 500 },
    );
  }
}

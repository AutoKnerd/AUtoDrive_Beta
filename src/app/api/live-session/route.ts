import { NextResponse } from 'next/server';
import { getAdminDb } from '@/firebase/admin';
import {
  LIVE_SESSION_DEFAULT_STATE,
  LIVE_SESSION_ID,
  normalizeLiveSessionState,
  type LiveSessionPayload,
  type LiveSessionState,
} from '@/lib/live-session';
import { getAudienceContentForDeck, readPresentationDeckManifest } from '@/lib/presentation-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const COLLECTION_NAME = 'presentation_live_sessions';

function inferStepFromSlide(currentSlide: string) {
  const match = currentSlide.match(/^(\d+)/);
  const number = match ? Number.parseInt(match[1], 10) : 1;
  return `slide${number}`;
}

async function buildPayload(input: Partial<LiveSessionState>): Promise<LiveSessionPayload> {
  const state = normalizeLiveSessionState(input);
  const manifest = await readPresentationDeckManifest(state.deckId);

  if (!manifest) {
    return {
      state,
      deckTitle: state.deckId,
      audienceEnabled: true,
      qrOverlayEnabled: true,
      content: {
        eyebrow: 'Live Session',
        title: state.currentStep,
        body: 'Audience sync is active.',
      },
    };
  }

  return {
    state,
    deckTitle: manifest.title,
    audienceEnabled: manifest.audience?.enabled !== false,
    qrOverlayEnabled: manifest.audience?.qrOverlayEnabled !== false,
    content: getAudienceContentForDeck(manifest, state.currentStep),
  };
}

export async function GET() {
  try {
    const snapshot = await getAdminDb().collection(COLLECTION_NAME).doc(LIVE_SESSION_ID).get();
    if (!snapshot.exists) {
      return NextResponse.json(await buildPayload(LIVE_SESSION_DEFAULT_STATE), {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      });
    }

    const data = snapshot.data() as Partial<LiveSessionState> | undefined;
    return NextResponse.json(await buildPayload(data ?? LIVE_SESSION_DEFAULT_STATE), {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error) {
    console.error('Unable to read live session state.', error);
    return NextResponse.json(
      { error: 'Unable to read live session state.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LiveSessionState> & { currentStep?: string; currentSlide?: string; deckId?: string };
    const deckId = typeof body.deckId === 'string' && body.deckId.trim().length > 0
      ? body.deckId.trim()
      : LIVE_SESSION_DEFAULT_STATE.deckId;
    const currentSlide = typeof body.currentSlide === 'string' && body.currentSlide.trim().length > 0
      ? body.currentSlide.trim()
      : LIVE_SESSION_DEFAULT_STATE.currentSlide;

    const inferredStep = typeof body.currentStep === 'string' && body.currentStep.trim().length > 0
      ? body.currentStep
      : inferStepFromSlide(currentSlide);

    const nextState: LiveSessionState = {
      deckId,
      currentStep: inferredStep,
      currentSlide,
      updatedAt: new Date().toISOString(),
    };

    await getAdminDb()
      .collection(COLLECTION_NAME)
      .doc(LIVE_SESSION_ID)
      .set(nextState, { merge: true });

    return NextResponse.json(await buildPayload(nextState));
  } catch (error) {
    console.error('Unable to update live session state.', error);
    return NextResponse.json(
      { error: 'Unable to update live session state.' },
      { status: 500 },
    );
  }
}

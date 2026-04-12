import { NextResponse } from 'next/server';
import { getAdminDb } from '@/firebase/admin';
import {
  DECK_FILE_TO_STEP,
  isLiveSessionStepId,
  LIVE_SESSION_DEFAULT_STATE,
  LIVE_SESSION_ID,
  type LiveSessionState,
} from '@/lib/live-session';

export const runtime = 'nodejs';

const COLLECTION_NAME = 'presentation_live_sessions';

function buildState(input: Partial<LiveSessionState>): LiveSessionState {
  return {
    currentStep: input.currentStep ?? LIVE_SESSION_DEFAULT_STATE.currentStep,
    currentSlide: input.currentSlide ?? LIVE_SESSION_DEFAULT_STATE.currentSlide,
    updatedAt: input.updatedAt ?? LIVE_SESSION_DEFAULT_STATE.updatedAt,
  };
}

export async function GET() {
  try {
    const snapshot = await getAdminDb().collection(COLLECTION_NAME).doc(LIVE_SESSION_ID).get();
    if (!snapshot.exists) {
      return NextResponse.json(buildState(LIVE_SESSION_DEFAULT_STATE));
    }

    const data = snapshot.data() as Partial<LiveSessionState> | undefined;
    return NextResponse.json(buildState(data ?? LIVE_SESSION_DEFAULT_STATE));
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
    const body = (await request.json()) as Partial<LiveSessionState> & { currentStep?: string; currentSlide?: string };
    const currentSlide = typeof body.currentSlide === 'string' && body.currentSlide.trim().length > 0
      ? body.currentSlide.trim()
      : LIVE_SESSION_DEFAULT_STATE.currentSlide;

    const inferredStep = typeof body.currentStep === 'string' && isLiveSessionStepId(body.currentStep)
      ? body.currentStep
      : DECK_FILE_TO_STEP[currentSlide] ?? LIVE_SESSION_DEFAULT_STATE.currentStep;

    const nextState: LiveSessionState = {
      currentStep: inferredStep,
      currentSlide,
      updatedAt: new Date().toISOString(),
    };

    await getAdminDb()
      .collection(COLLECTION_NAME)
      .doc(LIVE_SESSION_ID)
      .set(nextState, { merge: true });

    return NextResponse.json(nextState);
  } catch (error) {
    console.error('Unable to update live session state.', error);
    return NextResponse.json(
      { error: 'Unable to update live session state.' },
      { status: 500 },
    );
  }
}

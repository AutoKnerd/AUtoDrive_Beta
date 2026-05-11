import { getAdminDb } from '@/firebase/admin';
import { LiveSessionClient } from '@/app/live-session/live-session-client';
import {
  LIVE_SESSION_DEFAULT_STATE,
  LIVE_SESSION_ID,
  normalizeLiveSessionState,
  type LiveSessionPayload,
  type LiveSessionState,
} from '@/lib/live-session';
import { getAudienceContentForDeck, readPresentationDeckManifest, resolveCompanionEntryForStep } from '@/lib/presentation-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const COLLECTION_NAME = 'presentation_live_sessions';

async function readInitialPayload(): Promise<LiveSessionPayload> {
  try {
    const snapshot = await getAdminDb().collection(COLLECTION_NAME).doc(LIVE_SESSION_ID).get();
    const state = normalizeLiveSessionState(
      snapshot.exists ? (snapshot.data() as Partial<LiveSessionState>) : LIVE_SESSION_DEFAULT_STATE,
    );
    const manifest = await readPresentationDeckManifest(state.deckId);
    const companionEntry = manifest
      ? await resolveCompanionEntryForStep(state.deckId, manifest, state.currentStep)
      : null;
    const companionUrl = companionEntry
      ? `/Presentations/${encodeURIComponent(state.deckId)}/${companionEntry
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')}?audience=1&embedded=1&deckId=${encodeURIComponent(state.deckId)}&currentStep=${encodeURIComponent(state.currentStep)}&currentSlide=${encodeURIComponent(state.currentSlide)}${state.sessionToken ? `&sessionToken=${encodeURIComponent(state.sessionToken)}` : ''}`
      : undefined;

    if (!manifest) {
      return {
        state,
        deckTitle: state.deckId,
        audienceEnabled: true,
        qrOverlayEnabled: true,
        companionUrl,
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
      companionUrl,
      content: getAudienceContentForDeck(manifest, state.currentStep),
    };
  } catch (error) {
    console.error('Unable to read initial live session payload.', error);

    return {
      state: LIVE_SESSION_DEFAULT_STATE,
      deckTitle: 'AutoKnerd',
      audienceEnabled: true,
      qrOverlayEnabled: true,
      content: {
        eyebrow: 'Live Session',
        title: 'Connecting…',
        body: 'Waiting for presentation state.',
        prompt: 'Keep this page open. It updates as the presentation advances.',
      },
    };
  }
}

export default async function LiveSessionPage() {
  const initialPayload = await readInitialPayload();
  return <LiveSessionClient initialPayload={initialPayload} />;
}

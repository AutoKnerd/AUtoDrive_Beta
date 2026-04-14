import { getAdminDb } from '@/firebase/admin';
import {
  LIVE_SESSION_DEFAULT_STATE,
  LIVE_SESSION_ID,
  normalizeLiveSessionState,
  type LiveSessionPayload,
  type LiveSessionState,
} from '@/lib/live-session';
import { getAudienceContentForDeck, readPresentationDeckManifest } from '@/lib/presentation-engine';
import { PresenterNotesClient } from '@/app/live-session/notes/presenter-notes-client';

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

    if (!manifest) {
      return {
        state,
        deckTitle: 'AutoKnerd',
        audienceEnabled: true,
        qrOverlayEnabled: true,
        content: {
          eyebrow: 'Presenter Notes',
          title: 'Connecting…',
          body: 'Waiting for presentation state.',
          speakerNotes: [],
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
  } catch (error) {
    console.error('Unable to read initial presenter notes payload.', error);

    return {
      state: LIVE_SESSION_DEFAULT_STATE,
      deckTitle: 'AutoKnerd',
      audienceEnabled: true,
      qrOverlayEnabled: true,
      content: {
        eyebrow: 'Presenter Notes',
        title: 'Connecting…',
        body: 'Waiting for presentation state.',
        speakerNotes: [],
      },
    };
  }
}

export default async function PresenterNotesPage() {
  const initialPayload = await readInitialPayload();
  const manifest = await readPresentationDeckManifest(initialPayload.state.deckId);
  return <PresenterNotesClient initialPayload={initialPayload} slideFiles={manifest?.slides ?? []} />;
}

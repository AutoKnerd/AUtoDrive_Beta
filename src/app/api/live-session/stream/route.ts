import { getAdminDb } from '@/firebase/admin';
import { LIVE_SESSION_DEFAULT_STATE, LIVE_SESSION_ID, normalizeLiveSessionState, type LiveSessionPayload, type LiveSessionState } from '@/lib/live-session';
import { getAudienceContentForDeck, readPresentationDeckManifest } from '@/lib/presentation-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const COLLECTION_NAME = 'presentation_live_sessions';
const POLL_INTERVAL_MS = 1000;

function encodeEvent(data: LiveSessionPayload) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function readCurrentState(): Promise<LiveSessionPayload> {
  const snapshot = await getAdminDb().collection(COLLECTION_NAME).doc(LIVE_SESSION_ID).get();
  const state = normalizeLiveSessionState(snapshot.exists ? (snapshot.data() as Partial<LiveSessionState>) : null);
  const manifest = await readPresentationDeckManifest(state.deckId);

  return {
    state,
    deckTitle: manifest?.title ?? state.deckId,
    audienceEnabled: manifest?.audience?.enabled !== false,
    qrOverlayEnabled: manifest?.audience?.qrOverlayEnabled !== false,
    content: manifest
      ? getAudienceContentForDeck(manifest, state.currentStep)
      : {
          eyebrow: 'Live Session',
          title: state.currentStep,
          body: 'Audience sync is active.',
        },
  };
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let lastPayload = '';
      let closed = false;

      const safeClose = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      const sendState = async () => {
        try {
          const state = await readCurrentState();
          const payload = encodeEvent(state);
          if (payload === lastPayload) return;
          lastPayload = payload;
          controller.enqueue(encoder.encode(payload));
        } catch (error) {
          console.error('Unable to stream live session state.', error);
        }
      };

      await sendState();

      const heartbeatId = setInterval(() => {
        controller.enqueue(encoder.encode(': keep-alive\n\n'));
      }, 15000);

      const pollId = setInterval(() => {
        void sendState();
      }, POLL_INTERVAL_MS);

      request.signal.addEventListener('abort', () => {
        clearInterval(pollId);
        clearInterval(heartbeatId);
        safeClose();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

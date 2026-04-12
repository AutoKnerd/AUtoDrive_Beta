import { getAdminDb } from '@/firebase/admin';
import { LIVE_SESSION_DEFAULT_STATE, LIVE_SESSION_ID, type LiveSessionState } from '@/lib/live-session';

export const runtime = 'nodejs';

const COLLECTION_NAME = 'presentation_live_sessions';
const POLL_INTERVAL_MS = 1000;

function encodeEvent(data: LiveSessionState) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

function normalizeState(input?: Partial<LiveSessionState> | null): LiveSessionState {
  return {
    currentStep: input?.currentStep ?? LIVE_SESSION_DEFAULT_STATE.currentStep,
    currentSlide: input?.currentSlide ?? LIVE_SESSION_DEFAULT_STATE.currentSlide,
    updatedAt: input?.updatedAt ?? LIVE_SESSION_DEFAULT_STATE.updatedAt,
  };
}

async function readCurrentState(): Promise<LiveSessionState> {
  const snapshot = await getAdminDb().collection(COLLECTION_NAME).doc(LIVE_SESSION_ID).get();
  return normalizeState(snapshot.exists ? (snapshot.data() as Partial<LiveSessionState>) : null);
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

import os from 'node:os';
import { getAdminDb } from '@/firebase/admin';
import { LIVE_SESSION_DEFAULT_STATE, LIVE_SESSION_ID, normalizeLiveSessionState, type LiveSessionPayload, type LiveSessionState } from '@/lib/live-session';
import { getAudienceContentForDeck, readPresentationDeckManifest, resolveCompanionEntryForStep } from '@/lib/presentation-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const COLLECTION_NAME = 'presentation_live_sessions';
const POLL_INTERVAL_MS = 1000;

function normalizeConfiguredOrigin(raw?: string | null) {
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    return parsed;
  } catch {
    return null;
  }
}

function isLinkLocalHostname(hostname: string) {
  return /^169\.254\./.test(hostname);
}

function isLocalOnlyHostname(hostname: string) {
  return (
    hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '0.0.0.0'
    || hostname === '::1'
    || isLinkLocalHostname(hostname)
  );
}

function findPreferredLanHost() {
  const interfaces = os.networkInterfaces();

  const candidates = Object.values(interfaces)
    .flat()
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .filter((entry) => entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)
    .filter((address) => !isLinkLocalHostname(address));

  const ranked =
    candidates.find((address) => /^192\.168\./.test(address))
    || candidates.find((address) => /^10\./.test(address))
    || candidates.find((address) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(address))
    || candidates[0];

  return ranked || null;
}

function buildAudienceUrl(request: Request, _state: LiveSessionState, _companionEntry?: string | null) {
  const configuredOrigin =
    normalizeConfiguredOrigin(process.env.NEXT_PUBLIC_APP_URL)
    || normalizeConfiguredOrigin(process.env.APP_URL);

  if (configuredOrigin && !isLocalOnlyHostname(configuredOrigin.hostname)) {
    return new URL('/live-session?audience=1', configuredOrigin).toString();
  }

  const requestUrl = new URL(request.url);
  const audienceUrl = new URL('/live-session?audience=1', requestUrl);
  const preferredLanHost = findPreferredLanHost();

  if (preferredLanHost) {
    audienceUrl.hostname = preferredLanHost;
  }

  if (requestUrl.port === '3001' || requestUrl.port === '') {
    audienceUrl.port = '3000';
  }

  return audienceUrl.toString();
}

function buildCompanionUrl(state: LiveSessionState, companionEntry?: string | null) {
  if (typeof companionEntry !== 'string' || companionEntry.trim().length === 0) {
    return undefined;
  }

  const companionUrl = new URL(`http://placeholder/Presentations/${encodeURIComponent(state.deckId)}/${companionEntry
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`);
  companionUrl.searchParams.set('audience', '1');
  companionUrl.searchParams.set('embedded', '1');
  companionUrl.searchParams.set('deckId', state.deckId);
  companionUrl.searchParams.set('currentStep', state.currentStep);
  companionUrl.searchParams.set('currentSlide', state.currentSlide);
  if (state.sessionToken) {
    companionUrl.searchParams.set('sessionToken', state.sessionToken);
  }

  return `${companionUrl.pathname}${companionUrl.search}`;
}

function encodeEvent(data: LiveSessionPayload) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function readCurrentState(request: Request): Promise<LiveSessionPayload> {
  const snapshot = await getAdminDb().collection(COLLECTION_NAME).doc(LIVE_SESSION_ID).get();
  const state = normalizeLiveSessionState(snapshot.exists ? (snapshot.data() as Partial<LiveSessionState>) : null);
  const manifest = await readPresentationDeckManifest(state.deckId);
  const companionEntry = manifest
    ? await resolveCompanionEntryForStep(state.deckId, manifest, state.currentStep)
    : null;

  return {
    state,
    deckTitle: manifest?.title ?? state.deckId,
    audienceEnabled: manifest?.audience?.enabled !== false,
    qrOverlayEnabled: manifest?.audience?.qrOverlayEnabled !== false,
    audienceUrl: buildAudienceUrl(
      request,
      state,
      companionEntry,
    ),
    companionUrl: buildCompanionUrl(state, companionEntry),
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
          const state = await readCurrentState(request);
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

import { NextResponse } from 'next/server';
import os from 'node:os';
import { getAdminDb } from '@/firebase/admin';
import {
  LIVE_SESSION_DEFAULT_STATE,
  LIVE_SESSION_ID,
  normalizeLiveSessionState,
  type LiveSessionPayload,
  type LiveSessionState,
} from '@/lib/live-session';
import {
  getAudienceContentForDeck,
  readPresentationDeckManifest,
  resolveCompanionEntryForStep,
  type PresentationDeckManifest,
} from '@/lib/presentation-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const COLLECTION_NAME = 'presentation_live_sessions';

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

function buildBaseAudienceUrl(request: Request) {
  const configuredOrigin =
    normalizeConfiguredOrigin(process.env.NEXT_PUBLIC_APP_URL)
    || normalizeConfiguredOrigin(process.env.APP_URL);

  if (configuredOrigin && !isLocalOnlyHostname(configuredOrigin.hostname)) {
    return new URL('/live-session?audience=1', configuredOrigin);
  }

  const requestUrl = new URL(request.url);
  const audienceUrl = new URL('/live-session?audience=1', requestUrl);
  const preferredLanHost = findPreferredLanHost();

  if (preferredLanHost) {
    audienceUrl.hostname = preferredLanHost;
  }

  audienceUrl.port = requestUrl.port;

  return audienceUrl;
}

function buildAudienceUrl(
  request: Request,
  _state: LiveSessionState,
  _manifest: PresentationDeckManifest | null,
) {
  return buildBaseAudienceUrl(request).toString();
}

function buildCompanionUrl(state: LiveSessionState, companionEntry: string | null) {
  if (!companionEntry) {
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

function makeLiveSessionToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `run-${crypto.randomUUID()}`;
  }

  return `run-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function inferStepFromSlide(currentSlide: string) {
  const match = currentSlide.match(/^(\d+)/);
  const number = match ? Number.parseInt(match[1], 10) : 1;
  return `slide${number}`;
}

async function buildPayload(input: Partial<LiveSessionState>, request: Request): Promise<LiveSessionPayload> {
  const state = normalizeLiveSessionState(input);
  const manifest = await readPresentationDeckManifest(state.deckId);
  const companionEntry = manifest
    ? await resolveCompanionEntryForStep(state.deckId, manifest, state.currentStep)
    : null;
  const resolvedManifest = companionEntry && manifest?.companion
    ? {
        ...manifest,
        companion: {
          ...manifest.companion,
          entry: companionEntry,
        },
      }
    : manifest;
  const audienceUrl = buildAudienceUrl(request, state, resolvedManifest ?? manifest);
  const companionUrl = buildCompanionUrl(state, companionEntry);

  if (!manifest) {
    return {
      state,
      deckTitle: state.deckId,
      audienceEnabled: true,
      qrOverlayEnabled: true,
      audienceUrl,
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
    audienceUrl,
    companionUrl,
    content: getAudienceContentForDeck(manifest, state.currentStep),
  };
}

export async function GET(request: Request) {
  try {
    const snapshot = await getAdminDb().collection(COLLECTION_NAME).doc(LIVE_SESSION_ID).get();
    if (!snapshot.exists) {
      return NextResponse.json(await buildPayload(LIVE_SESSION_DEFAULT_STATE, request), {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      });
    }

    const data = snapshot.data() as Partial<LiveSessionState> | undefined;
    return NextResponse.json(await buildPayload(data ?? LIVE_SESSION_DEFAULT_STATE, request), {
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
    const body = (await request.json()) as Partial<LiveSessionState> & {
      currentStep?: string;
      currentSlide?: string;
      deckId?: string;
      audienceStep?: number | null;
      resetSession?: boolean;
      audienceQrVisible?: boolean;
    };
    const deckId = typeof body.deckId === 'string' && body.deckId.trim().length > 0
      ? body.deckId.trim()
      : LIVE_SESSION_DEFAULT_STATE.deckId;
    const currentSlide = typeof body.currentSlide === 'string' && body.currentSlide.trim().length > 0
      ? body.currentSlide.trim()
      : LIVE_SESSION_DEFAULT_STATE.currentSlide;
    const resetSession = body.resetSession === true;
    const snapshot = await getAdminDb().collection(COLLECTION_NAME).doc(LIVE_SESSION_ID).get();
    const existingState = snapshot.exists
      ? normalizeLiveSessionState(snapshot.data() as Partial<LiveSessionState>)
      : LIVE_SESSION_DEFAULT_STATE;

    const inferredStep = typeof body.currentStep === 'string' && body.currentStep.trim().length > 0
      ? body.currentStep
      : inferStepFromSlide(currentSlide);

    const nextState: LiveSessionState = {
      deckId,
      currentStep: inferredStep,
      currentSlide,
      audienceStep: typeof body.audienceStep === 'number' && Number.isFinite(body.audienceStep) ? body.audienceStep : null,
      sessionToken: resetSession
        ? makeLiveSessionToken()
        : (typeof body.sessionToken === 'string' && body.sessionToken.trim().length > 0
            ? body.sessionToken.trim()
            : existingState.sessionToken),
      updatedAt: new Date().toISOString(),
      // Only changes when explicitly set, so slide navigation never clears the QR.
      // Reset always clears it.
      audienceQrVisible: resetSession
        ? false
        : (typeof body.audienceQrVisible === 'boolean' ? body.audienceQrVisible : existingState.audienceQrVisible),
    };

    await getAdminDb()
      .collection(COLLECTION_NAME)
      .doc(LIVE_SESSION_ID)
      .set(nextState, { merge: true });

    return NextResponse.json(await buildPayload(nextState, request));
  } catch (error) {
    console.error('Unable to update live session state.', error);
    return NextResponse.json(
      { error: 'Unable to update live session state.' },
      { status: 500 },
    );
  }
}

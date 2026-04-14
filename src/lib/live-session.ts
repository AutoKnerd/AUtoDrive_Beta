export const LIVE_SESSION_ID = 'autoknerd-main';

export type LiveSessionState = {
  deckId: string;
  currentStep: string;
  currentSlide: string;
  audienceStep: number | null;
  sessionToken: string;
  updatedAt: string | null;
};

export type LiveSessionAudienceContent = {
  eyebrow: string;
  title: string;
  body: string;
  prompt?: string;
  speakerNotes?: string[];
};

export type LiveSessionAudienceResponseValue =
  | string
  | number
  | boolean
  | string[]
  | Record<string, string | number | boolean | string[] | null>;

export type LiveSessionAudienceResponseInput = {
  userId: string;
  sessionId?: string;
  slideId: string;
  screenId?: string;
  responseKey?: string;
  slideNumber?: number;
  audienceStep?: number;
  answer: string;
  selectedValue?: LiveSessionAudienceResponseValue;
  timestamp?: string;
  deckId?: string;
  slideStep?: string;
  currentSlide?: string;
  answerLabel?: string;
  sessionToken?: string;
};

export type LiveSessionAudienceResponseRecord = LiveSessionAudienceResponseInput & {
  source: 'live-session';
  createdAt: string | null;
};

export type LiveSessionPresentationLeadRecord = {
  id: string;
  userId: string;
  sessionId: string;
  sessionToken: string;
  email: string | null;
  name: string | null;
  dealership: string | null;
  status: 'captured' | 'skipped' | 'completed';
  deckId: string;
  slideId: string;
  currentSlide: string;
  slideNumber: number | null;
  lastResponseKey: string | null;
  latestAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  finalCtaClicked: boolean;
};

export type LiveSessionPayload = {
  state: LiveSessionState;
  deckTitle: string;
  audienceEnabled: boolean;
  qrOverlayEnabled: boolean;
  audienceUrl?: string;
  content: LiveSessionAudienceContent;
};

export const LIVE_SESSION_DEFAULT_STATE: LiveSessionState = {
  deckId: 'autoknerd-strategic-deck',
  currentStep: 'slide1',
  currentSlide: '01-the-hook.html',
  audienceStep: null,
  sessionToken: 'session-0',
  updatedAt: null,
};

export const LIVE_SESSION_AUDIENCE_RESPONSE_COLLECTION = 'presentation_live_session_responses';
export const LIVE_SESSION_PRESENTATION_LEADS_COLLECTION = 'presentation_live_presentation_leads';

export function normalizeLiveSessionState(input?: Partial<LiveSessionState> | null): LiveSessionState {
  return {
    deckId: input?.deckId ?? LIVE_SESSION_DEFAULT_STATE.deckId,
    currentStep: input?.currentStep ?? LIVE_SESSION_DEFAULT_STATE.currentStep,
    currentSlide: input?.currentSlide ?? LIVE_SESSION_DEFAULT_STATE.currentSlide,
    audienceStep: typeof input?.audienceStep === 'number' && Number.isFinite(input.audienceStep)
      ? input.audienceStep
      : LIVE_SESSION_DEFAULT_STATE.audienceStep,
    sessionToken: input?.sessionToken ?? LIVE_SESSION_DEFAULT_STATE.sessionToken,
    updatedAt: input?.updatedAt ?? LIVE_SESSION_DEFAULT_STATE.updatedAt,
  };
}

export function getLiveSessionStateUpdatedAtEpoch(state?: Partial<LiveSessionState> | null) {
  const raw = state?.updatedAt;
  if (typeof raw !== 'string' || raw.trim().length === 0) return 0;

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const LIVE_SESSION_ID = 'autoknerd-main';

export type LiveSessionState = {
  deckId: string;
  currentStep: string;
  currentSlide: string;
  updatedAt: string | null;
};

export type LiveSessionAudienceContent = {
  eyebrow: string;
  title: string;
  body: string;
  prompt?: string;
};

export type LiveSessionPayload = {
  state: LiveSessionState;
  deckTitle: string;
  audienceEnabled: boolean;
  qrOverlayEnabled: boolean;
  content: LiveSessionAudienceContent;
};

export const LIVE_SESSION_DEFAULT_STATE: LiveSessionState = {
  deckId: 'autoknerd-strategic-deck',
  currentStep: 'slide1',
  currentSlide: '01-the-hook.html',
  updatedAt: null,
};

export function normalizeLiveSessionState(input?: Partial<LiveSessionState> | null): LiveSessionState {
  return {
    deckId: input?.deckId ?? LIVE_SESSION_DEFAULT_STATE.deckId,
    currentStep: input?.currentStep ?? LIVE_SESSION_DEFAULT_STATE.currentStep,
    currentSlide: input?.currentSlide ?? LIVE_SESSION_DEFAULT_STATE.currentSlide,
    updatedAt: input?.updatedAt ?? LIVE_SESSION_DEFAULT_STATE.updatedAt,
  };
}

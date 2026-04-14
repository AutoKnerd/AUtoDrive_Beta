'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  LIVE_SESSION_DEFAULT_STATE,
  getLiveSessionStateUpdatedAtEpoch,
  type LiveSessionAudienceResponseInput,
  type LiveSessionPayload,
} from '@/lib/live-session';
import { AutoKnerdLiveSnapshot } from '@/app/live-session/autoknerd-live-snapshot';

type Slide1Answer = 'Our people' | 'Our process' | 'Our management' | 'Not sure';
type Slide1StoredResponse = LiveSessionAudienceResponseInput & {
  slideId: 'slide_01';
};

type Slide2Answer =
  | 'Very consistent'
  | 'Somewhat consistent'
  | 'Inconsistent'
  | 'I don’t know'
  | 'Rarely'
  | 'Sometimes'
  | 'Often'
  | 'Constantly'
  | 'Immediately'
  | 'Within a few days'
  | 'After it impacts results'
  | 'We rely on CSI reports';

type Slide2StoredResponse = LiveSessionAudienceResponseInput & {
  slideId: 'slide_02';
};

type Slide8Answer = 'Every week' | 'A few times a month' | 'Occasionally' | 'We don’t';
type Slide8Phase = 'question' | 'feedback' | 'reinforcement';
type Slide8StoredResponse = LiveSessionAudienceResponseInput & {
  slideId: 'slide_08';
};

const USER_ID_STORAGE_KEY = 'autoknerd-live-session-user-id';

function getSlide1ResponseStorageKey(sessionToken: string) {
  return `autoknerd-live-session-slide1-response:${sessionToken || 'default'}`;
}

function getSlide2ResponseStorageKey(sessionToken: string) {
  return `autoknerd-live-session-slide2-responses:${sessionToken || 'default'}`;
}

function getSlide8ResponseStorageKey(sessionToken: string) {
  return `autoknerd-live-session-slide8-response:${sessionToken || 'default'}`;
}

const SLIDE_1_ANSWERS: Array<{ label: Slide1Answer }> = [
  { label: 'Our people' },
  { label: 'Our process' },
  { label: 'Our management' },
  { label: 'Not sure' },
];

const SLIDE_8_ANSWERS: Array<{ label: Slide8Answer }> = [
  { label: 'Every week' },
  { label: 'A few times a month' },
  { label: 'Occasionally' },
  { label: 'We don’t' },
];

const SLIDE_8_FEEDBACK: Record<Slide8Answer, string> = {
  'Every week': 'You’re ahead of most stores.\nNow the question is… how consistent is the execution?',
  'A few times a month': 'That’s where inconsistency starts.\nGaps between action = problems survive.',
  Occasionally: 'That’s reactive management.\nProblems don’t get fixed… they rotate.',
  'We don’t': 'That’s the norm.\nAnd it’s exactly why performance stays inconsistent.',
};

const SLIDE_2_PROMPTS: Record<number, { question: string; options: Slide2Answer[] }> = {
  1: {
    question: 'How consistent is your customer experience today?',
    options: ['Very consistent', 'Somewhat consistent', 'Inconsistent', 'I don’t know'],
  },
  2: {
    question: 'How often are your managers reacting instead of leading?',
    options: ['Rarely', 'Sometimes', 'Often', 'Constantly'],
  },
  3: {
    question: 'How quickly do you identify customer experience problems?',
    options: ['Immediately', 'Within a few days', 'After it impacts results', 'We rely on CSI reports'],
  },
};

function fallbackPayload(): LiveSessionPayload {
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

function detectMobileAudience() {
  if (typeof window === 'undefined') return false;

  const isTouchPrimary = window.matchMedia('(pointer: coarse)').matches;
  const hasTouchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  const mobileUserAgent =
    typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent);

  return isTouchPrimary || hasTouchPoints || mobileUserAgent;
}

function safeParseStoredResponse(raw: string | null): Slide8StoredResponse | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Slide8StoredResponse>;
    if (parsed?.slideId !== 'slide_08') return null;
    if (typeof parsed.answer !== 'string' || parsed.answer.trim().length === 0) return null;
    if (typeof parsed.userId !== 'string' || parsed.userId.trim().length === 0) return null;
    return parsed as Slide8StoredResponse;
  } catch {
    return null;
  }
}

function safeParseSlide1StoredResponse(raw: string | null): Slide1StoredResponse | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Slide1StoredResponse>;
    if (parsed?.slideId !== 'slide_01') return null;
    if (typeof parsed.answer !== 'string' || parsed.answer.trim().length === 0) return null;
    if (typeof parsed.userId !== 'string' || parsed.userId.trim().length === 0) return null;
    return parsed as Slide1StoredResponse;
  } catch {
    return null;
  }
}

function safeParseSlide2StoredResponses(raw: string | null): Record<number, Slide2StoredResponse> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<Slide2StoredResponse>>;
    return Object.entries(parsed).reduce<Record<number, Slide2StoredResponse>>((accumulator, [key, value]) => {
      const step = Number.parseInt(key, 10);
      if (!Number.isFinite(step) || step < 1 || step > 3) return accumulator;
      if (value?.slideId !== 'slide_02') return accumulator;
      if (typeof value.answer !== 'string' || value.answer.trim().length === 0) return accumulator;
      if (typeof value.userId !== 'string' || value.userId.trim().length === 0) return accumulator;
      accumulator[step] = value as Slide2StoredResponse;
      return accumulator;
    }, {});
  } catch {
    return {};
  }
}

function makeAudienceUserId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `aud-${crypto.randomUUID()}`;
  }

  return `aud-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function getOrCreateAudienceUserId() {
  if (typeof window === 'undefined') {
    return makeAudienceUserId();
  }

  try {
    const existing = window.localStorage.getItem(USER_ID_STORAGE_KEY);
    if (existing && existing.trim().length > 0) {
      return existing;
    }
    const next = makeAudienceUserId();
    window.localStorage.setItem(USER_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return makeAudienceUserId();
  }
}

function storeSlide8Response(sessionToken: string, record: Slide8StoredResponse) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getSlide8ResponseStorageKey(sessionToken), JSON.stringify(record));
  } catch {
    // Ignore storage failures. The Firestore write still carries the response.
  }
}

function readSlide8Response(sessionToken: string) {
  if (typeof window === 'undefined') return null;

  try {
    return safeParseStoredResponse(window.localStorage.getItem(getSlide8ResponseStorageKey(sessionToken)));
  } catch {
    return null;
  }
}

function storeSlide1Response(sessionToken: string, record: Slide1StoredResponse) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getSlide1ResponseStorageKey(sessionToken), JSON.stringify(record));
  } catch {
    // Ignore storage failures. The Firestore write still carries the response.
  }
}

function readSlide1Response(sessionToken: string) {
  if (typeof window === 'undefined') return null;

  try {
    return safeParseSlide1StoredResponse(window.localStorage.getItem(getSlide1ResponseStorageKey(sessionToken)));
  } catch {
    return null;
  }
}

function storeSlide2Responses(sessionToken: string, records: Record<number, Slide2StoredResponse>) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getSlide2ResponseStorageKey(sessionToken), JSON.stringify(records));
  } catch {
    // Ignore storage failures. The Firestore write still carries the response.
  }
}

function readSlide2Responses(sessionToken: string) {
  if (typeof window === 'undefined') return {};

  try {
    return safeParseSlide2StoredResponses(window.localStorage.getItem(getSlide2ResponseStorageKey(sessionToken)));
  } catch {
    return {};
  }
}

function sendAudienceResponse(record: LiveSessionAudienceResponseInput) {
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const didSend = navigator.sendBeacon(
        '/api/live-session/responses',
        new Blob([JSON.stringify(record)], { type: 'application/json' }),
      );

      if (didSend) {
        return;
      }
    } catch {
      // Fall back to fetch below.
    }
  }

  void fetch('/api/live-session/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(record),
    keepalive: true,
  }).catch((error) => {
    console.error('Unable to store live session audience response.', error);
  });
}

function SlideOneAudienceFlow({ payload }: { payload: LiveSessionPayload }) {
  const [selectedAnswer, setSelectedAnswer] = useState<Slide1Answer | null>(null);
  const [submittedAnswer, setSubmittedAnswer] = useState<Slide1Answer | null>(null);
  const [contentVisible, setContentVisible] = useState(true);
  const [audienceUserId, setAudienceUserId] = useState('');
  const sessionToken = payload.state.sessionToken;

  useEffect(() => {
    const nextUserId = getOrCreateAudienceUserId();
    setAudienceUserId(nextUserId);

    setSelectedAnswer(null);
    setSubmittedAnswer(null);
    const stored = readSlide1Response(sessionToken);
    if (stored?.answer) {
      setSelectedAnswer(stored.answer as Slide1Answer);
      setSubmittedAnswer(stored.answer as Slide1Answer);
    }
  }, [sessionToken]);

  useEffect(() => {
    setContentVisible(false);
    const frame = window.requestAnimationFrame(() => setContentVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [submittedAnswer]);

  const handleSubmit = () => {
    if (!selectedAnswer) return;

    const resolvedUserId = audienceUserId || getOrCreateAudienceUserId();
    if (!audienceUserId) {
      setAudienceUserId(resolvedUserId);
    }

    const record: Slide1StoredResponse = {
      userId: resolvedUserId,
      sessionId: resolvedUserId,
      slideId: 'slide_01',
      slideNumber: 1,
      answer: selectedAnswer,
      answerLabel: selectedAnswer,
      timestamp: new Date().toISOString(),
      deckId: payload.state.deckId,
      slideStep: payload.state.currentStep,
      currentSlide: payload.state.currentSlide,
      sessionToken,
    };

    setSubmittedAnswer(selectedAnswer);
    storeSlide1Response(sessionToken, record);
    sendAudienceResponse(record);
  };

  const wrapperClassName = contentVisible
    ? 'opacity-100 translate-y-0'
    : 'opacity-0 translate-y-3';

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-1 items-center justify-center px-0 pb-4 pt-8">
      <section
        aria-live="polite"
        className="w-full max-w-md rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
      >
        <div className={`transition-all duration-300 ease-out ${wrapperClassName}`}>
          {submittedAnswer ? (
            <div className="flex min-h-[30rem] flex-col items-center justify-center text-center">
              <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Reality Check Captured</p>
              <h2 className="mx-auto mt-5 max-w-sm text-2xl font-black leading-[1.12] tracking-[-0.04em] text-white">
                Thanks. We&apos;ll use this later to show where the room thinks the issue starts.
              </h2>
              <p className="mt-5 text-sm text-white/50">Stay here. The next slide will update automatically.</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Quick Reality Check</p>
              <h2 className="mt-4 text-[1.9rem] font-black leading-[1.02] tracking-[-0.05em] text-white">
                Where do you believe your biggest performance issue comes from?
              </h2>
              <div className="mt-6 grid gap-3">
                {SLIDE_1_ANSWERS.map((item) => {
                  const isSelected = selectedAnswer === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setSelectedAnswer(item.label)}
                      className={`min-h-14 rounded-2xl border px-4 py-4 text-left text-base font-semibold tracking-[-0.01em] transition duration-200 ease-out active:scale-[0.99] ${
                        isSelected
                          ? 'border-[#39FF14]/70 bg-[#39FF14]/14 text-white shadow-[0_0_24px_rgba(57,255,20,0.14)]'
                          : 'border-white/10 bg-white/[0.04] text-white hover:border-[#39FF14]/50 hover:bg-[#39FF14]/10 hover:text-[#d8ffd0]'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!selectedAnswer}
                className={`mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border px-4 py-4 text-sm font-black uppercase tracking-[0.22em] transition duration-200 ease-out ${
                  selectedAnswer
                    ? 'border-[#39FF14]/55 bg-[#39FF14] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] hover:scale-[1.01]'
                    : 'border-white/10 bg-white/[0.03] text-white/35'
                }`}
              >
                Submit
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function SlideTwoAudienceFlow({ payload }: { payload: LiveSessionPayload }) {
  const activeStep = payload.state.audienceStep ?? 0;
  const [audienceUserId, setAudienceUserId] = useState('');
  const [responsesByStep, setResponsesByStep] = useState<Record<number, Slide2StoredResponse>>({});
  const [contentVisible, setContentVisible] = useState(true);
  const sessionToken = payload.state.sessionToken;

  useEffect(() => {
    const nextUserId = getOrCreateAudienceUserId();
    setAudienceUserId(nextUserId);
    setResponsesByStep({});
    setResponsesByStep(readSlide2Responses(sessionToken));
  }, [sessionToken]);

  useEffect(() => {
    setContentVisible(false);
    const frame = window.requestAnimationFrame(() => setContentVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [activeStep]);

  const prompt = SLIDE_2_PROMPTS[activeStep];
  const existingResponse = activeStep > 0 ? responsesByStep[activeStep] ?? null : null;

  const handleAnswer = (answer: Slide2Answer) => {
    if (!prompt || activeStep < 1 || activeStep > 3) return;

    const resolvedUserId = audienceUserId || getOrCreateAudienceUserId();
    if (!audienceUserId) {
      setAudienceUserId(resolvedUserId);
    }

    const record: Slide2StoredResponse = {
      userId: resolvedUserId,
      sessionId: resolvedUserId,
      slideId: 'slide_02',
      slideNumber: 2,
      audienceStep: activeStep,
      answer,
      answerLabel: answer,
      timestamp: new Date().toISOString(),
      deckId: payload.state.deckId,
      slideStep: payload.state.currentStep,
      currentSlide: payload.state.currentSlide,
      sessionToken,
    };

    setResponsesByStep((previous) => {
      const next = { ...previous, [activeStep]: record };
      storeSlide2Responses(sessionToken, next);
      return next;
    });
    sendAudienceResponse(record);
  };

  const wrapperClassName = contentVisible
    ? 'opacity-100 translate-y-0'
    : 'opacity-0 translate-y-3';

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-1 items-center justify-center px-0 pb-4 pt-8">
      <section
        aria-live="polite"
        className="w-full max-w-md rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
      >
        <div className={`transition-all duration-300 ease-out ${wrapperClassName}`}>
          {activeStep === 0 ? (
            <div className="flex min-h-[30rem] flex-col items-center justify-center text-center">
              <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Slide 02</p>
              <h2 className="mx-auto mt-5 max-w-sm text-2xl font-black leading-[1.08] tracking-[-0.04em] text-white">
                It doesn&apos;t show up all at once.
              </h2>
              <p className="mt-5 text-sm text-white/50">The presenter will reveal the problem one layer at a time.</p>
            </div>
          ) : prompt ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Live Signal Check</p>
              <h2 className="mt-4 text-[1.9rem] font-black leading-[1.04] tracking-[-0.05em] text-white">
                {prompt.question}
              </h2>
              <div className="mt-6 grid gap-3">
                {prompt.options.map((option) => {
                  const isSelected = existingResponse?.answer === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => handleAnswer(option)}
                      className={`min-h-14 rounded-2xl border px-4 py-4 text-left text-base font-semibold tracking-[-0.01em] transition duration-200 ease-out active:scale-[0.99] ${
                        isSelected
                          ? 'border-[#39FF14]/70 bg-[#39FF14]/14 text-white shadow-[0_0_24px_rgba(57,255,20,0.14)]'
                          : 'border-white/10 bg-white/[0.04] text-white hover:border-[#39FF14]/50 hover:bg-[#39FF14]/10 hover:text-[#d8ffd0]'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              <p className="mt-5 text-sm text-white/50">
                {existingResponse ? 'Response captured. It will be used in the final room summary.' : 'Tap the answer that feels most true right now.'}
              </p>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SlideEightAudienceFlow({ payload }: { payload: LiveSessionPayload }) {
  const [phase, setPhase] = useState<Slide8Phase>('question');
  const [selectedAnswer, setSelectedAnswer] = useState<Slide8Answer | null>(null);
  const [pendingAnswer, setPendingAnswer] = useState<Slide8Answer | null>(null);
  const [contentVisible, setContentVisible] = useState(true);
  const [audienceUserId, setAudienceUserId] = useState('');
  const feedbackTimerRef = useRef<number | null>(null);
  const sessionToken = payload.state.sessionToken;

  useEffect(() => {
    const nextUserId = getOrCreateAudienceUserId();
    setAudienceUserId(nextUserId);
    setSelectedAnswer(null);
    setPendingAnswer(null);
    setPhase('question');

    const stored = readSlide8Response(sessionToken);
    if (stored?.answer) {
      setSelectedAnswer(stored.answer as Slide8Answer);
      setPhase('reinforcement');
    }
  }, [sessionToken]);

  useEffect(() => {
    setContentVisible(false);
    const frame = window.requestAnimationFrame(() => setContentVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  const handleAnswer = (answer: Slide8Answer) => {
    if (phase !== 'question') return;

    const resolvedUserId = audienceUserId || getOrCreateAudienceUserId();
    if (!audienceUserId) {
      setAudienceUserId(resolvedUserId);
    }

    const record: Slide8StoredResponse = {
      userId: resolvedUserId,
      sessionId: resolvedUserId,
      slideId: 'slide_08',
      slideNumber: 8,
      answer,
      answerLabel: answer,
      timestamp: new Date().toISOString(),
      deckId: payload.state.deckId,
      slideStep: payload.state.currentStep,
      currentSlide: payload.state.currentSlide,
      sessionToken,
    };

    setSelectedAnswer(answer);
    setPhase('feedback');
    storeSlide8Response(sessionToken, record);
    sendAudienceResponse(record);

    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }

    feedbackTimerRef.current = window.setTimeout(() => {
      setPhase('reinforcement');
    }, 2400);
  };

  const wrapperClassName = contentVisible
    ? 'opacity-100 translate-y-0'
    : 'opacity-0 translate-y-3';

  return (
    <div className="flex min-h-[calc(100vh-9rem)] flex-1 items-center justify-center px-0 pb-4 pt-8">
      <section
        aria-live="polite"
        className="w-full max-w-md rounded-[30px] border border-white/8 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.38)]"
      >
        <div className={`transition-all duration-300 ease-out ${wrapperClassName}`}>
          {phase === 'question' ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Weekly Execution Check</p>
              <h2 className="mt-4 text-[1.9rem] font-black leading-[1.02] tracking-[-0.05em] text-white">
                How often does your store run a structured improvement cycle like this?
              </h2>
              <div className="mt-6 grid gap-3">
                {SLIDE_8_ANSWERS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setPendingAnswer(item.label)}
                    className={`min-h-14 rounded-2xl border px-4 py-4 text-left text-base font-semibold tracking-[-0.01em] transition duration-200 ease-out active:scale-[0.99] ${
                      pendingAnswer === item.label
                        ? 'border-[#39FF14]/70 bg-[#39FF14]/14 text-white shadow-[0_0_24px_rgba(57,255,20,0.14)]'
                        : 'border-white/10 bg-white/[0.04] text-white hover:border-[#39FF14]/50 hover:bg-[#39FF14]/10 hover:text-[#d8ffd0]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!pendingAnswer) return;
                  handleAnswer(pendingAnswer);
                }}
                disabled={!pendingAnswer}
                className={`mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border px-4 py-4 text-sm font-black uppercase tracking-[0.22em] transition duration-200 ease-out ${
                  pendingAnswer
                    ? 'border-[#39FF14]/55 bg-[#39FF14] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] hover:scale-[1.01]'
                    : 'border-white/10 bg-white/[0.03] text-white/35'
                }`}
              >
                Continue
              </button>
            </>
          ) : phase === 'feedback' && selectedAnswer ? (
            <div className="flex min-h-[30rem] flex-col items-center justify-center text-center">
              <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Quick signal</p>
              <h2 className="mx-auto mt-5 max-w-sm whitespace-pre-line text-2xl font-black leading-[1.2] tracking-[-0.04em] text-white">
                {SLIDE_8_FEEDBACK[selectedAnswer]}
              </h2>
            </div>
          ) : (
            <div className="flex min-h-[30rem] flex-col items-center justify-center text-center">
              <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Reinforcement</p>
              <h2 className="mx-auto mt-5 max-w-sm text-2xl font-black leading-[1.18] tracking-[-0.04em] text-white">
                AutoKnerd installs a weekly execution rhythm your managers actually follow.
              </h2>
              <p className="mt-5 text-sm text-white/50">Your answers will be used later.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function GenericLiveSessionView({ payload, status }: { payload: LiveSessionPayload; status: 'connecting' | 'live' | 'offline' }) {
  return (
    <>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Live Session</p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-white">{payload.deckTitle}</h1>
        </div>
        <div
          className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
            status === 'live'
              ? 'border-[#8eff71]/40 bg-[#8eff71]/10 text-[#8eff71]'
              : status === 'connecting'
                ? 'border-white/15 bg-white/5 text-white/65'
                : 'border-[#ff8f78]/40 bg-[#ff8f78]/10 text-[#ff8f78]'
          }`}
        >
          {status === 'live' ? 'Synced' : status === 'connecting' ? 'Connecting' : 'Reconnecting'}
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(142,255,113,0.12),transparent_34%)]" />
        <p className="relative text-[10px] uppercase tracking-[0.3em] text-[#8eff71]">{payload.content.eyebrow}</p>
        <h2 className="relative mt-5 text-4xl font-black leading-[1.02] tracking-[-0.05em] text-white">
          {payload.content.title}
        </h2>
        <p className="relative mt-6 text-base leading-7 text-white/76">{payload.content.body}</p>
        {payload.content.prompt ? (
          <p className="relative mt-6 text-sm leading-6 text-white/52">{payload.content.prompt}</p>
        ) : null}
      </section>

      <section className="mt-8 rounded-[24px] border border-white/8 bg-white/[0.02] p-5">
        <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">Current Step</p>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-lg font-semibold text-white">{payload.state.currentStep.toUpperCase()}</p>
            <p className="mt-1 text-sm text-white/48">{payload.state.currentSlide}</p>
          </div>
          <div className="h-3 w-3 rounded-full bg-[#8eff71] shadow-[0_0_18px_rgba(142,255,113,0.75)]" />
        </div>
      </section>

      <div className="mt-auto pt-10 text-center">
        {payload.qrOverlayEnabled ? (
          <Link
            href="/live-session/qr"
            className="inline-flex items-center justify-center rounded-full border border-[#8eff71]/25 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8eff71] transition hover:border-[#8eff71]/55 hover:bg-[#8eff71]/8"
          >
            Open QR Screen
          </Link>
        ) : null}
      </div>
    </>
  );
}

export function LiveSessionClient({ initialPayload }: { initialPayload?: LiveSessionPayload }) {
  const seededPayload = initialPayload ?? fallbackPayload();
  const [payload, setPayload] = useState<LiveSessionPayload>(seededPayload);
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>(initialPayload ? 'live' : 'connecting');
  const [isMobileAudience, setIsMobileAudience] = useState(false);
  const [isForcedAudience, setIsForcedAudience] = useState(false);
  const lastVibratedStepRef = useRef<string | null>(null);
  const pendingVibrationRef = useRef(false);
  const lastPayloadUpdatedAtRef = useRef(getLiveSessionStateUpdatedAtEpoch(seededPayload.state));

  const commitPayload = (nextPayload: LiveSessionPayload) => {
    const nextUpdatedAt = getLiveSessionStateUpdatedAtEpoch(nextPayload.state);
    if (nextUpdatedAt === 0) {
      if (lastPayloadUpdatedAtRef.current > 0) {
        return false;
      }
    } else if (nextUpdatedAt < lastPayloadUpdatedAtRef.current) {
      return false;
    }

    if (nextUpdatedAt > 0) {
      lastPayloadUpdatedAtRef.current = nextUpdatedAt;
    }

    setPayload(nextPayload);
    setStatus('live');
    return true;
  };

  useEffect(() => {
    let mounted = true;

    fetch('/api/live-session', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        commitPayload(data as LiveSessionPayload);
      })
      .catch((error) => {
        console.error('Unable to fetch initial live session state.', error);
      });

    const eventSource = new EventSource('/api/live-session/stream');

    eventSource.onopen = () => {
      if (!mounted) return;
      setStatus('live');
    };

    eventSource.onmessage = (event) => {
      if (!mounted) return;
      try {
        const nextPayload = JSON.parse(event.data) as LiveSessionPayload;
        commitPayload(nextPayload);
      } catch (error) {
        console.error('Unable to parse live session payload.', error);
      }
    };

    eventSource.onerror = () => {
      if (!mounted) return;
      setStatus('offline');
    };

    return () => {
      mounted = false;
      eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const searchParams = new URLSearchParams(window.location.search);
    setIsForcedAudience(searchParams.get('audience') === '1');

    const updateIsMobileAudience = () => {
      setIsMobileAudience(detectMobileAudience());
    };

    updateIsMobileAudience();
    window.addEventListener('resize', updateIsMobileAudience);
    window.addEventListener('orientationchange', updateIsMobileAudience);

    return () => {
      window.removeEventListener('resize', updateIsMobileAudience);
      window.removeEventListener('orientationchange', updateIsMobileAudience);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;

    const isSupported = typeof navigator.vibrate === 'function';
    const isMobileViewport = detectMobileAudience();
    const isSlideSix = payload.state.currentStep === 'slide6';

    if (!isSlideSix) {
      lastVibratedStepRef.current = null;
      return;
    }

    if (!isSupported || !isMobileViewport) {
      return;
    }

    if (lastVibratedStepRef.current === payload.state.currentStep) {
      return;
    }

    try {
      const didVibrate = navigator.vibrate([200, 150, 200]);
      if (didVibrate) {
        lastVibratedStepRef.current = payload.state.currentStep;
        pendingVibrationRef.current = false;
        return;
      }
    } catch {
      // Fall through to user-activation fallback.
    }

    pendingVibrationRef.current = true;
  }, [payload.state.currentStep]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (typeof navigator.vibrate !== 'function') return;

    const tryPendingVibration = () => {
      if (!pendingVibrationRef.current) return;
      if (payload.state.currentStep !== 'slide6') return;
      if (lastVibratedStepRef.current === payload.state.currentStep) return;

      try {
        const didVibrate = navigator.vibrate([200, 150, 200]);
        if (!didVibrate) return;
        lastVibratedStepRef.current = payload.state.currentStep;
        pendingVibrationRef.current = false;
      } catch {
        // Fail silently when the browser declines vibration.
      }
    };

    window.addEventListener('touchstart', tryPendingVibration, { passive: true });
    window.addEventListener('pointerdown', tryPendingVibration, { passive: true });
    window.addEventListener('click', tryPendingVibration, { passive: true });

    return () => {
      window.removeEventListener('touchstart', tryPendingVibration);
      window.removeEventListener('pointerdown', tryPendingVibration);
      window.removeEventListener('click', tryPendingVibration);
    };
  }, [payload.state.currentStep]);

  const shouldUseAudienceExperience = isMobileAudience || isForcedAudience;
  const showSlideEightAudienceFlow = shouldUseAudienceExperience && payload.state.currentStep === 'slide8';
  const showSlideTwoAudienceFlow = shouldUseAudienceExperience && payload.state.currentStep === 'slide2';
  const showSlideOneAudienceFlow = shouldUseAudienceExperience && payload.state.currentStep === 'slide1';
  const showSnapshotAudienceFlow = shouldUseAudienceExperience;

  if (showSnapshotAudienceFlow) {
    return <AutoKnerdLiveSnapshot payload={payload} status={status} />;
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-12 pt-10">
        {showSlideOneAudienceFlow ? (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Live Session</p>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-white">{payload.deckTitle}</h1>
              </div>
              <div
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                  status === 'live'
                    ? 'border-[#8eff71]/40 bg-[#8eff71]/10 text-[#8eff71]'
                    : status === 'connecting'
                      ? 'border-white/15 bg-white/5 text-white/65'
                      : 'border-[#ff8f78]/40 bg-[#ff8f78]/10 text-[#ff8f78]'
                }`}
              >
                {status === 'live' ? 'Synced' : status === 'connecting' ? 'Connecting' : 'Reconnecting'}
              </div>
            </div>

            <SlideOneAudienceFlow payload={payload} />
          </>
        ) : showSlideTwoAudienceFlow ? (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Live Session</p>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-white">{payload.deckTitle}</h1>
              </div>
              <div
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                  status === 'live'
                    ? 'border-[#8eff71]/40 bg-[#8eff71]/10 text-[#8eff71]'
                    : status === 'connecting'
                      ? 'border-white/15 bg-white/5 text-white/65'
                      : 'border-[#ff8f78]/40 bg-[#ff8f78]/10 text-[#ff8f78]'
                }`}
              >
                {status === 'live' ? 'Synced' : status === 'connecting' ? 'Connecting' : 'Reconnecting'}
              </div>
            </div>

            <SlideTwoAudienceFlow payload={payload} />
          </>
        ) : showSlideEightAudienceFlow ? (
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.32em] text-[#8eff71]">Live Session</p>
                <h1 className="mt-3 text-2xl font-black tracking-tight text-white">{payload.deckTitle}</h1>
              </div>
              <div
                className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                  status === 'live'
                    ? 'border-[#8eff71]/40 bg-[#8eff71]/10 text-[#8eff71]'
                    : status === 'connecting'
                      ? 'border-white/15 bg-white/5 text-white/65'
                      : 'border-[#ff8f78]/40 bg-[#ff8f78]/10 text-[#ff8f78]'
                }`}
              >
                {status === 'live' ? 'Synced' : status === 'connecting' ? 'Connecting' : 'Reconnecting'}
              </div>
            </div>

            <SlideEightAudienceFlow payload={payload} />
          </>
        ) : (
          <GenericLiveSessionView payload={payload} status={status} />
        )}
      </div>
    </main>
  );
}

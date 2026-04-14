'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  type LiveSessionAudienceResponseInput,
  type LiveSessionAudienceResponseValue,
  type LiveSessionPayload,
} from '@/lib/live-session';

export type SnapshotSlideKey =
  | 'slide1'
  | 'slide2'
  | 'slide3'
  | 'slide4'
  | 'slide5'
  | 'slide6'
  | 'slide7'
  | 'slide8'
  | 'slide9'
  | 'slide10'
  | 'slide11'
  | 'slide12'
  | 'slide13'
  | 'slide14'
  | 'slide15';
type SnapshotScreenId =
  | 'entry'
  | 'problem_framing'
  | 'cx_consistency'
  | 'breakdown_point'
  | 'insight_break'
  | 'system_reality'
  | 'supplemental_slide5'
  | 'supplemental_slide7'
  | 'supplemental_slide9'
  | 'supplemental_slide10'
  | 'supplemental_slide11'
  | 'supplemental_slide13'
  | 'manager_coaching'
  | 'business_impact'
  | 'vision_gap'
  | 'slide15_reflection'
  | 'email_capture'
  | 'final_output'
  | 'sprocket_closing_opening'
  | 'sprocket_closing_question'
  | 'sprocket_closing_scenario'
  | 'sprocket_closing_insight'
  | 'sprocket_closing_capture'
  | 'sprocket_closing_week1';

type SnapshotStatus = 'connecting' | 'live' | 'offline';
type SnapshotResponseRecord = LiveSessionAudienceResponseInput & {
  screenId: SnapshotScreenId;
  responseKey: string;
  selectedValue?: LiveSessionAudienceResponseValue;
};
type SnapshotResponsesMap = Record<string, SnapshotResponseRecord>;
type BusinessImpactSelection = {
  business_pain_signals: string[];
  pain_frequency: string;
};
type ContactInfoSelection = {
  email: string;
  name: string;
  dealership: string;
};
type SprocketClosingFocus = 'consistency' | 'leadership' | 'system' | 'business';
type SprocketClosingPhase = 'opening' | 'question' | 'scenario' | 'insight' | 'capture' | 'week1';
type SprocketScenarioAnswer =
  | 'Address it immediately'
  | 'Wait and see if it improves'
  | 'Mention it later in passing'
  | 'Ignore it';
type SprocketOpeningLine = {
  emphasis?: boolean;
  text: string;
};
type SprocketQuestionConfig = {
  prompt: string;
  options: string[];
  responseKey: string;
};

export const SNAPSHOT_SUPPORTED_STEPS = new Set<SnapshotSlideKey>([
  'slide1',
  'slide2',
  'slide3',
  'slide4',
  'slide5',
  'slide6',
  'slide7',
  'slide8',
  'slide9',
  'slide10',
  'slide11',
  'slide12',
  'slide13',
  'slide14',
  'slide15',
]);

const SNAPSHOT_VERSION = 'v1';
const SNAPSHOT_SESSION_ID_STORAGE_KEY = `autoknerd-live-snapshot-${SNAPSHOT_VERSION}-session-id`;

function getSnapshotResponseStorageKey(sessionToken: string) {
  return `autoknerd-live-snapshot-${SNAPSHOT_VERSION}-response-map:${sessionToken || 'default'}`;
}

const SNAPSHOT_FLOW: Record<SnapshotSlideKey, SnapshotScreenId[]> = {
  slide1: ['entry', 'problem_framing'],
  slide2: ['cx_consistency', 'breakdown_point'],
  slide3: ['insight_break'],
  slide4: ['system_reality'],
  slide5: ['supplemental_slide5'],
  slide6: ['manager_coaching'],
  slide7: ['supplemental_slide7'],
  slide8: ['business_impact'],
  slide9: ['supplemental_slide9'],
  slide10: ['supplemental_slide10'],
  slide11: ['supplemental_slide11'],
  slide12: ['vision_gap'],
  slide13: ['supplemental_slide13'],
  slide14: ['email_capture', 'final_output'],
  slide15: ['slide15_reflection'],
};

const SLIDE_1_OPTIONS = ['Hiring', 'Training', 'Accountability', 'Customer Experience', 'Not sure'] as const;
const SLIDE_2_QUESTION = 'How consistent is your customer experience today?';
const CX_CONSISTENCY_CHOICES = [
  { label: 'Chaotic', range: '1–3', score: 2 },
  { label: 'Unstable', range: '4–6', score: 5 },
  { label: 'Mostly steady', range: '7–8', score: 8 },
  { label: 'Tight', range: '9–10', score: 10 },
] as const;
const SLIDE_4_OPTIONS = ['Sales process', 'Manager follow-up', 'Customer communication', 'Training retention', 'No clear pattern'] as const;
const SLIDE_6_OPTIONS = ['Daily', 'Weekly', 'Occasionally', 'Only when something breaks', 'Almost never'] as const;
const BUSINESS_PAIN_OPTIONS = ['Confused customers', 'Stalled deals', 'Price objections', 'Manager firefighting'] as const;
const PAIN_FREQUENCY_OPTIONS = ['Daily', 'Weekly', 'Occasionally', 'Rarely'] as const;
const VISION_GAP_LABELS = ['1–3: Out of control', '4–6: Trying', '7–8: Close', '9–10: Locked in'] as const;
const SUPPLEMENTAL_SLIDE_5_OPTIONS = ['Yeah', 'I see it', 'Still thinking'] as const;
const SUPPLEMENTAL_SLIDE_7_OPTIONS = ['All the time', 'Occasionally', 'Rarely', 'Never'] as const;
const SUPPLEMENTAL_SLIDE_9_OPTIONS = ['We act immediately', 'We plan but delay', 'It depends on the manager', 'It usually fades away'] as const;
const SUPPLEMENTAL_SLIDE_10_OPTIONS = ['Customers feel more confident', 'Deals move faster', 'Less price pressure', 'Managers feel in control'] as const;
const SUPPLEMENTAL_SLIDE_11_OPTIONS = ['Mostly left side', 'Mixed', 'Mostly right side', 'Not sure'] as const;
const SUPPLEMENTAL_SLIDE_13_OPTIONS = ['Yes', 'Absolutely', 'We need this', 'Not convinced yet'] as const;
const SLIDE_15_OPTIONS = ['Getting managers consistent', 'Getting team buy-in', 'Finding time daily', 'None of this — we need it'] as const;
const SPROCKET_CLOSING_SEEN_KEY = `autoknerd-live-snapshot-${SNAPSHOT_VERSION}-sprocket-closing-seen`;

function normalizeSlideKey(value: string): SnapshotSlideKey | null {
  return value in SNAPSHOT_FLOW ? (value as SnapshotSlideKey) : null;
}

function parseSlideNumber(value: string) {
  const match = value.match(/\d+/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function makeSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `snap-${crypto.randomUUID()}`;
  }

  return `snap-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function getOrCreateSessionId() {
  if (typeof window === 'undefined') {
    return makeSessionId();
  }

  try {
    const existing = window.localStorage.getItem(SNAPSHOT_SESSION_ID_STORAGE_KEY);
    if (existing && existing.trim().length > 0) {
      return existing;
    }

    const next = makeSessionId();
    window.localStorage.setItem(SNAPSHOT_SESSION_ID_STORAGE_KEY, next);
    return next;
  } catch {
    return makeSessionId();
  }
}

function loadResponses(sessionToken: string): SnapshotResponsesMap {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(getSnapshotResponseStorageKey(sessionToken));
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, SnapshotResponseRecord>;
    return Object.entries(parsed).reduce<SnapshotResponsesMap>((accumulator, [key, value]) => {
      if (!value || typeof value !== 'object') return accumulator;
      if (typeof value.responseKey !== 'string' || value.responseKey.trim().length === 0) return accumulator;
      accumulator[key] = value;
      return accumulator;
    }, {});
  } catch {
    return {};
  }
}

function persistResponses(sessionToken: string, responses: SnapshotResponsesMap) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getSnapshotResponseStorageKey(sessionToken), JSON.stringify(responses));
  } catch {
    // Ignore local persistence errors. The API write still captures the response.
  }
}

function sendAudienceResponse(record: SnapshotResponseRecord) {
  const payload: LiveSessionAudienceResponseInput = record;

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const didSend = navigator.sendBeacon(
        '/api/live-session/responses',
        new Blob([JSON.stringify(payload)], { type: 'application/json' }),
      );

      if (didSend) return;
    } catch {
      // Fall back to fetch below.
    }
  }

  void fetch('/api/live-session/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((error) => {
    console.error('Unable to store live snapshot response.', error);
  });
}

function buildSnapshotStatus(responses: SnapshotResponsesMap) {
  const cxRecord = responses.cx_consistency_score;
  const businessRecord = responses.business_impact;
  const managerRecord = responses.manager_coaching_frequency;
  const systemRecord = responses.system_presence;

  const consistencyScore = typeof cxRecord?.selectedValue === 'number' ? cxRecord.selectedValue : null;
  const businessSignals =
    businessRecord && businessRecord.selectedValue && typeof businessRecord.selectedValue === 'object' && !Array.isArray(businessRecord.selectedValue)
      ? (businessRecord.selectedValue as BusinessImpactSelection).business_pain_signals ?? []
      : [];
  const managerValue = typeof managerRecord?.selectedValue === 'string' ? managerRecord.selectedValue : '';
  const systemValues = Array.isArray(systemRecord?.selectedValue) ? systemRecord.selectedValue : [];

  const consistencyStatus =
    consistencyScore !== null && consistencyScore >= 8 && businessSignals.length <= 1
      ? 'High'
      : consistencyScore !== null && consistencyScore >= 5
        ? 'Moderate'
        : 'Low';

  const leadershipStatus =
    managerValue === 'Daily' || managerValue === 'Weekly'
      ? 'Active'
      : managerValue === 'Occasionally'
        ? 'Uneven'
        : 'Reactive';

  const hasStructuredSystem =
    systemValues.includes('We can diagnose issues clearly') &&
    systemValues.includes('Managers follow action plans') &&
    systemValues.includes('We execute weekly');
  const hasMissingSystem = systemValues.includes('None of this exists');

  const systemStatus = hasMissingSystem ? 'Missing' : hasStructuredSystem ? 'Structured' : 'Partial';

  return {
    consistencyStatus,
    leadershipStatus,
    systemStatus,
  };
}

function getSprocketClosingFocus(snapshot: ReturnType<typeof buildSnapshotStatus>, responses: SnapshotResponsesMap): SprocketClosingFocus {
  if (snapshot.systemStatus === 'Missing') return 'system';
  if (snapshot.leadershipStatus === 'Reactive' || snapshot.leadershipStatus === 'Uneven') return 'leadership';
  if (snapshot.consistencyStatus === 'Low') return 'consistency';

  const businessSignals = responses.business_impact?.selectedValue;
  const businessPainSignals =
    businessSignals && typeof businessSignals === 'object' && !Array.isArray(businessSignals)
      ? (businessSignals as BusinessImpactSelection).business_pain_signals ?? []
      : [];

  if (businessPainSignals.length > 1) return 'business';
  return 'consistency';
}

function buildSprocketOpeningLines(snapshot: ReturnType<typeof buildSnapshotStatus>): SprocketOpeningLine[] {
  const lines: SprocketOpeningLine[] = [{ text: 'Alright… I’m looking at this.', emphasis: true }];

  if (snapshot.consistencyStatus === 'Low') {
    lines.push({
      text: 'Customer experience is inconsistent,\nand behavior is not being guided in the moments that matter.',
    });
  }

  if (snapshot.leadershipStatus === 'Reactive' || snapshot.leadershipStatus === 'Uneven') {
    lines.push({ text: 'Managers are reacting instead of leading.' });
  }

  if (snapshot.systemStatus === 'Missing') {
    lines.push({ text: 'There’s no system consistently driving behavior across the store.' });
  }

  if (lines.length === 1) {
    lines.push({ text: 'The pattern is there.\nNow we turn it into something the store can actually run.' });
  }

  return lines;
}

function getSprocketQuestionConfig(focus: SprocketClosingFocus): SprocketQuestionConfig {
  switch (focus) {
    case 'system':
      return {
        prompt: 'Do you currently have any structured weekly process in place?',
        options: ['Yes', 'No'],
        responseKey: 'sprocket_system_question',
      };
    case 'leadership':
      return {
        prompt: 'Is this showing up more in management follow-through or team execution?',
        options: ['Management', 'Team'],
        responseKey: 'sprocket_leadership_question',
      };
    case 'business':
      return {
        prompt: 'Which part is costing you most right now?',
        options: ['Price pressure', 'Stalled deals'],
        responseKey: 'sprocket_business_question',
      };
    case 'consistency':
    default:
      return {
        prompt: 'Is the inconsistency more about the customer experience or the execution around it?',
        options: ['Experience', 'Execution'],
        responseKey: 'sprocket_consistency_question',
      };
  }
}

function getSprocketScenarioOutcome(answer: SprocketScenarioAnswer | null) {
  if (answer === 'Address it immediately') {
    return {
      label: 'GOOD',
      body: 'Behavior gets corrected in the moment.',
    };
  }

  return {
    label: 'BAD',
    body: 'Nothing changes. The pattern repeats.',
  };
}

function getSprocketSeenStorageKey(sessionToken: string) {
  return `${SPROCKET_CLOSING_SEEN_KEY}:${sessionToken || 'default'}`;
}

function getSprocketSeen(sessionToken: string) {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(getSprocketSeenStorageKey(sessionToken)) === 'true';
  } catch {
    return false;
  }
}

function setSprocketSeen(sessionToken: string) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(getSprocketSeenStorageKey(sessionToken), 'true');
  } catch {
    // Ignore local storage failures.
  }
}

function getInitialScreenIndex(step: SnapshotSlideKey, responses: SnapshotResponsesMap) {
  switch (step) {
    case 'slide1':
      return responses.problem_framing ? 1 : responses.entry ? 1 : 0;
    case 'slide2':
      return responses.breakdown_point ? 1 : responses.cx_consistency ? 1 : 0;
    case 'slide14':
      return responses.contact_info || responses.contact_info_skip ? 1 : 0;
    case 'slide15':
      return responses.slide_15_reflection ? 1 : 0;
    default:
      return responses[step === 'slide3'
        ? 'insight_break'
        : step === 'slide4'
          ? 'system_reality'
          : step === 'slide6'
            ? 'manager_coaching'
            : step === 'slide8'
              ? 'business_impact'
              : 'vision_gap'] ? 1 : 0;
  }
}

function CompanionFooter() {
  return (
    <footer className="w-full border-t border-zinc-900 bg-black">
      <div className="mx-auto flex w-full max-w-md flex-col items-center justify-between gap-5 px-6 py-8 text-center">
        <Link
          href="/Autoknerd"
          className="text-[8px] font-bold uppercase tracking-[0.18em] text-[#bdfc00] transition-colors hover:text-[#d7ff66]"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          AutoKnerd
        </Link>
        <div className="flex items-center justify-center">
          <Image
            src="/AutoKnerd Logo.png"
            alt="AutoKnerd"
            width={120}
            height={36}
            className="h-auto w-[96px]"
            priority={false}
          />
        </div>
        <div
          className="flex flex-wrap items-center justify-center gap-2 text-[7px] uppercase tracking-[0.18em] text-zinc-700 opacity-80"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          <span>© 2024 AutoKnerd LLC Dealership CX Development.</span>
          <span className="text-zinc-800">|</span>
          <Link className="text-zinc-600 transition-colors hover:text-zinc-300" href="/legal">
            Legal
          </Link>
        </div>
      </div>
    </footer>
  );
}

function SlideShell({
  payload,
  status,
  slideLabel,
  children,
}: {
  payload: LiveSessionPayload;
  status: SnapshotStatus;
  slideLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#050505] text-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-8 pt-10">
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

        <section className="relative flex-1 overflow-hidden rounded-[28px] border border-white/8 bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(142,255,113,0.12),transparent_34%)]" />
          <div className="relative flex h-full flex-col">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#8eff71]">{slideLabel}</p>
              </div>
              <div className="h-2.5 w-2.5 rounded-full bg-[#8eff71] shadow-[0_0_18px_rgba(142,255,113,0.75)]" />
            </div>
            <div className="flex-1">{children}</div>
          </div>
        </section>
      </div>
      <CompanionFooter />
    </div>
  );
}

function ChoiceButton({
  label,
  selected,
  onClick,
  disabled = false,
  compact = false,
}: {
  label: string;
  selected?: boolean;
  onClick: () => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-2xl border px-4 py-4 text-left text-base font-semibold tracking-[-0.01em] transition duration-200 ease-out active:scale-[0.99] disabled:cursor-not-allowed ${
        compact ? 'min-h-12' : 'min-h-14'
      } ${
        selected
          ? 'border-[#39FF14]/70 bg-[#39FF14]/14 text-white shadow-[0_0_24px_rgba(57,255,20,0.14)]'
          : disabled
            ? 'border-white/5 bg-white/[0.02] text-white/20'
            : 'border-white/10 bg-white/[0.04] text-white hover:border-[#39FF14]/50 hover:bg-[#39FF14]/10 hover:text-[#d8ffd0]'
      }`}
    >
      {label}
    </button>
  );
}

function SnapshotEntryScreen({
  onStart,
}: {
  onStart: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-center text-center">
      <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Live Session</p>
      <h2 className="mx-auto mt-5 max-w-sm text-2xl font-black leading-[1.12] tracking-[-0.04em] text-white">
        You are now part of the system.
      </h2>
      <p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-white/58">
        This will build a live diagnostic of your store.
      </p>

      <button
        type="button"
        onClick={onStart}
        className="mt-8 flex min-h-14 w-full items-center justify-center rounded-2xl border border-[#39FF14]/55 bg-[#39FF14] px-4 py-4 text-sm font-black uppercase tracking-[0.22em] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] transition hover:scale-[1.01]"
      >
        Start
      </button>

      <p className="mt-5 text-[11px] leading-5 text-white/42">No navigation. Just synchronized check-ins.</p>
    </div>
  );
}

function SnapshotResponseCaptured({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="flex h-full flex-col justify-center text-center">
      <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Captured</p>
      <h2 className="mx-auto mt-5 max-w-sm text-2xl font-black leading-[1.14] tracking-[-0.04em] text-white">
        {title}
      </h2>
      <p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-white/58">{body}</p>
    </div>
  );
}

function SnapshotSingleSelectScreen({
  screenLabel,
  prompt,
  options,
  responseKey,
  slideId,
  screenId,
  payload,
  sessionId,
  responses,
  onSave,
}: {
  screenLabel?: string;
  prompt: string;
  options: readonly string[];
  responseKey: string;
  slideId: string;
  screenId: SnapshotScreenId;
  payload: LiveSessionPayload;
  sessionId: string;
  responses: SnapshotResponsesMap;
  onSave: (record: SnapshotResponseRecord) => void;
}) {
  const current = responses[responseKey];
  const initialSelected = typeof current?.answer === 'string' ? current.answer : '';
  const [selected, setSelected] = useState(initialSelected);

  useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelected]);

  if (current) {
    return (
      <SnapshotResponseCaptured
        title="Response captured."
        body="This selection will be included in the live room snapshot."
      />
    );
  }

  return (
    <div>
      {screenLabel ? (
        <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">{screenLabel}</p>
      ) : null}
      <h2 className="mt-4 text-[1.75rem] font-black leading-[1.06] tracking-[-0.05em] text-white">{prompt}</h2>
      <div className="mt-6 grid gap-3">
        {options.map((option) => (
          <ChoiceButton
            key={option}
            label={option}
            selected={selected === option}
            onClick={() => setSelected(option)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          if (!selected) return;
          onSave({
            userId: sessionId,
            sessionId,
            slideId,
            screenId,
            responseKey,
            slideNumber: Number.parseInt(slideId.replace('slide_', ''), 10),
            answer: selected,
            selectedValue: selected,
            answerLabel: selected,
            timestamp: new Date().toISOString(),
            deckId: payload.state.deckId,
            slideStep: payload.state.currentStep,
            currentSlide: payload.state.currentSlide,
          });
        }}
        disabled={!selected}
        className={`mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border px-4 py-4 text-sm font-black uppercase tracking-[0.22em] transition duration-200 ease-out ${
          selected
            ? 'border-[#39FF14]/55 bg-[#39FF14] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] hover:scale-[1.01]'
            : 'border-white/10 bg-white/[0.03] text-white/35'
        }`}
      >
        Continue
      </button>
    </div>
  );
}

function SnapshotMultiSelectScreen({
  screenLabel,
  prompt,
  options,
  responseKey,
  slideId,
  screenId,
  payload,
  sessionId,
  responses,
  onSave,
}: {
  screenLabel?: string;
  prompt: string;
  options: readonly string[];
  responseKey: string;
  slideId: string;
  screenId: SnapshotScreenId;
  payload: LiveSessionPayload;
  sessionId: string;
  responses: SnapshotResponsesMap;
  onSave: (record: SnapshotResponseRecord) => void;
}) {
  const current = responses[responseKey];
  const initialSelected = Array.isArray(current?.selectedValue) ? current.selectedValue : [];
  const [selected, setSelected] = useState<string[]>(initialSelected);

  useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelected.join('|')]);

  if (current) {
    return (
      <SnapshotResponseCaptured
        title="Response captured."
        body="This will be included in the live room snapshot."
      />
    );
  }

  const toggle = (option: string) => {
    setSelected((previous) =>
      previous.includes(option) ? previous.filter((item) => item !== option) : [...previous, option],
    );
  };

  const commit = () => {
    if (selected.length === 0) return;

    onSave({
      userId: sessionId,
      sessionId,
      slideId,
      screenId,
      responseKey,
      slideNumber: Number.parseInt(slideId.replace('slide_', ''), 10),
      answer: selected.join(', '),
      selectedValue: selected,
      answerLabel: selected.join(', '),
      timestamp: new Date().toISOString(),
      deckId: payload.state.deckId,
      slideStep: payload.state.currentStep,
      currentSlide: payload.state.currentSlide,
    });
  };

  return (
    <div>
      {screenLabel ? (
        <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">{screenLabel}</p>
      ) : null}
      <h2 className="mt-4 text-[1.75rem] font-black leading-[1.06] tracking-[-0.05em] text-white">{prompt}</h2>
      <div className="mt-6 grid gap-3">
        {options.map((option) => (
          <ChoiceButton
            key={option}
            label={option}
            selected={selected.includes(option)}
            onClick={() => toggle(option)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={commit}
        disabled={selected.length === 0}
        className={`mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border px-4 py-4 text-sm font-black uppercase tracking-[0.22em] transition duration-200 ease-out ${
          selected.length > 0
            ? 'border-[#39FF14]/55 bg-[#39FF14] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] hover:scale-[1.01]'
            : 'border-white/10 bg-white/[0.03] text-white/35'
        }`}
      >
        Continue
      </button>
    </div>
  );
}

function SnapshotPassiveScreen({
  slideNumber,
}: {
  slideNumber: number | null;
}) {
  return (
    <div className="flex h-full flex-col justify-center text-center">
      <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">
        {slideNumber !== null ? `Screen ${slideNumber}` : 'Synced'}
      </p>
      <h2 className="mx-auto mt-5 max-w-sm text-2xl font-black leading-[1.12] tracking-[-0.04em] text-white">
        No interaction on this slide.
      </h2>
      <p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-white/58">
        Keep this page open. The presenter will move you to the next check-in.
      </p>
    </div>
  );
}

function SnapshotProblemFramingScreen({
  payload,
  sessionId,
  responses,
  onSave,
}: {
  payload: LiveSessionPayload;
  sessionId: string;
  responses: SnapshotResponsesMap;
  onSave: (record: SnapshotResponseRecord) => void;
}) {
  const current = responses.problem_framing;

  if (current) {
    return (
      <SnapshotResponseCaptured
        title="Problem framing captured."
        body="This answer will be used in the live room snapshot."
      />
    );
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Quick Reality Check</p>
      <h2 className="mt-4 text-[1.9rem] font-black leading-[1.04] tracking-[-0.05em] text-white">
        You are now part of the system.
      </h2>
      <p className="mt-4 text-sm leading-6 text-white/58">
        This will build a live diagnostic of your store.
      </p>
      <h3 className="mt-7 text-[1.45rem] font-black leading-[1.08] tracking-[-0.04em] text-white">
        Where do you believe your biggest performance issue comes from?
      </h3>
      <div className="mt-6 grid gap-3">
        {SLIDE_1_OPTIONS.map((option) => (
          <ChoiceButton
            key={option}
            label={option}
            onClick={() =>
              onSave({
                userId: sessionId,
                sessionId,
                slideId: 'slide_01',
                screenId: 'problem_framing',
                responseKey: 'problem_framing',
                slideNumber: 1,
                answer: option,
                selectedValue: option,
                answerLabel: option,
                timestamp: new Date().toISOString(),
                deckId: payload.state.deckId,
                slideStep: payload.state.currentStep,
                currentSlide: payload.state.currentSlide,
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function SnapshotCxConsistencyScreen({
  payload,
  sessionId,
  responses,
  onSave,
  onAdvance,
}: {
  payload: LiveSessionPayload;
  sessionId: string;
  responses: SnapshotResponsesMap;
  onSave: (record: SnapshotResponseRecord) => void;
  onAdvance: () => void;
}) {
  const current = responses.cx_consistency_score;
  const initial = typeof current?.selectedValue === 'number' ? current.selectedValue : 5;
  const [value, setValue] = useState(initial);
  const [committed, setCommitted] = useState(Boolean(current));

  useEffect(() => {
    setValue(initial);
    setCommitted(Boolean(current));
  }, [initial]);

  if (responses.breakdown_point) {
    return (
      <SnapshotResponseCaptured
        title="CX consistency captured."
        body="The room has moved to the breakdown point."
      />
    );
  }

  const commitValue = (nextValue: number) => {
    setCommitted(true);
    const record: SnapshotResponseRecord = {
      userId: sessionId,
      sessionId,
      slideId: 'slide_02',
      screenId: 'cx_consistency',
      responseKey: 'cx_consistency_score',
      slideNumber: 2,
      answer: String(nextValue),
      selectedValue: nextValue,
      answerLabel: String(nextValue),
      timestamp: new Date().toISOString(),
      deckId: payload.state.deckId,
      slideStep: payload.state.currentStep,
      currentSlide: payload.state.currentSlide,
    };
    onSave(record);
    onAdvance();
  };

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Screen 2</p>
      <h2 className="mt-4 text-[1.75rem] font-black leading-[1.06] tracking-[-0.05em] text-white">{SLIDE_2_QUESTION}</h2>

      <div className="mt-7 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
        <div className="grid gap-3">
          {CX_CONSISTENCY_CHOICES.map((choice) => {
            const isSelected = value === choice.score;
            return (
              <button
                key={choice.label}
                type="button"
                onClick={() => setValue(choice.score)}
                className={`rounded-2xl border px-4 py-4 text-left transition duration-200 ease-out active:scale-[0.99] ${
                  isSelected
                    ? 'border-[#39FF14]/70 bg-[#39FF14]/14 text-white shadow-[0_0_24px_rgba(57,255,20,0.14)]'
                    : 'border-white/10 bg-white/[0.04] text-white hover:border-[#39FF14]/50 hover:bg-[#39FF14]/10 hover:text-[#d8ffd0]'
                }`}
              >
                <div className="text-base font-black leading-none tracking-[-0.03em]">{choice.label}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-white/42">{choice.range}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded-[20px] border border-white/8 bg-black/20 p-4">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/42">Current position</p>
          <p className="mt-2 text-xl font-black text-white">{value}</p>
          <p className="mt-1 text-sm leading-6 text-white/52">
            Tap the closest description, then tap Continue to lock it in.
          </p>
        </div>

        <button
          type="button"
          onClick={() => commitValue(value)}
          disabled={committed}
          className={`mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl border px-4 py-4 text-sm font-black uppercase tracking-[0.22em] transition duration-200 ease-out ${
            committed
              ? 'cursor-default border-[#39FF14]/30 bg-[#39FF14]/8 text-[#b7ffb0]'
              : 'border-[#39FF14]/55 bg-[#39FF14] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] hover:scale-[1.01]'
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function SnapshotBreakdownPointScreen({
  payload,
  sessionId,
  responses,
  onSave,
}: {
  payload: LiveSessionPayload;
  sessionId: string;
  responses: SnapshotResponsesMap;
  onSave: (record: SnapshotResponseRecord) => void;
}) {
  const current = responses.breakdown_point;
  const initialSelected = typeof current?.answer === 'string' ? current.answer : '';
  const [selected, setSelected] = useState(initialSelected);

  useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelected]);

  if (current) {
    return (
      <SnapshotResponseCaptured
        title="Breakdown point captured."
        body="This gets used in the room snapshot and final summary."
      />
    );
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Screen 3</p>
      <h2 className="mt-4 text-[1.8rem] font-black leading-[1.06] tracking-[-0.05em] text-white">What is the main breakdown point?</h2>
      <div className="mt-6 grid gap-3">
        {SLIDE_4_OPTIONS.map((option) => (
          <ChoiceButton
            key={option}
            label={option}
            selected={selected === option}
            onClick={() => setSelected(option)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          if (!selected) return;
          onSave({
            userId: sessionId,
            sessionId,
            slideId: 'slide_02',
            screenId: 'breakdown_point',
            responseKey: 'breakdown_point',
            slideNumber: 2,
            answer: selected,
            selectedValue: selected,
            answerLabel: selected,
            timestamp: new Date().toISOString(),
            deckId: payload.state.deckId,
            slideStep: payload.state.currentStep,
            currentSlide: payload.state.currentSlide,
          });
        }}
        disabled={!selected}
        className={`mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border px-4 py-4 text-sm font-black uppercase tracking-[0.22em] transition duration-200 ease-out ${
          selected
            ? 'border-[#39FF14]/55 bg-[#39FF14] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] hover:scale-[1.01]'
            : 'border-white/10 bg-white/[0.03] text-white/35'
        }`}
      >
        Continue
      </button>
    </div>
  );
}

function SnapshotInsightBreakScreen({
  sessionId,
  payload,
  onSave,
}: {
  sessionId: string;
  payload: LiveSessionPayload;
  onSave: (record: SnapshotResponseRecord) => void;
}) {
  return (
    <div className="flex h-full flex-col justify-center text-center">
      <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Screen 4</p>
      <h2 className="mx-auto mt-5 max-w-sm text-2xl font-black leading-[1.14] tracking-[-0.04em] text-white">
        Training creates awareness.
        <br />
        Systems create behavior.
      </h2>
      <button
        type="button"
        onClick={() =>
          onSave({
            userId: sessionId,
            sessionId,
            slideId: 'slide_03',
            screenId: 'insight_break',
            responseKey: 'insight_break_ack',
            slideNumber: 3,
            answer: 'That hits',
            selectedValue: 'ack',
            answerLabel: 'That hits',
            timestamp: new Date().toISOString(),
            deckId: payload.state.deckId,
            slideStep: payload.state.currentStep,
            currentSlide: payload.state.currentSlide,
          })
        }
        className="mt-8 flex min-h-14 w-full items-center justify-center rounded-2xl border border-[#39FF14]/55 bg-[#39FF14] px-4 py-4 text-sm font-black uppercase tracking-[0.22em] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] transition hover:scale-[1.01]"
      >
        That hits
      </button>
    </div>
  );
}

function SnapshotSystemRealityScreen({
  payload,
  sessionId,
  responses,
  onSave,
}: {
  payload: LiveSessionPayload;
  sessionId: string;
  responses: SnapshotResponsesMap;
  onSave: (record: SnapshotResponseRecord) => void;
}) {
  const current = responses.system_presence;
  const initialSelected = Array.isArray(current?.selectedValue) ? current.selectedValue : [];
  const [selected, setSelected] = useState<string[]>(initialSelected);

  useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelected.join('|')]);

  if (current) {
    return (
      <SnapshotResponseCaptured
        title="System reality captured."
        body="The room snapshot now knows what exists and what does not."
      />
    );
  }

  const toggleOption = (option: string) => {
    setSelected((previous) => {
      if (option === 'None of this exists') {
        return previous.includes('None of this exists') ? [] : ['None of this exists'];
      }

      const withoutExclusive = previous.filter((item) => item !== 'None of this exists');
      return withoutExclusive.includes(option)
        ? withoutExclusive.filter((item) => item !== option)
        : [...withoutExclusive, option];
    });
  };

  const commit = () => {
    if (selected.length === 0) return;

    onSave({
      userId: sessionId,
      sessionId,
      slideId: 'slide_04',
      screenId: 'system_reality',
      responseKey: 'system_presence',
      slideNumber: 4,
      answer: selected.join(', '),
      selectedValue: selected,
      answerLabel: selected.join(', '),
      timestamp: new Date().toISOString(),
      deckId: payload.state.deckId,
      slideStep: payload.state.currentStep,
      currentSlide: payload.state.currentSlide,
    });
  };

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Screen 5</p>
      <h2 className="mt-4 text-[1.8rem] font-black leading-[1.06] tracking-[-0.05em] text-white">
        What already exists in your store?
      </h2>
      <div className="mt-6 grid gap-3">
        {['We can diagnose issues clearly', 'Managers follow action plans', 'We execute weekly', 'None of this exists'].map((option) => {
          const isSelected = selected.includes(option);
          const disabled = option === 'None of this exists' && selected.length > 0 && !isSelected;
          return (
            <ChoiceButton
              key={option}
              label={option}
              selected={isSelected}
              disabled={disabled}
              onClick={() => toggleOption(option)}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={commit}
        disabled={selected.length === 0}
        className={`mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border px-4 py-4 text-sm font-black uppercase tracking-[0.22em] transition duration-200 ease-out ${
          selected.length > 0
            ? 'border-[#39FF14]/55 bg-[#39FF14] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] hover:scale-[1.01]'
            : 'border-white/10 bg-white/[0.03] text-white/35'
        }`}
      >
        Continue
      </button>
    </div>
  );
}

function SnapshotManagerCoachingScreen({
  payload,
  sessionId,
  responses,
  onSave,
}: {
  payload: LiveSessionPayload;
  sessionId: string;
  responses: SnapshotResponsesMap;
  onSave: (record: SnapshotResponseRecord) => void;
}) {
  const current = responses.manager_coaching_frequency;
  const initialSelected = typeof current?.answer === 'string' ? current.answer : '';
  const [selected, setSelected] = useState(initialSelected);

  useEffect(() => {
    setSelected(initialSelected);
  }, [initialSelected]);

  if (current) {
    return (
      <SnapshotResponseCaptured
        title="Manager coaching frequency captured."
        body="This answer is included in the live room snapshot."
      />
    );
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Screen 6</p>
      <h2 className="mt-4 text-[1.85rem] font-black leading-[1.06] tracking-[-0.05em] text-white">
        How often are your managers coached on execution?
      </h2>
      <div className="mt-6 grid gap-3">
        {SLIDE_6_OPTIONS.map((option) => (
          <ChoiceButton
            key={option}
            label={option}
            selected={selected === option}
            onClick={() => setSelected(option)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          if (!selected) return;
          onSave({
            userId: sessionId,
            sessionId,
            slideId: 'slide_06',
            screenId: 'manager_coaching',
            responseKey: 'manager_coaching_frequency',
            slideNumber: 6,
            answer: selected,
            selectedValue: selected,
            answerLabel: selected,
            timestamp: new Date().toISOString(),
            deckId: payload.state.deckId,
            slideStep: payload.state.currentStep,
            currentSlide: payload.state.currentSlide,
          });
        }}
        disabled={!selected}
        className={`mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border px-4 py-4 text-sm font-black uppercase tracking-[0.22em] transition duration-200 ease-out ${
          selected
            ? 'border-[#39FF14]/55 bg-[#39FF14] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] hover:scale-[1.01]'
            : 'border-white/10 bg-white/[0.03] text-white/35'
        }`}
      >
        Continue
      </button>
    </div>
  );
}

function SnapshotBusinessImpactScreen({
  payload,
  sessionId,
  responses,
  onSave,
}: {
  payload: LiveSessionPayload;
  sessionId: string;
  responses: SnapshotResponsesMap;
  onSave: (record: SnapshotResponseRecord) => void;
}) {
  const current = responses.business_impact?.selectedValue;
  const parsed = current && typeof current === 'object' && !Array.isArray(current) ? (current as BusinessImpactSelection) : null;
  const [selectedSignals, setSelectedSignals] = useState<string[]>(parsed?.business_pain_signals ?? []);
  const [frequency, setFrequency] = useState<string>(parsed?.pain_frequency ?? '');
  const [captured, setCaptured] = useState(Boolean(parsed?.pain_frequency));

  useEffect(() => {
    setSelectedSignals(parsed?.business_pain_signals ?? []);
    setFrequency(parsed?.pain_frequency ?? '');
    setCaptured(Boolean(parsed?.pain_frequency));
  }, [parsed?.business_pain_signals, parsed?.pain_frequency]);

  if (responses.business_impact && parsed?.pain_frequency) {
    return (
      <SnapshotResponseCaptured
        title="Business impact captured."
        body="This becomes part of the live store snapshot and summary."
      />
    );
  }

  const toggleSignal = (option: string) => {
    setCaptured(false);
    setSelectedSignals((previous) =>
      previous.includes(option) ? previous.filter((item) => item !== option) : [...previous, option],
    );
  };

  const commit = (nextFrequency: string) => {
    const nextValue: BusinessImpactSelection = {
      business_pain_signals: selectedSignals,
      pain_frequency: nextFrequency,
    };

    onSave({
      userId: sessionId,
      sessionId,
      slideId: 'slide_08',
      screenId: 'business_impact',
      responseKey: 'business_impact',
      slideNumber: 8,
      answer: `${selectedSignals.join(', ')} | ${nextFrequency}`,
      selectedValue: nextValue,
      answerLabel: nextFrequency,
      timestamp: new Date().toISOString(),
      deckId: payload.state.deckId,
      slideStep: payload.state.currentStep,
      currentSlide: payload.state.currentSlide,
    });
    setCaptured(true);
  };

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Screen 7</p>
      <h2 className="mt-4 text-[1.8rem] font-black leading-[1.06] tracking-[-0.05em] text-white">
        Where do you feel it most?
      </h2>
      <div className="mt-6 grid gap-3">
        {BUSINESS_PAIN_OPTIONS.map((option) => (
          <ChoiceButton
            key={option}
            label={option}
            selected={selectedSignals.includes(option)}
            onClick={() => toggleSignal(option)}
          />
        ))}
      </div>

      {selectedSignals.length > 0 ? (
        <div className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-[0.28em] text-white/46">How often does this show up?</p>
          <div className="mt-4 grid gap-3">
            {PAIN_FREQUENCY_OPTIONS.map((option) => (
              <ChoiceButton
                key={option}
                label={option}
                compact
                selected={frequency === option}
                onClick={() => {
                  setFrequency(option);
                  commit(option);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {captured ? (
        <p className="mt-5 text-sm text-white/52">Response captured. It will appear in the final snapshot.</p>
      ) : null}
    </div>
  );
}

function SnapshotVisionGapScreen({
  payload,
  sessionId,
  responses,
  onSave,
}: {
  payload: LiveSessionPayload;
  sessionId: string;
  responses: SnapshotResponsesMap;
  onSave: (record: SnapshotResponseRecord) => void;
}) {
  const current = responses.vision_gap_score;
  const initial = typeof current?.selectedValue === 'number' ? current.selectedValue : 6;
  const [value, setValue] = useState(initial);
  const [committed, setCommitted] = useState(Boolean(current));

  useEffect(() => {
    setValue(initial);
    setCommitted(Boolean(current));
  }, [initial]);

  if (current) {
    return (
      <SnapshotResponseCaptured
        title="Vision gap captured."
        body="The live snapshot now knows how locked in the store feels."
      />
    );
  }

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Screen 8</p>
      <h2 className="mt-4 text-[1.8rem] font-black leading-[1.06] tracking-[-0.05em] text-white">
        How far are you from the store you want?
      </h2>

      <div className="mt-7 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={(event) => {
            const nextValue = Number.parseInt(event.target.value, 10);
            setValue(nextValue);
          }}
          className="w-full accent-[#39FF14]"
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          {VISION_GAP_LABELS.map((label) => (
            <span key={label} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/46">
              {label}
            </span>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            if (committed) return;
            setCommitted(true);
            onSave({
              userId: sessionId,
              sessionId,
              slideId: 'slide_12',
              screenId: 'vision_gap',
              responseKey: 'vision_gap_score',
              slideNumber: 12,
              answer: String(value),
              selectedValue: value,
              answerLabel: String(value),
              timestamp: new Date().toISOString(),
              deckId: payload.state.deckId,
              slideStep: payload.state.currentStep,
              currentSlide: payload.state.currentSlide,
            });
          }}
          disabled={committed}
          className={`mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl border px-4 py-4 text-sm font-black uppercase tracking-[0.22em] transition duration-200 ease-out ${
            committed
              ? 'cursor-default border-[#39FF14]/30 bg-[#39FF14]/8 text-[#b7ffb0]'
              : 'border-[#39FF14]/55 bg-[#39FF14] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] hover:scale-[1.01]'
          }`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function SnapshotHowThisActuallyRunsScreen({
  payload,
  sessionId,
  responses,
  onSave,
}: {
  payload: LiveSessionPayload;
  sessionId: string;
  responses: SnapshotResponsesMap;
  onSave: (record: SnapshotResponseRecord) => void;
}) {
  const current = responses.slide_15_reflection;
  const [selected, setSelected] = useState(typeof current?.answer === 'string' ? current.answer : '');

  useEffect(() => {
    setSelected(typeof current?.answer === 'string' ? current.answer : '');
  }, [current?.answer]);

  if (current) {
    return (
      <SnapshotResponseCaptured
        title="Reflection captured."
        body="This will feed the operational close and recap."
      />
    );
  }

  const sections = [
    {
      label: 'Weekly Reality',
      body: 'Every week:\n• One behavior is identified\n• One plan is deployed\n• Managers lead execution',
    },
    {
      label: 'Daily Reality',
      body: 'Every day:\n• AutoKnerd coaches behavior in real time\n• CX data is captured and updated automatically\n• The system reinforces culture through consistent interaction\n• Each user is continuously trained against their weakest CX trait',
    },
    {
      label: 'What changes',
      body: 'WHAT CHANGES\n\n• Culture becomes consistent, not dependent on the day or the person\n• CSI stabilizes and starts trending up\n• Promoter behavior becomes repeatable, not random\n• Customers feel the difference immediately\n• Your store stops blending in with everyone else',
    },
  ] as const;

  return (
    <div className="flex h-full flex-col">
      <div>
        <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Slide 15</p>
        <h2 className="mt-4 text-[1.6rem] font-black leading-[1.08] tracking-[-0.05em] text-white">
          This is how your store would actually run.
        </h2>
        <p className="mt-3 text-sm leading-6 text-white/58">
          A simple operational translation of the weekly rhythm.
        </p>
      </div>

      <div className="mt-5 space-y-3">
        {sections.map((section) => (
          <section key={section.label} className="rounded-[20px] border border-white/8 bg-white/[0.04] p-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8eff71]">{section.label}</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-6 text-white/82">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-5 rounded-[22px] border border-[#39FF14]/18 bg-[#39FF14]/8 p-4">
        <p className="text-[10px] uppercase tracking-[0.28em] text-[#8eff71]">What would be hardest to implement in your store?</p>
        <div className="mt-4 grid gap-2">
          {SLIDE_15_OPTIONS.map((option) => (
            <ChoiceButton
              key={option}
              label={option}
              compact
              selected={selected === option}
              onClick={() => {
                setSelected(option);
                onSave({
                  userId: sessionId,
                  sessionId,
                  slideId: 'slide_15',
                  screenId: 'slide15_reflection',
                  responseKey: 'slide_15_reflection',
                  slideNumber: 15,
                  answer: option,
                  selectedValue: option,
                  answerLabel: option,
                  timestamp: new Date().toISOString(),
                  deckId: payload.state.deckId,
                  slideStep: payload.state.currentStep,
                  currentSlide: payload.state.currentSlide,
                });
              }}
            />
          ))}
        </div>
      </div>

      <p className="mt-4 text-center text-xs leading-5 text-white/48">One tap. Then the room carries on.</p>
    </div>
  );
}

function SprocketClosingOverlay({
  open,
  payload,
  sessionId,
  responses,
  onSave,
  onDismiss,
}: {
  open: boolean;
  payload: LiveSessionPayload;
  sessionId: string;
  responses: SnapshotResponsesMap;
  onSave: (record: SnapshotResponseRecord) => void;
  onDismiss: () => void;
}) {
  const snapshot = useMemo(() => buildSnapshotStatus(responses), [responses]);
  const focus = useMemo(() => getSprocketClosingFocus(snapshot, responses), [responses, snapshot]);
  const openingLines = useMemo(() => buildSprocketOpeningLines(snapshot), [snapshot]);
  const question = useMemo(() => getSprocketQuestionConfig(focus), [focus]);
  const existingContact = responses.contact_info?.selectedValue;
  const contactInfo =
    existingContact && typeof existingContact === 'object' && !Array.isArray(existingContact)
      ? (existingContact as ContactInfoSelection)
      : null;
  const [phase, setPhase] = useState<SprocketClosingPhase>('opening');
  const [questionAnswer, setQuestionAnswer] = useState('');
  const [scenarioAnswer, setScenarioAnswer] = useState<SprocketScenarioAnswer | null>(null);
  const [email, setEmail] = useState(contactInfo?.email ?? '');
  const [storeName, setStoreName] = useState(contactInfo?.dealership ?? '');
  const [closingVisible, setClosingVisible] = useState(true);

  useEffect(() => {
    if (!open) return;

    setPhase('opening');
    setQuestionAnswer('');
    setScenarioAnswer(null);
    setEmail(contactInfo?.email ?? '');
    setStoreName(contactInfo?.dealership ?? '');
    setClosingVisible(false);
    const frame = window.requestAnimationFrame(() => setClosingVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  const respondAndAdvance = (nextPhase: SprocketClosingPhase) => {
    setPhase(nextPhase);
  };

  const persistLeadCapture = (answerKey: 'contact_info' | 'contact_info_skip', emailValue?: string) => {
    if (answerKey === 'contact_info' && !emailValue) return;

    if (answerKey === 'contact_info') {
      const nextValue: ContactInfoSelection = {
        email: (emailValue || '').trim(),
        name: '',
        dealership: storeName.trim(),
      };

      onSave({
        userId: sessionId,
        sessionId,
        slideId: 'slide_14',
        screenId: 'sprocket_closing_capture',
        responseKey: 'contact_info',
        slideNumber: 14,
        answer: nextValue.email,
        selectedValue: nextValue,
        answerLabel: nextValue.email,
        timestamp: new Date().toISOString(),
        deckId: payload.state.deckId,
        slideStep: payload.state.currentStep,
        currentSlide: payload.state.currentSlide,
      });
      return;
    }

    onSave({
      userId: sessionId,
      sessionId,
      slideId: 'slide_14',
      screenId: 'sprocket_closing_capture',
      responseKey: 'contact_info_skip',
      slideNumber: 14,
      answer: 'Skip for now',
      selectedValue: 'skip',
      answerLabel: 'Skip for now',
      timestamp: new Date().toISOString(),
      deckId: payload.state.deckId,
      slideStep: payload.state.currentStep,
      currentSlide: payload.state.currentSlide,
    });
  };

  const questionButtons = question.options.map((option) => {
    const isSelected = questionAnswer === option;
    return (
      <ChoiceButton
        key={option}
        label={option}
        selected={isSelected}
        onClick={() => setQuestionAnswer(option)}
      />
    );
  });

  const scenarioOptions: SprocketScenarioAnswer[] = [
    'Address it immediately',
    'Wait and see if it improves',
    'Mention it later in passing',
    'Ignore it',
  ];
  const scenarioOutcome = scenarioAnswer ? getSprocketScenarioOutcome(scenarioAnswer) : null;

  const renderPhase = () => {
    switch (phase) {
      case 'opening':
        return (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-[#39FF14]/28 bg-[#39FF14]/10 shadow-[0_0_34px_rgba(57,255,20,0.24)]">
                  <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(57,255,20,0.20),transparent_68%)]" />
                  <Image
                    src="/gear-glasses-v2.png"
                    alt="Sprocket avatar"
                    width={88}
                    height={88}
                    className="relative z-10 h-20 w-20 object-contain drop-shadow-[0_0_14px_rgba(57,255,20,0.28)]"
                    priority={false}
                  />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Sprocket</p>
                  <h2 className="mt-1 text-xl font-black tracking-[-0.04em] text-white">I&apos;m looking at the room snapshot.</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/58 transition hover:border-white/18 hover:text-white/82"
              >
                Close
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#39FF14]/28 bg-[#39FF14]/8 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[#d7ffc8] shadow-[0_0_18px_rgba(57,255,20,0.08)]">
                CX: {snapshot.consistencyStatus}
              </span>
              <span className="rounded-full border border-[#39FF14]/28 bg-[#39FF14]/8 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[#d7ffc8] shadow-[0_0_18px_rgba(57,255,20,0.08)]">
                Leadership: {snapshot.leadershipStatus}
              </span>
              <span className="rounded-full border border-[#39FF14]/28 bg-[#39FF14]/8 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-[#d7ffc8] shadow-[0_0_18px_rgba(57,255,20,0.08)]">
                System: {snapshot.systemStatus}
              </span>
            </div>

            <div className="mt-7 flex-1 space-y-4">
              {openingLines.map((line, index) => (
                <p
                  key={`${line.text}-${index}`}
                  className={`text-[1.55rem] leading-[1.15] tracking-[-0.05em] text-white ${line.emphasis ? 'font-black' : 'font-semibold text-white/88'}`}
                >
                  {line.text}
                </p>
              ))}
            </div>

            <button
              type="button"
              onClick={() => respondAndAdvance('question')}
              className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl border border-[#39FF14]/55 bg-[#39FF14] px-4 py-4 text-sm font-black uppercase tracking-[0.22em] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] transition hover:scale-[1.01]"
            >
              Continue
            </button>
          </div>
        );

      case 'question':
        return (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Sprocket asks</p>
                <h2 className="mt-3 text-[1.7rem] font-black leading-[1.06] tracking-[-0.05em] text-white">{question.prompt}</h2>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/58 transition hover:border-white/18 hover:text-white/82"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-3">{questionButtons}</div>

            <button
              type="button"
              onClick={() => {
                if (!questionAnswer) return;
                onSave({
                  userId: sessionId,
                  sessionId,
                  slideId: 'slide_14',
                  screenId: 'sprocket_closing_question',
                  responseKey: question.responseKey,
                  slideNumber: 14,
                  answer: questionAnswer,
                  selectedValue: questionAnswer,
                  answerLabel: questionAnswer,
                  timestamp: new Date().toISOString(),
                  deckId: payload.state.deckId,
                  slideStep: payload.state.currentStep,
                  currentSlide: payload.state.currentSlide,
                });
                respondAndAdvance('scenario');
              }}
              disabled={!questionAnswer}
              className={`mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border px-4 py-4 text-sm font-black uppercase tracking-[0.22em] transition duration-200 ease-out ${
                questionAnswer
                  ? 'border-[#39FF14]/55 bg-[#39FF14] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] hover:scale-[1.01]'
                  : 'border-white/10 bg-white/[0.03] text-white/35'
              }`}
            >
              Continue
            </button>
          </div>
        );

      case 'scenario':
        return (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Micro scenario</p>
                <h2 className="mt-3 text-[1.7rem] font-black leading-[1.06] tracking-[-0.05em] text-white">
                  Manager notices a breakdown in a customer interaction.
                </h2>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/58 transition hover:border-white/18 hover:text-white/82"
              >
                Close
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-white/58">What happens next?</p>

            <div className="mt-6 grid gap-3">
              {scenarioOptions.map((option) => (
                <ChoiceButton
                  key={option}
                  label={option}
                  selected={scenarioAnswer === option}
                  onClick={() => setScenarioAnswer(option)}
                />
              ))}
            </div>

            {scenarioOutcome ? (
              <div className="mt-6 rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-white/42">{scenarioOutcome.label}</p>
                <p className="mt-2 text-xl font-black leading-[1.08] tracking-[-0.04em] text-white">{scenarioOutcome.body}</p>
              </div>
            ) : (
              <p className="mt-6 text-sm leading-6 text-white/42">Choose the response that feels most familiar.</p>
            )}

            <button
              type="button"
              onClick={() => {
                if (!scenarioAnswer) return;
                onSave({
                  userId: sessionId,
                  sessionId,
                  slideId: 'slide_14',
                  screenId: 'sprocket_closing_scenario',
                  responseKey: 'sprocket_scenario',
                  slideNumber: 14,
                  answer: scenarioAnswer,
                  selectedValue: scenarioAnswer,
                  answerLabel: scenarioAnswer,
                  timestamp: new Date().toISOString(),
                  deckId: payload.state.deckId,
                  slideStep: payload.state.currentStep,
                  currentSlide: payload.state.currentSlide,
                });
                respondAndAdvance('insight');
              }}
              disabled={!scenarioAnswer}
              className={`mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border px-4 py-4 text-sm font-black uppercase tracking-[0.22em] transition duration-200 ease-out ${
                scenarioAnswer
                  ? 'border-[#39FF14]/55 bg-[#39FF14] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] hover:scale-[1.01]'
                  : 'border-white/10 bg-white/[0.03] text-white/35'
              }`}
            >
              Continue
            </button>
          </div>
        );

      case 'insight':
        return (
          <div className="flex h-full flex-col justify-center">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Sprocket</p>
                <h2 className="mt-3 text-[1.72rem] font-black leading-[1.06] tracking-[-0.05em] text-white">See what just happened?</h2>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/58 transition hover:border-white/18 hover:text-white/82"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-3">
              <p className="text-[1.35rem] font-black leading-[1.15] tracking-[-0.04em] text-white">This isn&apos;t about talent.</p>
              <p className="text-[1.35rem] font-black leading-[1.15] tracking-[-0.04em] text-white">It&apos;s about consistent guidance.</p>
              <div className="rounded-[22px] border border-[#39FF14]/18 bg-[#39FF14]/8 p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#8eff71]">{scenarioOutcome.label}</p>
                <p className="mt-2 text-lg font-semibold leading-7 text-white">{scenarioOutcome.body}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => respondAndAdvance('capture')}
              className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border border-[#39FF14]/55 bg-[#39FF14] px-4 py-4 text-sm font-black uppercase tracking-[0.22em] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] transition hover:scale-[1.01]"
            >
              Continue
            </button>
          </div>
        );

      case 'capture':
        return (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">Want me to build this for your store?</p>
                <h2 className="mt-3 text-[1.72rem] font-black leading-[1.06] tracking-[-0.05em] text-white">Let&apos;s turn this into a plan.</h2>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/58 transition hover:border-white/18 hover:text-white/82"
              >
                Close
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-white/58">No spam. Just your plan and snapshot.</p>

            <div className="mt-6 grid gap-3">
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                className="min-h-14 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-base text-white outline-none placeholder:text-white/28 focus:border-[#39FF14]/55"
                inputMode="email"
                type="email"
              />
              <input
                value={storeName}
                onChange={(event) => setStoreName(event.target.value)}
                placeholder="Store name (optional)"
                className="min-h-14 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-base text-white outline-none placeholder:text-white/28 focus:border-[#39FF14]/55"
                type="text"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!email.trim()) return;
                persistLeadCapture('contact_info', email);
                respondAndAdvance('week1');
              }}
              disabled={!email.trim()}
              className={`mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border px-4 py-4 text-sm font-black uppercase tracking-[0.22em] transition duration-200 ease-out ${
                email.trim()
                  ? 'border-[#39FF14]/55 bg-[#39FF14] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] hover:scale-[1.01]'
                  : 'border-white/10 bg-white/[0.03] text-white/35'
              }`}
            >
              Build My Plan
            </button>

            <button
              type="button"
              onClick={() => {
                persistLeadCapture('contact_info_skip');
                respondAndAdvance('week1');
              }}
              className="mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/58 transition hover:border-white/18 hover:text-white/72"
            >
              Skip for now
            </button>
          </div>
        );

      case 'week1':
        return (
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">AutoForge week 1</p>
                <h2 className="mt-3 text-[1.7rem] font-black leading-[1.06] tracking-[-0.05em] text-white">
                  Week 1: System install + cadence launch
                </h2>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/58 transition hover:border-white/18 hover:text-white/82"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <section className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#8eff71]">What happens immediately</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-white/82">
                  <li>• Management alignment session</li>
                  <li>• Behavior standards defined</li>
                  <li>• AutoForge deployed across departments</li>
                  <li>• Daily execution rhythm activated</li>
                </ul>
              </section>

              <section className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#8eff71]">What managers do daily</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-white/82">
                  <li>• 5–10 minute behavior check-ins</li>
                  <li>• Observe and log real interactions</li>
                  <li>• Use system-guided coaching prompts</li>
                  <li>• Reinforce one focus behavior daily</li>
                </ul>
              </section>

              <section className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#8eff71]">End-of-week outcome</p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-white/82">
                  <li>• Managers shift from reactive to proactive</li>
                  <li>• Clear behavioral expectations</li>
                  <li>• Visible execution patterns</li>
                </ul>
              </section>
            </div>

            <div className="mt-6 rounded-[24px] border border-[#39FF14]/18 bg-[#39FF14]/8 p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-[#8eff71]">Sprocket</p>
              <p className="mt-2 text-[1.18rem] font-black leading-[1.15] tracking-[-0.04em] text-white">
                This is what&apos;s missing.
                <br />
                This is how you fix it.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                onSave({
                  userId: sessionId,
                  sessionId,
                  slideId: 'slide_14',
                  screenId: 'sprocket_closing_week1',
                  responseKey: 'final_cta',
                  slideNumber: 14,
                  answer: 'LET’S RUN A PILOT',
                  selectedValue: 'let_s_run_a_pilot',
                  answerLabel: 'LET’S RUN A PILOT',
                  timestamp: new Date().toISOString(),
                  deckId: payload.state.deckId,
                  slideStep: payload.state.currentStep,
                  currentSlide: payload.state.currentSlide,
                });
                setSprocketSeen(payload.state.sessionToken);
                onDismiss();
              }}
              className="mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl border border-[#39FF14]/55 bg-[#39FF14] px-4 py-4 text-sm font-black uppercase tracking-[0.22em] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] transition hover:scale-[1.01]"
            >
              LET’S RUN A PILOT
            </button>
            <p className="mt-3 text-center text-xs leading-5 text-white/48">Deployment starts in under 14 days.</p>
          </div>
        );
    }
  };

  return (
    <div className={`fixed inset-0 z-[80] flex items-center justify-center bg-black/92 px-4 py-4 backdrop-blur-xl transition-opacity duration-300 ${closingVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="relative flex h-[calc(100vh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#050505] shadow-[0_30px_120px_rgba(0,0,0,0.68)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-[radial-gradient(circle_at_top,rgba(57,255,20,0.18),transparent_48%)]" />
        <div className="relative flex-1 overflow-y-auto px-5 pb-6 pt-5">
          {renderPhase()}
        </div>
      </div>
    </div>
  );
}

function SnapshotFinalOutputScreen({
  payload,
  sessionId,
  responses,
  onSave,
}: {
  payload: LiveSessionPayload;
  sessionId: string;
  responses: SnapshotResponsesMap;
  onSave: (record: SnapshotResponseRecord) => void;
}) {
  const snapshot = useMemo(() => buildSnapshotStatus(responses), [responses]);
  const [ctaClicked, setCtaClicked] = useState(Boolean(responses.final_cta));

  useEffect(() => {
    setCtaClicked(Boolean(responses.final_cta));
  }, [responses.final_cta]);

  return (
    <div className="flex h-full flex-col">
      <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
              <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">LIVE STORE SNAPSHOT</p>

        <div className="mt-5 grid gap-3">
          <div className="rounded-[20px] border border-white/8 bg-black/30 p-4">
            <p className="text-[10px] uppercase tracking-[0.26em] text-white/42">CX Consistency</p>
            <p className="mt-2 text-lg font-black text-white">{snapshot.consistencyStatus}</p>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-black/30 p-4">
            <p className="text-[10px] uppercase tracking-[0.26em] text-white/42">Leadership</p>
            <p className="mt-2 text-lg font-black text-white">{snapshot.leadershipStatus}</p>
          </div>
          <div className="rounded-[20px] border border-white/8 bg-black/30 p-4">
            <p className="text-[10px] uppercase tracking-[0.26em] text-white/42">System</p>
            <p className="mt-2 text-lg font-black text-white">{snapshot.systemStatus}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-[0.26em] text-[#8eff71]">Diagnosis</p>
          <p className="mt-3 text-[1.1rem] font-semibold leading-7 text-white">
            Your store is not struggling because people don’t care.
            <br />
            <br />
            It’s struggling because behavior is not being guided consistently.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-[0.26em] text-[#8eff71]">Impact</p>
          <p className="mt-3 text-base leading-7 text-white/78">
            This leads to inconsistent experiences, more objections, and managers reacting instead of leading.
          </p>
        </div>

        <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
          <p className="text-[10px] uppercase tracking-[0.26em] text-[#8eff71]">Next Step</p>
          <p className="mt-3 text-base leading-7 text-white/78">
            This is not a training problem. It is a control problem. The next step is installing a system your managers can run weekly.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <button
          type="button"
          onClick={() => {
            setCtaClicked(true);
            onSave({
              userId: sessionId,
              sessionId,
              slideId: 'slide_14',
              screenId: 'final_output',
              responseKey: 'final_cta',
              slideNumber: 14,
              answer: 'See This In Your Store',
              selectedValue: 'see_this_in_your_store',
              answerLabel: 'See This In Your Store',
              timestamp: new Date().toISOString(),
              deckId: payload.state.deckId,
              slideStep: payload.state.currentStep,
              currentSlide: payload.state.currentSlide,
            });
          }}
          className="flex min-h-14 w-full items-center justify-center rounded-2xl border border-[#39FF14]/55 bg-[#39FF14] px-4 py-4 text-sm font-black uppercase tracking-[0.22em] text-[#071003] shadow-[0_14px_40px_rgba(57,255,20,0.22)] transition hover:scale-[1.01]"
        >
          LET’S RUN A PILOT
        </button>
        <p className="mt-3 text-center text-xs leading-5 text-white/48">Deployment starts in under 14 days.</p>
        {ctaClicked ? <p className="mt-3 text-center text-sm text-white/62">Captured. Your snapshot is ready.</p> : null}
      </div>
    </div>
  );
}

export function AutoKnerdLiveSnapshot({
  payload,
  status,
}: {
  payload: LiveSessionPayload;
  status: SnapshotStatus;
}) {
  const slideKey = normalizeSlideKey(payload.state.currentStep);
  const slideNumber = parseSlideNumber(payload.state.currentStep);
  const [responses, setResponses] = useState<SnapshotResponsesMap>(() => loadResponses(payload.state.sessionToken));
  const [sessionId, setSessionId] = useState('');
  const [screenIndex, setScreenIndex] = useState(0);
  const [contentVisible, setContentVisible] = useState(true);
  const [showSprocketClosing, setShowSprocketClosing] = useState(false);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  useEffect(() => {
    setResponses(loadResponses(payload.state.sessionToken));
  }, [payload.state.sessionToken]);

  useEffect(() => {
    if (!slideKey) return;
    setScreenIndex(getInitialScreenIndex(slideKey, responses));
  }, [slideKey, responses]);

  useEffect(() => {
    setContentVisible(false);
    const frame = window.requestAnimationFrame(() => setContentVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [slideKey, screenIndex]);

  useEffect(() => {
    if (slideKey !== 'slide14') {
      setShowSprocketClosing(false);
      return;
    }

    if (responses.final_cta || getSprocketSeen(payload.state.sessionToken)) {
      setShowSprocketClosing(false);
      return;
    }

    const timer = window.setTimeout(() => {
      if (!getSprocketSeen(payload.state.sessionToken)) {
        setShowSprocketClosing(true);
      }
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [payload.state.sessionToken, responses.final_cta, slideKey]);

  const saveResponse = (record: SnapshotResponseRecord) => {
    const resolvedRecord = {
      ...record,
      sessionToken: payload.state.sessionToken,
    };

    setResponses((previous) => {
      const next = { ...previous, [resolvedRecord.responseKey]: resolvedRecord };
      persistResponses(payload.state.sessionToken, next);
      return next;
    });
    sendAudienceResponse(resolvedRecord);
  };

  const advanceScreen = () => {
    if (!slideKey) return;
    const maxIndex = SNAPSHOT_FLOW[slideKey].length - 1;
    setScreenIndex((previous) => Math.min(previous + 1, maxIndex));
  };

  if (!slideKey) {
    return (
      <div className="flex min-h-screen flex-col bg-[#050505] text-white">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-8 pt-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.34em] text-[#8eff71]">AutoKnerd Live Snapshot v1</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-white">{payload.deckTitle}</h1>
              <p className="mt-2 text-[10px] uppercase tracking-[0.28em] text-white/36">
                {slideNumber !== null ? `Screen ${slideNumber}` : 'Synced'}
              </p>
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
          <section className="flex-1 rounded-[28px] border border-white/8 bg-white/[0.035] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
            <SnapshotPassiveScreen slideNumber={slideNumber} />
          </section>
        </div>
      </div>
    );
  }

  const currentStepLabel =
    slideNumber !== null ? `Slide ${slideNumber}` : payload.state.currentStep.toUpperCase();
  const content = resolveSlideContent(slideKey, payload, sessionId, responses, saveResponse, advanceScreen);

  const showContent = contentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3';

  return (
    <div className="flex min-h-screen flex-col bg-[#050505] text-white">
      <div className={`transition-all duration-300 ease-out ${showContent}`}>
        <SlideShell payload={payload} status={status} slideLabel={currentStepLabel}>
          {content}
        </SlideShell>
      </div>
      <SprocketClosingOverlay
        open={slideKey === 'slide14' && showSprocketClosing}
        payload={payload}
        sessionId={sessionId}
        responses={responses}
        onSave={saveResponse}
        onDismiss={() => {
          setSprocketSeen(payload.state.sessionToken);
          setShowSprocketClosing(false);
        }}
      />
    </div>
  );
}

function resolveSlideContent(
  slideKey: SnapshotSlideKey,
  payload: LiveSessionPayload,
  sessionId: string,
  responses: SnapshotResponsesMap,
  saveResponse: (record: SnapshotResponseRecord) => void,
  advanceScreen: () => void,
) {
  switch (slideKey) {
    case 'slide1':
      return (
        <SnapshotProblemFramingScreen
          payload={payload}
          sessionId={sessionId}
          responses={responses}
          onSave={saveResponse}
        />
      );
    case 'slide2':
      return screenIndexToSlide2Content(payload, sessionId, responses, saveResponse, advanceScreen);
    case 'slide3':
      return (
        <SnapshotInsightBreakScreen
          sessionId={sessionId}
          payload={payload}
          onSave={(record) => {
            saveResponse(record);
          }}
        />
      );
    case 'slide4':
      return (
        <SnapshotSystemRealityScreen
          payload={payload}
          sessionId={sessionId}
          responses={responses}
          onSave={(record) => {
            saveResponse(record);
          }}
        />
      );
    case 'slide5':
      return (
        <SnapshotSingleSelectScreen
          screenLabel={undefined}
          prompt="This feels different, doesn&apos;t it?"
          options={SUPPLEMENTAL_SLIDE_5_OPTIONS}
          responseKey="slide_05_supplemental"
          slideId="slide_05"
          screenId="supplemental_slide5"
          payload={payload}
          sessionId={sessionId}
          responses={responses}
          onSave={(record) => {
            saveResponse(record);
          }}
        />
      );
    case 'slide6':
      return (
        <SnapshotManagerCoachingScreen
          payload={payload}
          sessionId={sessionId}
          responses={responses}
          onSave={(record) => {
            saveResponse(record);
          }}
        />
      );
    case 'slide7':
      return (
        <SnapshotSingleSelectScreen
          screenLabel={undefined}
          prompt="Have you seen something like this?"
          options={SUPPLEMENTAL_SLIDE_7_OPTIONS}
          responseKey="slide_07_supplemental"
          slideId="slide_07"
          screenId="supplemental_slide7"
          payload={payload}
          sessionId={sessionId}
          responses={responses}
          onSave={(record) => {
            saveResponse(record);
          }}
        />
      );
    case 'slide8':
      return (
        <SnapshotBusinessImpactScreen
          payload={payload}
          sessionId={sessionId}
          responses={responses}
          onSave={(record) => {
            saveResponse(record);
          }}
        />
      );
    case 'slide9':
      return (
        <SnapshotSingleSelectScreen
          screenLabel={undefined}
          prompt="What usually happens after a problem is identified?"
          options={SUPPLEMENTAL_SLIDE_9_OPTIONS}
          responseKey="slide_09_supplemental"
          slideId="slide_09"
          screenId="supplemental_slide9"
          payload={payload}
          sessionId={sessionId}
          responses={responses}
          onSave={(record) => {
            saveResponse(record);
          }}
        />
      );
    case 'slide10':
      return (
        <SnapshotMultiSelectScreen
          screenLabel={undefined}
          prompt="What would change first in your store?"
          options={SUPPLEMENTAL_SLIDE_10_OPTIONS}
          responseKey="slide_10_supplemental"
          slideId="slide_10"
          screenId="supplemental_slide10"
          payload={payload}
          sessionId={sessionId}
          responses={responses}
          onSave={(record) => {
            saveResponse(record);
          }}
        />
      );
    case 'slide11':
      return (
        <SnapshotSingleSelectScreen
          screenLabel={undefined}
          prompt="Be honest. Where are you operating today?"
          options={SUPPLEMENTAL_SLIDE_11_OPTIONS}
          responseKey="slide_11_supplemental"
          slideId="slide_11"
          screenId="supplemental_slide11"
          payload={payload}
          sessionId={sessionId}
          responses={responses}
          onSave={(record) => {
            saveResponse(record);
          }}
        />
      );
    case 'slide12':
      return (
        <SnapshotVisionGapScreen
          payload={payload}
          sessionId={sessionId}
          responses={responses}
          onSave={(record) => {
            saveResponse(record);
          }}
        />
      );
    case 'slide13':
      return (
        <SnapshotSingleSelectScreen
          screenLabel={undefined}
          prompt="If this worked, it would matter… right?"
          options={SUPPLEMENTAL_SLIDE_13_OPTIONS}
          responseKey="slide_13_supplemental"
          slideId="slide_13"
          screenId="supplemental_slide13"
          payload={payload}
          sessionId={sessionId}
          responses={responses}
          onSave={(record) => {
            saveResponse(record);
          }}
        />
      );
    case 'slide14':
      return (
        <SnapshotFinalOutputScreen
          payload={payload}
          sessionId={sessionId}
          responses={responses}
          onSave={(record) => {
            saveResponse(record);
          }}
        />
      );
    case 'slide15':
      return (
        <SnapshotHowThisActuallyRunsScreen
          payload={payload}
          sessionId={sessionId}
          responses={responses}
          onSave={(record) => {
            saveResponse(record);
          }}
        />
      );
    default:
      return null;
  }
}

function screenIndexToSlide2Content(
  payload: LiveSessionPayload,
  sessionId: string,
  responses: SnapshotResponsesMap,
  saveResponse: (record: SnapshotResponseRecord) => void,
  advanceScreen: () => void,
) {
  const hasConsistency = Boolean(responses.cx_consistency_score);
  const hasBreakdown = Boolean(responses.breakdown_point);

  if (hasBreakdown) {
    return (
      <SnapshotBreakdownPointScreen
        payload={payload}
        sessionId={sessionId}
        responses={responses}
        onSave={(record) => {
          saveResponse(record);
        }}
      />
    );
  }

  if (hasConsistency) {
    return (
      <SnapshotBreakdownPointScreen
        payload={payload}
        sessionId={sessionId}
        responses={responses}
        onSave={(record) => {
          saveResponse(record);
        }}
      />
    );
  }

  return (
    <SnapshotCxConsistencyScreen
      payload={payload}
      sessionId={sessionId}
      responses={responses}
      onSave={(record) => {
        saveResponse(record);
      }}
      onAdvance={advanceScreen}
    />
  );
}

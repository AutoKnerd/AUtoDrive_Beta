'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ExternalLink, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useEntitlements } from '@/hooks/use-entitlements';
import { FeatureGate } from '@/components/tools/feature-gate';
import { FEATURES, resolvePaidAccess, type FeatureGateResult } from '@/lib/tools/entitlements';
import { clearFullToolHandoff, readFullToolHandoff } from '@/lib/tools/toolbox-storage';
import { ASSISTANT_AVATAR_SRC } from '@/lib/assistant';
import {
  practiceConsistencyReset,
  refineConsistencyReset,
} from '@/ai/flows/consistency-leak-sprocket-flow';

const STORAGE_KEY = 'consistencyLeakFinderV1';
const FIELD_COUNT = 5;

const FULL_TOOL_URL = 'https://app.autodrivecx.com/signup';

type LeakFinderState = {
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  step5: string;
};

type RefinedReset = {
  recoveryMove: string;
  sayNext: string;
  avoid: string;
};

type PracticeVariants = {
  softer: string;
  direct: string;
  consultative: string;
};

const initialState: LeakFinderState = {
  step1: '',
  step2: '',
  step3: '',
  step4: '',
  step5: '',
};

const STEP1_OPTIONS = [
  'First contact',
  'Needs discovery',
  'Price presentation',
  'Follow-up',
  'After visit',
  'Handoff',
  'Delivery / post-sale',
];

const STEP2_OPTIONS = [
  'I rush',
  'I forget a step',
  'I don’t know what to say',
  'My follow-up gets inconsistent',
  'Customer goes cold',
  'Someone else takes over badly',
  'I don’t have a repeatable process',
];

const STEP3_OPTIONS = [
  'Confused',
  'Rushed',
  'Unsure',
  'Forgotten',
  'Pressured',
  'Disconnected',
];

const RECOVERY_BY_LEAK: Record<string, string> = {
  'First contact': 'Start every greeting with the same 20-second trust opener and one clear agenda question.',
  'Needs discovery': 'Use one fixed discovery checklist and confirm the top priority out loud before moving on.',
  'Price presentation': 'Set one numbers script and pause for confirmation before you present options.',
  'Follow-up': 'Send one same-day follow-up message template before ending your shift.',
  'After visit': 'Close every visit with a scheduled next touchpoint and a clear owner.',
  Handoff: 'Use a handoff script with role, context, and immediate next action before transfer.',
  'Delivery / post-sale': 'Run a standard post-sale closeout with expectations, contacts, and first check-in date.',
};

const AVOID_BY_BREAK: Record<string, string> = {
  'I rush': 'Speeding through decisions before confirming understanding.',
  'I forget a step': 'Trusting memory instead of a visible checklist.',
  'I don’t know what to say': 'Filling silence with vague language or improvising too late.',
  'My follow-up gets inconsistent': 'Skipping the first follow-up window after the conversation.',
  'Customer goes cold': 'Waiting too long to re-engage after interest appears.',
  'Someone else takes over badly': 'Handing off without context, ownership, and next action.',
  'I don’t have a repeatable process': 'Changing the process every time based on pressure.',
};

const FIX_BY_BREAK: Record<string, string> = {
  'I rush': 'Slow down and ask one alignment check before every transition.',
  'I forget a step': 'Run a visible 3-point checklist every deal, every time.',
  'I don’t know what to say': 'Use one approved talk track for this stage of the deal.',
  'My follow-up gets inconsistent': 'Schedule and send the first follow-up before ending the current interaction.',
  'Customer goes cold': 'Set a specific next touchpoint while engagement is still active.',
  'Someone else takes over badly': 'Hand off with a structured 30-second context summary.',
  'I don’t have a repeatable process': 'Pick one simple sequence and repeat it all week without changing it.',
};

const EMPATHY_BY_FEEL: Record<string, string> = {
  Confused: 'I want to make this simple and clear for you.',
  Rushed: 'No pressure, we can go at your pace.',
  Unsure: 'I will keep this simple so you can feel confident.',
  Forgotten: 'You matter, and I am staying with you through the next step.',
  Pressured: 'I am here to guide, not push.',
  Disconnected: 'Let’s reconnect and make sure this stays smooth from here.',
};

function normalizeWeeklyHabit(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Repeat your chosen reset behavior once per deal this week.';
  return trimmed.endsWith('.') ? trimmed : `${trimmed}.`;
}

function fallbackRefine(state: LeakFinderState): RefinedReset {
  const stage = (state.step1 || 'this step').toLowerCase();
  const feel = (state.step3 || 'unsure').toLowerCase();
  return {
    recoveryMove: `I want to slow ${stage} down for a second so this feels clear and easy.`,
    sayNext: `Here is what happens next, and I will keep it simple so you do not feel ${feel}.`,
    avoid: 'Rushing to the next topic before the customer feels settled.',
  };
}

function fallbackPractice(state: LeakFinderState): PracticeVariants {
  const stage = (state.step1 || 'this step').toLowerCase();
  const feel = (state.step3 || 'unsure').toLowerCase();
  return {
    softer: `No rush, let us take ${stage} one step at a time so this feels comfortable.`,
    direct: `Next step: we handle ${stage} now, clearly and without extra noise.`,
    consultative: `What matters most to you here, so I can keep this clear and avoid any ${feel} feeling?`,
  };
}

async function runFastAction<T>(action: Promise<T>, timeoutMs = 1800): Promise<T | null> {
  const guarded = action
    .then((value) => ({ type: 'ok' as const, value }))
    .catch(() => ({ type: 'error' as const }));

  const timeout = new Promise<{ type: 'timeout' }>((resolve) => {
    setTimeout(() => resolve({ type: 'timeout' }), timeoutMs);
  });

  const result = await Promise.race([guarded, timeout]);
  if (result.type === 'ok') return result.value;
  return null;
}

export default function ConsistencyLeakFinderPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();
  const searchParams = useSearchParams();

  const [isMounted, setIsMounted] = useState(false);
  const [state, setState] = useState<LeakFinderState>(initialState);
  const [refinedReset, setRefinedReset] = useState<RefinedReset | null>(null);
  const [isRefining, setIsRefining] = useState(false);
  const [practiceVariants, setPracticeVariants] = useState<PracticeVariants | null>(null);
  const [isPracticing, setIsPracticing] = useState(false);

  const { entitlements } = useEntitlements({
    isAuthenticated: !!firebaseUser,
    hasPaidAccess: resolvePaidAccess({
      tier: user?.tier,
      subscriptionStatus: user?.subscriptionStatus,
    }),
    hasAutoDriveCX: Boolean(user?.hasAutoDriveCX),
  });

  useEffect(() => {
    setIsMounted(true);
    try {
      const persisted = localStorage.getItem(STORAGE_KEY);
      if (persisted) {
        setState(JSON.parse(persisted));
      }

      const handoff = readFullToolHandoff<{ source?: string; draft?: string }>('consistency-leak-finder');
      if (handoff?.draft) {
        setState((current) => ({
          ...current,
          step4: current.step4 || handoff.draft || '',
        }));
      }

      clearFullToolHandoff('consistency-leak-finder');
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    const forcedTheme = searchParams.get('theme');
    if (forcedTheme !== 'dark') return;
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.add('dark');
    root.style.colorScheme = 'dark';

    return () => {
      if (!hadDark) {
        root.classList.remove('dark');
      }
    };
  }, [searchParams]);

  const saveState = useCallback((next: LeakFinderState) => {
    setState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const updateField = useCallback(
    (field: keyof LeakFinderState, value: string) => {
      saveState({ ...state, [field]: value });
    },
    [saveState, state]
  );

  const completionCount = useMemo(() => {
    return [
      state.step1.trim().length > 0,
      state.step2.trim().length > 0,
      state.step3.trim().length > 0,
      state.step4.trim().length > 0,
      state.step5.trim().length > 0,
    ].filter(Boolean).length;
  }, [state]);

  const completionPercent = Math.round((completionCount / FIELD_COUNT) * 100);

  const generated = useMemo(() => {
    const leak = state.step1 || 'Not selected yet';
    const breaking = state.step2 || 'Not selected yet';
    const feels = state.step3 || 'Not selected yet';

    const recoveryBase = RECOVERY_BY_LEAK[state.step1] || 'Pick one stage and run one repeatable behavior every time.';
    const breakFix = FIX_BY_BREAK[state.step2] || 'Name the failure pattern and lock one repeatable correction.';
    const resetLine = state.step4.trim() || 'Define one sentence that you will repeat every time in this stage.';

    const recoveryMove = `${recoveryBase} ${breakFix}`;
    const customerLine = EMPATHY_BY_FEEL[state.step3] || 'I want to make this next step clear and consistent for you.';
    const sayNext = `${customerLine} Here is exactly what happens next: ${resetLine}`;
    const avoid = AVOID_BY_BREAK[state.step2] || 'Changing your approach under pressure.';

    const weeklyHabit = state.step5.trim()
      ? normalizeWeeklyHabit(state.step5)
      : state.step4.trim()
        ? `Repeat this line in every relevant interaction: "${state.step4.trim()}"`
        : 'Choose one behavior and repeat it in every deal this week.';

    return {
      leak,
      breaking,
      feels,
      recoveryMove,
      sayNext,
      avoid,
      weeklyHabit,
    };
  }, [state]);

  const handleSave = () => {
    toast({ title: 'Saved to Pipeline', description: 'Your consistency reset is locked in.' });
  };

  useEffect(() => {
    setRefinedReset(null);
    setPracticeVariants(null);
  }, [state.step1, state.step2, state.step3, state.step4, state.step5]);

  const handleRefineWithSprocket = async () => {
    setIsRefining(true);
    const base = {
      recoveryMove: generated.recoveryMove,
      sayNext: generated.sayNext,
      avoid: generated.avoid,
    };
    const fallback = fallbackRefine(state);
    const result = await runFastAction(
      refineConsistencyReset({
        answers: state,
        current: base,
      })
    );
    setRefinedReset(result || fallback);
    setIsRefining(false);
  };

  const handlePractice = async () => {
    setIsPracticing(true);
    const activeLine = refinedReset?.sayNext || generated.sayNext;
    const fallback = fallbackPractice(state);
    const result = await runFastAction(
      practiceConsistencyReset({
        answers: state,
        sayNext: activeLine,
      })
    );
    setPracticeVariants(result || fallback);
    setIsPracticing(false);
  };

  const sprocketButtonClass = 'inline-flex h-10 items-center gap-2 rounded-xl border border-[#00d8e5]/40 bg-[#00f2ff]/10 px-3 text-sm font-bold text-[#007f87] transition-colors hover:bg-[#00f2ff]/20 disabled:opacity-70 dark:text-[#7eeeff]';

  function handleBlockedFeature(gate: FeatureGateResult) {
    if (gate.gate === 'account') {
      toast({
        title: 'Account required',
        description: 'Add email and role in Tool Shop to use Sprocket.',
      });
      window.open('/tools', '_self');
      return;
    }

    if (gate.gate === 'paid') {
      toast({
        title: 'Upgrade required',
        description: 'Sprocket is unlocked with paid Tool Shop access.',
      });
      window.open(FULL_TOOL_URL, '_blank', 'noopener,noreferrer');
      return;
    }

    toast({
      title: 'AutoDriveCX required',
      description: 'This insight needs the AutoDriveCX layer.',
    });
  }

  if (!isMounted) return null;

  const OptionCard = ({
    label,
    field,
    selected,
  }: {
    label: string;
    field: keyof LeakFinderState;
    selected: boolean;
  }) => (
    <button
      type="button"
      onClick={() => updateField(field, label)}
      className={`w-full min-h-[52px] rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition-all active:scale-[0.99] ${
        selected
          ? 'border-[#00f2ff] bg-[#00f2ff]/10 text-slate-900 dark:text-[#7ff7ff] shadow-[0_2px_10px_rgba(0,242,255,0.12)]'
          : 'border-slate-200 bg-white text-slate-700 hover:border-[#00f2ff]/50 dark:border-slate-800 dark:bg-[#121111] dark:text-slate-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-[#00f2ff]/30 dark:bg-[#070d18]">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-[#0a1220]/95">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2">
          <Link
            href="/tools"
            className="rounded-xl p-2 text-slate-600 transition-colors active:bg-slate-100 dark:text-slate-300 dark:active:bg-white/10"
            aria-label="Back to tools"
          >
            <ChevronLeft className="h-6 w-6" />
          </Link>

          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="truncate text-base font-black tracking-tight text-slate-900 dark:text-slate-100">Consistency Leak Finder</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">EP79: inconsistent behavior breaks trust and deals.</p>
            <div className="space-y-1 pt-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full rounded-full bg-[#00d8e5] transition-all duration-200" style={{ width: `${completionPercent}%` }} />
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#00b9c4]">{completionPercent}% complete</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-8 px-4 pb-36 pt-6">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2b3e5d] dark:bg-[#111b2d]">
          <h2 className="text-xl font-black leading-tight text-slate-900 dark:text-white">Where do your deals usually wobble?</h2>
          <div className="space-y-3">
            {STEP1_OPTIONS.map((option) => (
              <OptionCard key={option} label={option} field="step1" selected={state.step1 === option} />
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2b3e5d] dark:bg-[#111b2d]">
          <h2 className="text-xl font-black leading-tight text-slate-900 dark:text-white">What usually happens?</h2>
          <div className="space-y-3">
            {STEP2_OPTIONS.map((option) => (
              <OptionCard key={option} label={option} field="step2" selected={state.step2 === option} />
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2b3e5d] dark:bg-[#111b2d]">
          <h2 className="text-xl font-black leading-tight text-slate-900 dark:text-white">What does the customer probably feel?</h2>
          <div className="space-y-3">
            {STEP3_OPTIONS.map((option) => (
              <OptionCard key={option} label={option} field="step3" selected={state.step3 === option} />
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2b3e5d] dark:bg-[#111b2d]">
          <h2 className="text-xl font-black leading-tight text-slate-900 dark:text-white">What would stronger consistency look like?</h2>
          <textarea
            value={state.step4}
            onChange={(event) => updateField('step4', event.target.value)}
            placeholder="Next time I will always..."
            className="min-h-[120px] w-full resize-none rounded-2xl border-2 border-slate-200 bg-white p-4 text-base text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#00f2ff] focus:ring-4 focus:ring-[#00f2ff]/20 dark:border-slate-800 dark:bg-[#121111] dark:text-slate-100"
          />
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2b3e5d] dark:bg-[#111b2d]">
          <h2 className="text-xl font-black leading-tight text-slate-900 dark:text-white">What one behavior will you repeat this week?</h2>
          <textarea
            value={state.step5}
            onChange={(event) => updateField('step5', event.target.value)}
            placeholder="One repeatable action you will do every time this week"
            className="min-h-[120px] w-full resize-none rounded-2xl border-2 border-slate-200 bg-white p-4 text-base text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#00f2ff] focus:ring-4 focus:ring-[#00f2ff]/20 dark:border-slate-800 dark:bg-[#121111] dark:text-slate-100"
          />
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#2b3e5d] dark:bg-[#111b2d]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Your Consistency Reset</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Live output updates as you fill the tool.</p>
            </div>
            <FeatureGate
              feature={FEATURES.SPROCKET}
              entitlements={entitlements}
              fallback={(gate) => (
                <button
                  type="button"
                  onClick={() => handleBlockedFeature(gate)}
                  className={sprocketButtonClass}
                >
                  <Image src={ASSISTANT_AVATAR_SRC} alt="Sprocket" width={16} height={16} className="rounded-[4px]" />
                  Unlock Sprocket
                </button>
              )}
            >
              <button
                type="button"
                onClick={() => void handleRefineWithSprocket()}
                disabled={isRefining}
                className={sprocketButtonClass}
              >
                <Image src={ASSISTANT_AVATAR_SRC} alt="Sprocket" width={16} height={16} className="rounded-[4px]" />
                {isRefining ? 'Refining...' : 'Refine with Sprocket'}
              </button>
            </FeatureGate>
          </div>

          <div className="space-y-4">
            <OutputRow label="Biggest Leak" value={generated.leak} />
            <OutputRow label="What’s Breaking" value={generated.breaking} />
            <OutputRow label="Customer Feels" value={generated.feels} accent />
            <OutputRow label="Recovery Move" value={refinedReset?.recoveryMove || generated.recoveryMove} />
            <OutputRow label="What to Say Next" value={refinedReset?.sayNext || generated.sayNext} />
            <OutputRow label="What to Avoid" value={refinedReset?.avoid || generated.avoid} />
            <div className="rounded-xl border border-[#00f2ff]/30 bg-[#00f2ff]/10 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#00aeb8]">Weekly Habit</p>
              <p className="mt-1 text-base font-semibold text-slate-900 dark:text-white">{generated.weeklyHabit}</p>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#0d1728]">
            <FeatureGate
              feature={FEATURES.SPROCKET}
              entitlements={entitlements}
              fallback={(gate) => (
                <button
                  type="button"
                  onClick={() => handleBlockedFeature(gate)}
                  className={sprocketButtonClass}
                >
                  <Image src={ASSISTANT_AVATAR_SRC} alt="Sprocket" width={16} height={16} className="rounded-[4px]" />
                  Unlock Sprocket
                </button>
              )}
            >
              <button
                type="button"
                onClick={() => void handlePractice()}
                disabled={isPracticing}
                className={sprocketButtonClass}
              >
                <Image src={ASSISTANT_AVATAR_SRC} alt="Sprocket" width={16} height={16} className="rounded-[4px]" />
                {isPracticing ? 'Preparing...' : 'Practice This'}
              </button>
            </FeatureGate>
            {practiceVariants && (
              <div className="space-y-2">
                <OutputRow label="Softer" value={practiceVariants.softer} />
                <OutputRow label="More Direct" value={practiceVariants.direct} />
                <OutputRow label="More Consultative" value={practiceVariants.consultative} />
              </div>
            )}
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 p-4 backdrop-blur dark:border-white/10 dark:bg-[#0a1220]/95">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 pb-safe">
          <button
            type="button"
            onClick={handleSave}
            className="flex h-[52px] min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800 transition-colors active:bg-slate-100 dark:border-slate-700 dark:bg-[#101928] dark:text-slate-100 dark:active:bg-[#162339]"
          >
            <Save className="h-5 w-5" />
            Save My Work
          </button>

          <a
            href={FULL_TOOL_URL}
            className="flex h-[52px] min-h-[52px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#00f2ff] px-3 text-sm font-black text-[#0f1b2b] shadow-[0_4px_14px_rgba(0,242,255,0.3)] transition-transform active:scale-[0.99]"
          >
            Open Full Tool
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: 'body { overscroll-behavior-y: none; } .pb-safe { padding-bottom: max(0px, env(safe-area-inset-bottom)); }' }} />
    </div>
  );
}

function OutputRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-[#0d1728]">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-1 text-base font-semibold ${accent ? 'text-[#ef4444] dark:text-[#ff7b7b]' : 'text-slate-900 dark:text-slate-100'}`}>
        {value}
      </p>
    </div>
  );
}

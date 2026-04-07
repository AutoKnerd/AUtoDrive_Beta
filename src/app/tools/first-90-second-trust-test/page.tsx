'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Copy, RefreshCcw, Sparkles, Bolt, ArrowRight, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useEntitlements } from '@/hooks/use-entitlements';
import { useToast } from '@/hooks/use-toast';
import { applySprocketCxOverlay } from '@/lib/tools/sprocket-cx-overlay';
import { readUserCxStatScore } from '@/lib/tools/cx-stats';
import {
  getFirstImpressionPlan,
  getSprocketFirstImpressionEnhancement,
  type FirstImpressionInput,
} from '@/lib/tools/first-impression-calibrator';
import { resolvePaidAccess } from '@/lib/tools/entitlements';
import { cn } from '@/lib/utils';

type ScenarioKey =
  | 'looking'
  | 'crossed'
  | 'price'
  | 'badxp'
  | 'engage'
  | 'rush'
  | 'couple'
  | 'phone';

type Scenario = {
  button: string;
  title: string;
  script: string;
  mindset: string;
  alt: string;
  dont: string[];
  why: string;
};

const scenarios: Record<ScenarioKey, Scenario> = {
  looking: {
    button: "I’m just looking",
    title: 'The “Just Looking” Pivot',
    script: 'No problem at all, we’ll take this one step at a time. What caught your eye?',
    mindset: 'They are not rejecting you. They are protecting themselves from pressure.',
    alt: 'Totally fine. I just want to make sure I’m helpful, what stood out to you?',
    dont: ['What are you looking to buy today?', 'Let me show you our best deals.', 'This won’t take long.'],
    why: 'This lowers pressure, gives control back, and keeps the customer from going more defensive.',
  },
  crossed: {
    button: 'Arms crossed, quiet',
    title: 'The Guarded Customer',
    script: 'Glad you stopped in. We’ll go at your pace. What brought you by today?',
    mindset: 'They feel guarded, uncertain, or emotionally closed off.',
    alt: 'No rush at all. I just want to make this easy for you.',
    dont: ['So what’s the plan today?', 'You seem unsure.', 'Are you serious about buying?'],
    why: 'This reduces tension and creates emotional safety before you try to gather information.',
  },
  price: {
    button: 'Asked price first',
    title: 'The Early Price Question',
    script: 'I can absolutely help with that. Before we get too far, let’s make sure we’re looking at the right fit for what matters to you.',
    mindset: 'They are looking for protection, not just information.',
    alt: 'Happy to go through numbers. Let’s make sure I’m giving you the right ones first.',
    dont: ['That depends.', 'Let me get some numbers.', 'Why does price matter most?'],
    why: 'This acknowledges the question without turning the interaction into a defensive pricing battle too early.',
  },
  badxp: {
    button: 'Bad past experience',
    title: 'The Trust Warning',
    script: 'I appreciate you telling me that. Let’s keep this simple and transparent the whole way through.',
    mindset: 'They are warning you that trust is already fragile.',
    alt: 'Fair enough. We’ll go step by step, and if anything feels off, tell me.',
    dont: ['We’re not like that here.', 'That happens everywhere.', 'Trust me.'],
    why: 'This validates their experience and signals that they are not about to get pushed or ignored.',
  },
  engage: {
    button: 'Won’t engage',
    title: 'The Checked-Out Customer',
    script: 'That’s alright. Let’s keep it easy. I just want to make sure I’m useful while you’re here.',
    mindset: 'They may feel cautious, distracted, pressured, or emotionally checked out.',
    alt: 'No pressure. I can give you space and still be available if you need me.',
    dont: ['You have to give me something to work with.', 'Are you even interested?', 'Well, I can’t help if you won’t talk.'],
    why: 'This lowers social pressure and often makes guarded customers more willing to re-engage.',
  },
  rush: {
    button: 'In a rush',
    title: 'The Time-Compressed Customer',
    script: 'Got it. Let’s make this efficient. I’ll keep it simple and focused.',
    mindset: 'They are prioritizing control and speed over relationship.',
    alt: 'Sounds good. Let’s handle the most important part first.',
    dont: ['This will just take a minute.', 'You should really slow down.', 'We still need to go through my process.'],
    why: 'This respects urgency without making the customer feel trapped or delayed.',
  },
  couple: {
    button: 'Couple, one disengaged',
    title: 'The Silent Resistance Risk',
    script: 'I want to make sure this works for both of you. What matters most to each of you?',
    mindset: 'One person may be skeptical, left out, or emotionally unconvinced.',
    alt: 'Before we go too far, I’d love to hear what each of you is paying attention to.',
    dont: ['Who’s the real decision-maker?', 'So what do you think?', 'You don’t seem interested.'],
    why: 'This brings both people into the conversation and prevents silent resistance from growing.',
  },
  phone: {
    button: 'On their phone',
    title: 'The Distracted Customer',
    script: 'No problem, take your time. I’ll make this easy whenever you’re ready.',
    mindset: 'They may be distracting themselves, comparing information, or avoiding pressure.',
    alt: 'If you’re checking on something, I’m happy to help line it up with what you’re seeing.',
    dont: ['Can you put that away for a second?', 'You’re not paying attention.', 'Everything online is wrong.'],
    why: 'This removes confrontation and keeps the consultant from creating unnecessary friction.',
  },
};

const scenarioOrder: ScenarioKey[] = ['looking', 'crossed', 'price', 'badxp', 'engage', 'rush', 'couple', 'phone'];

function scenarioButtonClass(active: boolean): string {
  return active
    ? 'border-[#9DEE75]/35 bg-[#0e1f19] text-[#9DEE75] shadow-[0_0_0_1px_rgba(157,238,117,0.08),0_0_20px_rgba(157,238,117,0.08)]'
    : 'border-[#4e2a82] bg-[#221036] text-[#eadfff] hover:bg-[#3b1a64]';
}

function threatClass(button: ScenarioKey): string {
  if (button === 'looking' || button === 'crossed') return 'border-[#ff8b94]/30 text-[#ff8b94]';
  if (button === 'price' || button === 'rush') return 'border-[#f8c05a]/25 text-[#f8c05a]';
  return 'border-[#9d00ff]/20 text-[#9d00ff]';
}

function scenarioToInput(key: ScenarioKey): FirstImpressionInput {
  if (key === 'crossed') {
    return { customerEnergy: 30, comfortRead: 'guarded', warmthLevel: 48, pace: 'slow', setting: 'showroom walk-in' };
  }
  if (key === 'price') {
    return { customerEnergy: 42, comfortRead: 'skeptical', warmthLevel: 54, pace: 'balanced', setting: 'lot up' };
  }
  if (key === 'badxp') {
    return { customerEnergy: 28, comfortRead: 'skeptical', warmthLevel: 52, pace: 'balanced', setting: 'appointment' };
  }
  if (key === 'engage') {
    return { customerEnergy: 24, comfortRead: 'guarded', warmthLevel: 46, pace: 'slow', setting: 'showroom walk-in' };
  }
  if (key === 'rush') {
    return { customerEnergy: 58, comfortRead: 'rushed', warmthLevel: 44, pace: 'brisk', setting: 'lot up' };
  }
  if (key === 'couple') {
    return { customerEnergy: 47, comfortRead: 'guarded', warmthLevel: 50, pace: 'balanced', setting: 'showroom walk-in' };
  }
  if (key === 'phone') {
    return { customerEnergy: 34, comfortRead: 'guarded', warmthLevel: 45, pace: 'slow', setting: 'phone-to-store arrival' };
  }
  return { customerEnergy: 36, comfortRead: 'guarded', warmthLevel: 58, pace: 'balanced', setting: 'showroom walk-in' };
}

export default function First90SecondTrustTestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();
  const { entitlements } = useEntitlements({
    isAuthenticated: !!firebaseUser,
    hasPaidAccess: resolvePaidAccess({
      tier: user?.tier,
      subscriptionStatus: user?.subscriptionStatus,
    }),
    hasAutoDriveCX: Boolean(user?.hasAutoDriveCX),
  });
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>('looking');
  const [copyStatus, setCopyStatus] = useState('');
  const [interactions, setInteractions] = useState(0);
  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketFirstImpressionEnhancement> | null>(null);

  const scenario = scenarios[activeScenario];
  const scenarioInput = useMemo(() => scenarioToInput(activeScenario), [activeScenario]);
  const scenarioPlan = useMemo(() => getFirstImpressionPlan(scenarioInput), [scenarioInput]);
  const isSprocketLocked = !entitlements.hasPaidAccess;

  const progress = useMemo(() => {
    const index = scenarioOrder.indexOf(activeScenario);
    return Math.round(((index + 1) / scenarioOrder.length) * 100);
  }, [activeScenario]);

  const cxSignal = useMemo(() => {
    const scores = [
      { key: 'trust', label: 'Trust', score: readUserCxStatScore(user, 'trust') },
      { key: 'listening', label: 'Listening', score: readUserCxStatScore(user, 'listening') },
      { key: 'empathy', label: 'Empathy', score: readUserCxStatScore(user, 'empathy') },
      { key: 'followUp', label: 'Follow-Up', score: readUserCxStatScore(user, 'followUp') },
      { key: 'closing', label: 'Closing', score: readUserCxStatScore(user, 'closing') },
      { key: 'relationship', label: 'Relationship', score: readUserCxStatScore(user, 'relationship') },
    ];

    return [...scores].sort((a, b) => a.score - b.score)[0];
  }, [user]);

  const handleScenarioSelect = (key: ScenarioKey) => {
    setActiveScenario((current) => (current === key ? current : key));
    setCopyStatus('');
    setInteractions((current) => current + 1);
  };

  useEffect(() => {
    setSprocketOutput(null);
  }, [activeScenario]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(scenario.script);
      setCopyStatus('Copied. Use it now.');
    } catch {
      setCopyStatus('Copy failed. Select and copy manually.');
    }
  };

  const handleReset = () => {
    setActiveScenario('looking');
    setCopyStatus('');
    setInteractions(0);
    setSprocketOutput(null);
  };

  const handleRunSprocket = () => {
    if (isSprocketLocked) {
      router.push('/signup');
      return;
    }

    const base = getSprocketFirstImpressionEnhancement(scenarioInput, scenarioPlan);
    const tuned = {
      ...base,
      sharperOpeningLine: `${base.sharperOpeningLine} Bias toward ${cxSignal.label.toLowerCase()} because that is your weakest CX signal.`,
      deliveryCoaching: `${base.deliveryCoaching} Your current CX profile shows ${cxSignal.label.toLowerCase()} at ${Math.round(cxSignal.score)}%.`,
    };
    setSprocketOutput(applySprocketCxOverlay(tuned, user));
    toast({
      title: 'Sprocket insight ready',
      description: `Adapted for ${scenario.title.toLowerCase()} using your ${cxSignal.label.toLowerCase()} signal.`,
    });
  };

  const handleUpgrade = () => {
    window.open('https://app.autodrivecx.com/signup', '_blank', 'noopener,noreferrer');
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_20%_10%,rgba(157,0,255,0.08),transparent_24%),radial-gradient(circle_at_80%_80%,rgba(157,238,117,0.08),transparent_24%),linear-gradient(180deg,#12081f_0%,#160c29_46%,#0f0918_100%)] text-white">
      <header className="sticky top-0 z-50 border-b border-[#4e2a82]/40 bg-[#12081f]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#9DEE75]/10 text-[#9DEE75]">
              <Bolt className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#9d00ff]">AutoKnerd</div>
              <div className="text-sm text-[#d9c8ff]">First 90-Second Trust Test</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-xl border border-[#4e2a82] bg-[#221036] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#d9c8ff] transition hover:bg-[#3b1a64] hover:text-white"
          >
            Reset
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pb-28 pt-6">
        <section className="mb-6 rounded-3xl border border-[#4e2a82]/40 bg-[#170d27]/90 p-6 shadow-[0_10px_30px_rgba(0,0,0,0.35),0_2px_8px_rgba(157,0,255,0.08)] backdrop-blur">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#9d00ff]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#9d00ff]">
            <Sparkles className="h-3.5 w-3.5" />
            Pocket coaching tool
          </div>

          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white md:text-4xl">What just happened?</h1>
          <p className="max-w-2xl text-sm leading-6 text-[#d9c8ff] md:text-base">
            Tap the customer situation you’re dealing with. Get the right language fast, lower pressure, and keep the
            customer from going more defensive.
          </p>
        </section>

        <section className="sticky top-[73px] z-40 mb-6 rounded-3xl border border-[#4e2a82]/35 bg-[#170d27]/92 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.35),0_2px_8px_rgba(157,0,255,0.08)] backdrop-blur-xl md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.24em] text-[#c39cff]">Scenario library</h2>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#9DEE75]">{scenarioOrder.length} ready</span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {scenarioOrder.map((key) => {
              const item = scenarios[key];
              const active = activeScenario === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleScenarioSelect(key)}
                  className={cn(
                    'rounded-2xl border px-4 py-4 text-left text-sm font-bold transition active:scale-[0.98]',
                    scenarioButtonClass(active)
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="leading-5">{item.button}</span>
                    <ChevronRight className={cn('h-4 w-4', active ? 'text-[#9DEE75]' : 'text-[#c39cff]')} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section
          className={cn(
            'rounded-3xl border border-[#4e2a82]/35 bg-[#170d27]/92 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.35),0_2px_8px_rgba(157,0,255,0.08)] md:p-8',
            'mt-4 opacity-100'
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#9d00ff]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9d00ff]">
                <Bolt className="h-3.5 w-3.5" />
                Active scenario
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">{scenario.title}</h2>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="hidden rounded-xl border border-[#4e2a82] bg-[#221036] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#d9c8ff] transition hover:bg-[#3b1a64] hover:text-white md:block"
            >
              Choose another
            </button>
          </div>

          <div className="mb-5 rounded-2xl border border-[#9DEE75]/20 bg-[#0e1f19] p-4 md:p-5">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#9DEE75]">What to say</div>
            <div className="rounded-2xl bg-[#221036] px-4 py-4 text-xl font-bold leading-tight text-white md:text-3xl">
              “{scenario.script}”
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#9DEE75] px-5 py-3 text-sm font-bold text-[#09131f] transition hover:bg-[#b5f590] active:scale-[0.98]"
              >
                <Copy className="h-4 w-4" />
                Use this now
              </button>
              <span className="self-center text-sm font-medium text-[#9d00ff]">{copyStatus}</span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#4e2a82]/35 bg-[#221036] p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#9d00ff]">What’s actually happening</div>
              <p className="text-sm leading-6 text-[#d9c8ff] md:text-base">{scenario.mindset}</p>
            </div>

            <div className="rounded-2xl border border-[#4e2a82]/35 bg-[#221036] p-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#9d00ff]">Alt option</div>
              <p className="text-base font-semibold leading-7 text-white">{scenario.alt}</p>
            </div>

            <div className="rounded-2xl border border-[#4e2a82]/35 bg-[#221036] p-4 md:col-span-2">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#9d00ff]">What not to do</div>
              <ul className="grid gap-2 md:grid-cols-3">
                {scenario.dont.map((line) => (
                  <li key={line} className="rounded-xl bg-[#12091f] px-4 py-3 text-sm leading-6 text-[#d9c8ff]">
                    <span className="mr-2 font-bold text-[#ff8b94]">✕</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[#4e2a82]/35 bg-[#221036] p-4 md:col-span-2">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#9d00ff]">Why this works</div>
              <p className="text-sm leading-6 text-[#d9c8ff] md:text-base">{scenario.why}</p>
              <p className="mt-3 text-sm font-semibold italic text-[#9DEE75]">
                Handled correctly, this moment builds trust fast.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <Card className="overflow-hidden border-[#4e2a82]/35 bg-[#170d27]/92 shadow-[0_10px_30px_rgba(0,0,0,0.35),0_2px_8px_rgba(157,0,255,0.08)]">
            <CardHeader className="border-b border-[#4e2a82]/30 bg-[#12081f]/50">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#9d00ff]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#9d00ff]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Sprocket Insight
                  </div>
                  <CardTitle className="text-2xl font-extrabold tracking-tight text-white">CX-aware opening guidance</CardTitle>
                  <p className="max-w-2xl text-sm leading-6 text-[#d9c8ff] md:text-base">
                    This reads the selected scenario and sharpens the answer using the user&apos;s CX profile.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5 md:p-6">
              <div className="flex flex-wrap gap-3">
                <Button className="bg-[#9DEE75] text-[#09131f] hover:bg-[#b5f590]" onClick={handleRunSprocket}>
                  Sprocket Insight
                </Button>
              </div>

              <div className="relative">
                <div className={cn('grid gap-3 md:grid-cols-2', isSprocketLocked && 'select-none')}>
                  <div className={cn('rounded-2xl border border-[#4e2a82]/35 bg-[#221036] p-4', isSprocketLocked && 'blur-md')}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9d00ff]">Sprocket reason</div>
                    <p className="mt-2 text-sm leading-7 text-[#eadfff]">
                      {sprocketOutput?.likelyReason || 'Run Sprocket to see why this scenario needs the current opening style.'}
                    </p>
                  </div>
                  <div className={cn('rounded-2xl border border-[#4e2a82]/35 bg-[#221036] p-4', isSprocketLocked && 'blur-md')}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9d00ff]">Sharper opening</div>
                    <p className="mt-2 text-sm leading-7 text-[#eadfff]">
                      {sprocketOutput?.sharperOpeningLine || 'Your sharper opening will appear here after you run Sprocket.'}
                    </p>
                  </div>
                  <div className={cn('rounded-2xl border border-[#4e2a82]/35 bg-[#221036] p-4', isSprocketLocked && 'blur-md')}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9d00ff]">Natural rewrite</div>
                    <p className="mt-2 text-sm leading-7 text-[#eadfff]">
                      {sprocketOutput?.naturalRewrite || 'The rewrite will reflect this scenario and your CX signals.'}
                    </p>
                  </div>
                  <div className={cn('rounded-2xl border border-[#4e2a82]/35 bg-[#221036] p-4', isSprocketLocked && 'blur-md')}>
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9d00ff]">Delivery coaching</div>
                    <p className="mt-2 text-sm leading-7 text-[#eadfff]">
                      {sprocketOutput?.deliveryCoaching || 'The coaching note will appear after Sprocket runs.'}
                    </p>
                  </div>
                </div>
              </div>
              {isSprocketLocked && (
                <div className="rounded-2xl border border-[#4e2a82]/35 bg-[#12081f]/60 px-4 py-3 text-sm text-[#d9c8ff]">
                  Want the full Sprocket coaching? Sign up to unlock the complete insight.
                </div>
              )}
            </CardContent>
          </Card>
        </section>

      </main>
    </main>
  );
}

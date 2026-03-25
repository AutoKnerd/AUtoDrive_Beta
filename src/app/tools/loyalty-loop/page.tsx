'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  BrainCircuit,
  ChevronLeft,
  Cloud,
  Copy,
  Save,
  Sparkles,
  Star,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { EmailGateModal } from '@/components/tools/email-gate-modal';
import { FeatureGate } from '@/components/tools/feature-gate';
import { UpgradeModal } from '@/components/tools/upgrade-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useEntitlements } from '@/hooks/use-entitlements';
import { useToast } from '@/hooks/use-toast';
import {
  FEATURES,
  resolvePaidAccess,
  type ToolboxCapturedRole,
  type ToolboxFeatureKey,
} from '@/lib/tools/entitlements';
import {
  captureToolboxUnlockEmail,
  saveToolboxEntry,
} from '@/lib/tools/toolbox-client';
import { clearFullToolHandoff, readFullToolHandoff } from '@/lib/tools/toolbox-storage';
import {
  LOYALTY_CUSTOMER_TYPES,
  LOYALTY_GOALS,
  LOYALTY_INTENSITY,
  LOYALTY_TONE,
  LOYALTY_TOUCHPOINTS,
  getAutoDriveCxLoyaltyLoopEnhancement,
  getLoyaltyLoopPlan,
  getSprocketLoyaltyLoopEnhancement,
  type LoyaltyCustomerType,
  type LoyaltyGoal,
  type LoyaltyIntensity,
  type LoyaltyLoopInput,
  type LoyaltyLoopSavedScenario,
  type LoyaltyTone,
  type LoyaltyTouchpoint,
} from '@/lib/tools/loyalty-loop-designer';

const TOOL_ID = 'loyalty-loop';
const LOCAL_SCENARIOS_KEY = 'loyaltyLoopSavedScenariosV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

function readLocalScenarios(): LoyaltyLoopSavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LoyaltyLoopSavedScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScenarios(scenarios: LoyaltyLoopSavedScenario[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios));
}

function intensityFromSlider(value: number): LoyaltyIntensity {
  if (value <= 0) return 'light touch';
  if (value === 1) return 'steady';
  if (value === 2) return 'proactive';
  return 'high-touch';
}

function toneFromSlider(value: number): LoyaltyTone {
  if (value <= 33) return 'practical';
  if (value >= 67) return 'personal';
  return 'balanced';
}

function buildCloudContent(input: LoyaltyLoopInput, summary: string): string {
  return [
    'LOYALTY LOOP DESIGNER',
    '',
    `Goal: ${input.goal}`,
    `Customer Type: ${input.customerType}`,
    `Intensity: ${input.intensity}`,
    `Tone: ${input.tone}`,
    `Tone Blend: ${input.toneBlend}`,
    `Touchpoints: ${input.preferredTouchpoints.join(', ') || 'Not set'}`,
    `Context: ${input.context || 'Not provided'}`,
    '',
    summary,
  ].join('\n');
}

export default function LoyaltyLoopPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [goal, setGoal] = useState<LoyaltyGoal>('long-term nurture');
  const [customerType, setCustomerType] = useState<LoyaltyCustomerType>('recent buyer');
  const [intensitySlider, setIntensitySlider] = useState(1);
  const [toneBlend, setToneBlend] = useState(50);
  const [context, setContext] = useState('');
  const [preferredTouchpoints, setPreferredTouchpoints] = useState<LoyaltyTouchpoint[]>(['check-in', 'text', 'service reminder', 'review ask']);

  const [savedScenarios, setSavedScenarios] = useState<LoyaltyLoopSavedScenario[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketLoyaltyLoopEnhancement> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxLoyaltyLoopEnhancement> | null>(null);

  const hasTrackedMeaningfulInteraction = useRef(false);

  const intensity = useMemo(() => intensityFromSlider(intensitySlider), [intensitySlider]);
  const tone = useMemo(() => toneFromSlider(toneBlend), [toneBlend]);

  const {
    entitlements,
    accountProfile,
    usedToolIds,
    setLocalAccountProfile,
    registerToolUsage,
    checkFeature,
  } = useEntitlements({
    isAuthenticated: !!firebaseUser,
    hasPaidAccess: resolvePaidAccess({
      tier: user?.tier,
      subscriptionStatus: user?.subscriptionStatus,
    }),
    hasAutoDriveCX: Boolean(user?.hasAutoDriveCX),
  });

  const canUseBaseTool = entitlements.hasAccount || entitlements.usage.toolsUsedCount < 3 || usedToolIds.includes(TOOL_ID);

  useEffect(() => {
    setSavedScenarios(readLocalScenarios());
    const handoff = readFullToolHandoff<{ source?: string; draft?: string }>(TOOL_ID);
    if (handoff?.draft) {
      setContext((current) => current || handoff.draft || '');
    }
    clearFullToolHandoff(TOOL_ID);
  }, []);

  useEffect(() => {
    setSprocketOutput(null);
    setCxOutput(null);
  }, [goal, customerType, intensitySlider, toneBlend, preferredTouchpoints, context]);

  const input = useMemo<LoyaltyLoopInput>(() => ({
    goal,
    customerType,
    intensity,
    tone,
    toneBlend,
    preferredTouchpoints,
    context,
  }), [goal, customerType, intensity, tone, toneBlend, preferredTouchpoints, context]);

  const plan = useMemo(() => getLoyaltyLoopPlan(input), [input]);

  const favoriteCount = useMemo(
    () => savedScenarios.filter((scenario) => scenario.favorite).length,
    [savedScenarios]
  );

  const requireFeature = useCallback((feature: ToolboxFeatureKey, contextMessage?: string): boolean => {
    const gate = checkFeature(feature);
    if (gate.allowed) return true;

    if (gate.gate === 'account') {
      setShowEmailGate(true);
      return false;
    }

    setUpgradeContextMessage(contextMessage || gate.message);
    setGateModalType(gate.gate === 'autodrive_cx' ? 'autodrive_cx' : 'paid');
    return false;
  }, [checkFeature]);

  const trackMeaningfulInteraction = useCallback(() => {
    if (hasTrackedMeaningfulInteraction.current) return;
    registerToolUsage(TOOL_ID);
    hasTrackedMeaningfulInteraction.current = true;
  }, [registerToolUsage]);

  const withUsageTracking = useCallback((action: () => void) => {
    if (!canUseBaseTool) {
      setShowEmailGate(true);
      return;
    }
    trackMeaningfulInteraction();
    action();
  }, [canUseBaseTool, trackMeaningfulInteraction]);

  const handleCopy = useCallback(async () => {
    const payload = [
      `[Loyalty Loop Summary] ${plan.loopSummary}`,
      `[Best Loyalty Angle] ${plan.bestLoyaltyAngle}`,
      `[Touchpoint Sequence]`,
      ...plan.sequence.map((step) => `${step.weekLabel}: ${step.touchpoint} - ${step.action}`),
      `[What To Send / Say]`,
      ...plan.whatToSendOrSay,
      `[Do Not Do This] ${plan.doNotDoThis}`,
      `[Why This Works] ${plan.whyThisWorks}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Loyalty loop copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [plan, toast]);

  const handleSaveLocal = useCallback(() => {
    const scenario: LoyaltyLoopSavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      goal,
      customerType,
      intensity,
      tone,
      toneBlend,
      preferredTouchpoints,
      loopSummary: plan.loopSummary,
      bestLoyaltyAngle: plan.bestLoyaltyAngle,
      doNotDoThis: plan.doNotDoThis,
      favorite: false,
    };

    const next = [scenario, ...savedScenarios].slice(0, 40);
    setSavedScenarios(next);
    writeLocalScenarios(next);
    toast({ title: 'Saved locally', description: 'Loop saved on this device.' });
  }, [customerType, goal, intensity, plan.bestLoyaltyAngle, plan.doNotDoThis, plan.loopSummary, preferredTouchpoints, savedScenarios, tone, toneBlend, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock cloud saves to sync loyalty loops.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this loop.' });
      return;
    }

    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(input, `${plan.loopSummary}\nBest angle: ${plan.bestLoyaltyAngle}`),
    });
    setIsCloudSaving(false);

    if (!result.ok) {
      if (result.code === 'PAYMENT_REQUIRED') {
        setUpgradeContextMessage('Cloud saves require paid Tool Shop access.');
        setGateModalType('paid');
      }
      toast({ variant: 'destructive', title: result.message });
      return;
    }

    toast({ title: 'Saved to cloud', description: 'Loop now syncs across devices.' });
  }, [firebaseUser, input, plan.bestLoyaltyAngle, plan.loopSummary, requireFeature, toast]);

  const handleRunSprocket = useCallback(() => {
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for deeper loyalty optimization.')) return;
    setSprocketOutput(getSprocketLoyaltyLoopEnhancement(input, plan));
  }, [input, plan, requireFeature]);

  const handleRunAutoDrive = useCallback(() => {
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for personalized loyalty guidance.')) return;
    setCxOutput(getAutoDriveCxLoyaltyLoopEnhancement(input, plan, user));
  }, [input, plan, requireFeature, user]);

  const toggleFavorite = useCallback((scenarioId: string) => {
    const next = savedScenarios.map((scenario) => {
      if (scenario.id !== scenarioId) return scenario;
      return { ...scenario, favorite: !scenario.favorite };
    });
    setSavedScenarios(next);
    writeLocalScenarios(next);
  }, [savedScenarios]);

  const toggleTouchpoint = useCallback((touchpoint: LoyaltyTouchpoint) => {
    withUsageTracking(() => {
      setPreferredTouchpoints((current) => {
        if (current.includes(touchpoint)) {
          const filtered = current.filter((item) => item !== touchpoint);
          return filtered.length > 0 ? filtered : [touchpoint];
        }
        return [...current, touchpoint];
      });
    });
  }, [withUsageTracking]);

  const moveTouchpoint = useCallback((index: number, direction: -1 | 1) => {
    withUsageTracking(() => {
      setPreferredTouchpoints((current) => {
        const nextIndex = index + direction;
        if (nextIndex < 0 || nextIndex >= current.length) return current;
        const clone = [...current];
        const [item] = clone.splice(index, 1);
        clone.splice(nextIndex, 0, item);
        return clone;
      });
    });
  }, [withUsageTracking]);

  async function handleUnlockByEmail(values: { email: string; role: ToolboxCapturedRole }) {
    const email = values.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      toast({ variant: 'destructive', title: 'Enter a valid email' });
      return;
    }

    setIsEmailSubmitting(true);
    const captureResult = await captureToolboxUnlockEmail({ email, role: values.role });
    if (!captureResult.ok) {
      console.warn('[LoyaltyLoop] unlock capture failed:', captureResult.message);
    }

    setLocalAccountProfile({ email, role: values.role });
    setShowEmailGate(false);
    setIsEmailSubmitting(false);
    toast({ title: 'Account captured', description: 'You now have unlimited standalone tool access.' });
  }

  async function handleUpgrade() {
    window.open(TOOLBOX_UPGRADE_URL, '_blank', 'noopener,noreferrer');
    setGateModalType(null);
  }

  const ChipButton = ({
    active,
    label,
    onClick,
    rounded = 'rounded-xl',
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
    rounded?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] ${rounded} border px-3 py-2 text-left text-sm font-semibold transition-colors ${
        active
          ? 'border-[#00d8e5] bg-[#00f2ff]/15 text-[#e6fdff]'
          : 'border-[#2c3e5c] bg-[#101c30] text-[#d2def2] hover:bg-[#152743]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#070d18] text-[#dce7f8]">
      <Header />

      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-24 pt-4 sm:px-5 md:space-y-6 md:px-8 md:pt-8">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" asChild className="h-10 px-2 text-[#b8c8e2] hover:bg-[#13233b] hover:text-[#e6efff]">
            <Link href="/tools">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Tool Shop
            </Link>
          </Button>
          <Badge className="border border-[#00d8e5]/40 bg-[#00f2ff]/10 text-[#6eeef8]">AutoDriveCX</Badge>
        </div>

        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[#f5f9ff] md:text-3xl">Loyalty Loop Designer</h1>
          <p className="max-w-2xl text-sm text-[#a7b7d1] md:text-base">
            Design a repeatable retention rhythm that keeps customers engaged, referral-ready, and connected long-term.
          </p>
          <p className="text-xs uppercase tracking-[0.12em] text-[#6f89af]">Retention by design, not random follow-up</p>
        </section>

        {!canUseBaseTool && (
          <Card className="border-[#3f2a2a] bg-[#231718]">
            <CardHeader>
              <CardTitle className="text-lg text-[#ffe5e5]">Free limit reached</CardTitle>
              <CardDescription className="text-[#f2b6b6]">Add email and role to keep using standalone tools.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="bg-[#76ff8f] text-[#0d1d11] hover:bg-[#92ffa7]" onClick={() => setShowEmailGate(true)}>
                Continue with Free Account
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">1. Relationship Goal Wheel</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Choose the loop outcome you are designing for.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {LOYALTY_GOALS.map((item) => (
                <ChipButton
                  key={item}
                  active={goal === item}
                  label={item}
                  rounded="rounded-full"
                  onClick={() => withUsageTracking(() => setGoal(item))}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">2. Customer State</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Set the relationship baseline.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {LOYALTY_CUSTOMER_TYPES.map((item) => (
              <ChipButton key={item} active={customerType === item} label={item} onClick={() => withUsageTracking(() => setCustomerType(item))} />
            ))}
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">3. Loop Controls</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Tune cadence intensity and tone blend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.12em] text-[#84a0c4]">
                <span>Touch Frequency</span>
                <span>{intensity}</span>
              </div>
              <input
                type="range"
                min={0}
                max={3}
                step={1}
                value={intensitySlider}
                onChange={(event) => withUsageTracking(() => setIntensitySlider(Number(event.target.value)))}
                className="h-2 w-full cursor-pointer accent-[#00d8e5]"
              />
              <div className="grid grid-cols-4 text-[11px] text-[#8ea8cc]">
                {LOYALTY_INTENSITY.map((level) => (
                  <span key={level} className="text-center">{level}</span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.12em] text-[#84a0c4]">
                <span>Tone Blend</span>
                <span>{tone}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={toneBlend}
                onChange={(event) => withUsageTracking(() => setToneBlend(Number(event.target.value)))}
                className="h-2 w-full cursor-pointer accent-[#00d8e5]"
              />
              <div className="flex items-center justify-between text-[11px] text-[#8ea8cc]">
                <span>Practical / Direct</span>
                <span>Personal / Warm</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {LOYALTY_TONE.map((toneOption) => (
                  <ChipButton
                    key={toneOption}
                    active={tone === toneOption}
                    label={toneOption}
                    onClick={() => withUsageTracking(() => {
                      if (toneOption === 'practical') setToneBlend(10);
                      if (toneOption === 'balanced') setToneBlend(50);
                      if (toneOption === 'personal') setToneBlend(90);
                    })}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">4. Touchpoint Stack Builder</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Tap to include and reorder your preferred touch sequence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {LOYALTY_TOUCHPOINTS.map((touchpoint) => {
                const active = preferredTouchpoints.includes(touchpoint);
                return (
                  <ChipButton
                    key={touchpoint}
                    active={active}
                    label={active ? `Included: ${touchpoint}` : touchpoint}
                    onClick={() => toggleTouchpoint(touchpoint)}
                  />
                );
              })}
            </div>

            <div className="space-y-2 rounded-xl border border-[#2c4663] bg-[#0c1a2b] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#89a8ce]">Selected Order</p>
              {preferredTouchpoints.map((touchpoint, index) => (
                <div key={`${touchpoint}-${index}`} className="flex items-center justify-between rounded-lg border border-[#2a3f5a] bg-[#11223a] px-3 py-2">
                  <span className="text-sm text-[#e1ebfa]">{index + 1}. {touchpoint}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-[#9ab7dd] hover:bg-[#1b314f]"
                      onClick={() => moveTouchpoint(index, -1)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-[#9ab7dd] hover:bg-[#1b314f]"
                      onClick={() => moveTouchpoint(index, 1)}
                      disabled={index === preferredTouchpoints.length - 1}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#84a0c4]">Optional context</p>
              <Textarea
                value={context}
                onChange={(event) => withUsageTracking(() => setContext(event.target.value))}
                placeholder="Ex: sold customer loves service convenience but has not left a review yet"
                className="min-h-[78px] border-[#2d4262] bg-[#0d1b30] text-[#e6efff]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#2d4b66] bg-[#10243a]">
          <CardHeader>
            <CardTitle className="text-base text-[#7eeeff]">Live Loop Preview</CardTitle>
            <CardDescription className="text-[#a8bfdc]">Compact view of cadence rhythm and touch mix.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {plan.sequence.map((step, index) => (
              <div key={`${step.weekLabel}-${step.touchpoint}-${index}`} className="rounded-lg border border-[#2b4764] bg-[#0e1f34] p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#eaf3ff]">{step.weekLabel}</p>
                  <Badge className="border border-[#00d8e5]/35 bg-[#00f2ff]/10 text-[#8df4ff]">{step.touchpoint}</Badge>
                </div>
                <p className="text-sm text-[#bed0ea]">{step.action}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[#f4f8ff]">Your Loyalty Plan</h2>

          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Loyalty Loop Summary</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.loopSummary}</p></CardContent>
          </Card>

          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Recommended Touchpoint Sequence</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {plan.sequence.map((step, index) => (
                <p key={`${step.weekLabel}-${index}`} className="text-sm text-[#eff6ff]">
                  <span className="font-semibold">{step.weekLabel}:</span> {step.touchpoint} - {step.action}
                </p>
              ))}
            </CardContent>
          </Card>

          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">What To Send / Say</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {plan.whatToSendOrSay.map((line, index) => (
                <p key={`${line}-${index}`} className="text-sm text-[#eff6ff]">{line}</p>
              ))}
            </CardContent>
          </Card>

          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Best Loyalty Angle</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.bestLoyaltyAngle}</p></CardContent>
          </Card>

          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#ffb8b8]">Do Not Do This</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#ffd8d8]">{plan.doNotDoThis}</p></CardContent>
          </Card>

          <Card className="border-[#233d58] bg-[#0f2238]">
            <CardHeader><CardTitle className="text-base text-[#8ad9ff]">Why This Loop Works</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#d8e8ff]">{plan.whyThisWorks}</p></CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button className="h-11 bg-[#172845] text-[#eaf2ff] hover:bg-[#22375a]" onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
            <Button className="h-11 bg-[#172845] text-[#eaf2ff] hover:bg-[#22375a]" onClick={() => withUsageTracking(handleSaveLocal)}>
              <Save className="mr-2 h-4 w-4" /> Save Local
            </Button>
            <Button
              className="h-11 border border-[#3c5878] bg-[#0f1b30] text-[#dce7f8] hover:bg-[#172845]"
              onClick={() => withUsageTracking(() => {
                void handleSaveCloud();
              })}
              disabled={isCloudSaving}
            >
              <Cloud className="mr-2 h-4 w-4" /> {isCloudSaving ? 'Saving...' : 'Save to Cloud'}
            </Button>
          </div>
        </section>

        <FeatureGate
          feature={FEATURES.SPROCKET}
          entitlements={entitlements}
          fallback={(gate) => (
            <Card className="border-[#2f4568] bg-[#0f1c31]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Insight</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                                <div className="h-px w-full bg-gradient-to-r from-transparent via-[#2f4568] to-transparent" />
                <p className="text-sm text-[#d8e6fb]">There's a smarter way to sequence this conversation based on trust signals, urgency, and customer skepticism.</p>
                <p className="text-sm text-[#c5d6ef]">The system can adapt your wording, proof order, and next move in real time.</p>
                <p className="text-xs uppercase tracking-[0.16em] text-[#8ca5c7]">Unlocked with AutoDriveCX</p>
                <div className="relative overflow-hidden rounded-xl border border-[#2c4464] bg-[#0b1728]/85 p-3">
                  <div className="space-y-2 text-sm text-[#c3d5ec] opacity-70 blur-[8px] select-none pointer-events-none">
                    <p className="font-semibold text-[#f3c46b]">Failure Risk Detected</p>
                    <p>Customer may delay due to...</p>
                    <p className="font-semibold text-[#9fe8ff]">Recommended Shift</p>
                    <p>Lead with...</p>
                    <p className="font-semibold text-[#9fe8ff]">Next Best Action</p>
                    <p>Ask: "If this fails..."</p>
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0b1728] via-[#0b1728]/90 to-transparent" />
                </div>
                <Button
                  className="bg-[#76ff8f] text-[#0d1d11] hover:bg-[#92ffa7]"
                  onClick={() => {
                    if (gate.gate === 'account') {
                      setShowEmailGate(true);
                      return;
                    }
                    setUpgradeContextMessage(gate.message);
                    setGateModalType('paid');
                  }}
                >
                  Unlock Sprocket
                </Button>
              </CardContent>
            </Card>
          )}
        >
          <Card className="border-[#1f4b66] bg-[#0c2236]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Insight</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button className="h-11 bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]" onClick={() => withUsageTracking(handleRunSprocket)}>
                Run Sprocket Enhancement
              </Button>

              {sprocketOutput && (
                <div className="space-y-2 rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                  <p><span className="font-semibold text-[#88f3ff]">Where this loop may fail:</span> {sprocketOutput.likelyFailurePoint}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Better loyalty angle:</span> {sprocketOutput.betterLoyaltyAngle}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Natural rewrite:</span> {sprocketOutput.naturalRewrite}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Delivery coaching:</span> {sprocketOutput.deliveryCoaching}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Stronger next touch:</span> {sprocketOutput.strongerNextTouch}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </FeatureGate>

<Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">Saved Local Loops</CardTitle>
            <CardDescription className="text-[#9cb0cd]">
              {savedScenarios.length} saved on this device. {favoriteCount} favorited.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedScenarios.length === 0 ? (
              <p className="text-sm text-[#90a7ca]">No saved loops yet.</p>
            ) : (
              savedScenarios.slice(0, 6).map((scenario) => (
                <div key={scenario.id} className="rounded-xl border border-[#29415e] bg-[#0c182a] p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#e8f1ff]">{scenario.goal} - {scenario.customerType}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-[#bdd0ea] hover:bg-[#172845] hover:text-[#fff8ca]"
                      onClick={() => toggleFavorite(scenario.id)}
                    >
                      <Star className={`mr-1 h-4 w-4 ${scenario.favorite ? 'fill-[#ffd95e] text-[#ffd95e]' : ''}`} />
                      {scenario.favorite ? 'Favorited' : 'Favorite'}
                    </Button>
                  </div>
                  <p className="text-sm text-[#c9d7ee]">{scenario.loopSummary}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>

      <EmailGateModal
        open={showEmailGate}
        loading={isEmailSubmitting}
        defaultEmail={accountProfile?.email || user?.email || ''}
        defaultRole={accountProfile?.role || 'Sales Consultant'}
        onOpenChange={setShowEmailGate}
        onSubmit={handleUnlockByEmail}
      />

      <UpgradeModal
        open={gateModalType !== null}
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks skill-aware loyalty intelligence.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

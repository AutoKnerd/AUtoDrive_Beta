'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BrainCircuit, ChevronLeft, Cloud, Copy, Save, Sparkles, Star } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { EmailGateModal } from '@/components/tools/email-gate-modal';
import { FeatureGate } from '@/components/tools/feature-gate';
import { UpgradeModal } from '@/components/tools/upgrade-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { applySprocketCxOverlay } from '@/lib/tools/sprocket-cx-overlay';
import {
  WAIT_EXPERIENCE_MOODS,
  WAIT_EXPERIENCE_STAGES,
  getAutoDriveCxWaitExperienceEnhancement,
  getSprocketWaitExperienceEnhancement,
  getWaitExperiencePlan,
  type WaitExperienceInput,
  type WaitExperienceMood,
  type WaitExperienceSavedScenario,
  type WaitExperienceStage,
} from '@/lib/tools/wait-experience-coach';

const TOOL_ID = 'wait-experience-coach';
const LOCAL_SCENARIOS_KEY = 'waitExperienceCoachSavedScenariosV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function readLocalScenarios(): WaitExperienceSavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WaitExperienceSavedScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScenarios(scenarios: WaitExperienceSavedScenario[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios));
}

function buildCloudContent(input: WaitExperienceInput, summary: string): string {
  return [
    'WAIT EXPERIENCE COACH',
    '',
    `Tension Level: ${input.tensionLevel}`,
    `Customer Patience: ${input.customerPatience}`,
    `Lounge Frustration: ${input.loungeFrustration}`,
    `Progress Stage: ${input.progressStage}`,
    `Customer Mood: ${input.customerMood ?? 'not set'}`,
    '',
    summary,
  ].join('\n');
}

function tensionTone(value: number): string {
  if (value >= 75) return 'from-[#ff9f93] via-[#f97875] to-[#d25366]';
  if (value >= 45) return 'from-[#ffd799] via-[#f2bc6c] to-[#e28e56]';
  return 'from-[#77edcb] via-[#58d9df] to-[#49ace8]';
}

export default function WaitExperienceCoachPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [tensionLevel, setTensionLevel] = useState(50);
  const [customerPatience, setCustomerPatience] = useState(60);
  const [loungeFrustration, setLoungeFrustration] = useState(44);
  const [progressStage, setProgressStage] = useState<WaitExperienceStage>('waiting on tech');
  const [customerMood, setCustomerMood] = useState<WaitExperienceMood | null>('calm');
  const [savedScenarios, setSavedScenarios] = useState<WaitExperienceSavedScenario[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketWaitExperienceEnhancement> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxWaitExperienceEnhancement> | null>(null);

  const hasTrackedMeaningfulInteraction = useRef(false);

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
    readFullToolHandoff<{ source?: string; draft?: string }>(TOOL_ID);
    clearFullToolHandoff(TOOL_ID);
  }, []);

  useEffect(() => {
    setSprocketOutput(null);
    setCxOutput(null);
  }, [tensionLevel, customerPatience, loungeFrustration, progressStage, customerMood]);

  const input = useMemo<WaitExperienceInput>(() => ({
    tensionLevel,
    customerPatience,
    loungeFrustration,
    progressStage,
    customerMood,
  }), [tensionLevel, customerPatience, loungeFrustration, progressStage, customerMood]);

  const plan = useMemo(() => getWaitExperiencePlan(input), [input]);
  const favoriteCount = useMemo(() => savedScenarios.filter((entry) => entry.favorite).length, [savedScenarios]);

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
      `[Best Update Approach] ${plan.bestUpdateApproach}`,
      `[Say This Now] ${plan.sayThisNow}`,
      `[Reset Expectations This Way] ${plan.resetExpectationsThisWay}`,
      `[Update Again At This Point] ${plan.updateAgainAtThisPoint}`,
      `[Do Not Say This] ${plan.doNotSayThis}`,
    ].join('\n\n');
    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Wait-experience plan copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [plan, toast]);

  const handleSaveLocal = useCallback(() => {
    const scenario: WaitExperienceSavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      tensionLevel,
      customerPatience,
      loungeFrustration,
      progressStage,
      customerMood,
      bestUpdateApproach: plan.bestUpdateApproach,
      sayThisNow: plan.sayThisNow,
      resetExpectationsThisWay: plan.resetExpectationsThisWay,
      updateAgainAtThisPoint: plan.updateAgainAtThisPoint,
      doNotSayThis: plan.doNotSayThis,
      favorite: false,
    };
    const next = [scenario, ...savedScenarios].slice(0, 40);
    setSavedScenarios(next);
    writeLocalScenarios(next);
    toast({ title: 'Saved locally', description: 'Scenario saved on this device.' });
  }, [tensionLevel, customerPatience, loungeFrustration, progressStage, customerMood, plan, savedScenarios, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock cloud saves to sync wait-experience scenarios.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this scenario.' });
      return;
    }
    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(input, `Best Update Approach: ${plan.bestUpdateApproach}\nSay This Now: ${plan.sayThisNow}`),
    });
    setIsCloudSaving(false);

    if (!result.ok) {
      if (result.code === 'PAYMENT_REQUIRED') {
        setUpgradeContextMessage('Cloud saves require paid AutoShop access.');
        setGateModalType('paid');
      }
      toast({ variant: 'destructive', title: result.message });
      return;
    }
    toast({ title: 'Saved to cloud', description: 'Scenario now syncs across devices.' });
  }, [firebaseUser, input, plan, requireFeature, toast]);

  const handleRunSprocket = useCallback(() => {
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for deeper waiting-customer emotional insight.')) return;
    setSprocketOutput(applySprocketCxOverlay(getSprocketWaitExperienceEnhancement(input, plan), user));
  }, [input, plan, requireFeature]);

  const handleRunAutoDrive = useCallback(() => {
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for personalized waiting-experience guidance.')) return;
    setCxOutput(getAutoDriveCxWaitExperienceEnhancement(input, plan, user));
  }, [input, plan, requireFeature, user]);

  const toggleFavorite = useCallback((scenarioId: string) => {
    const next = savedScenarios.map((scenario) => (
      scenario.id === scenarioId ? { ...scenario, favorite: !scenario.favorite } : scenario
    ));
    setSavedScenarios(next);
    writeLocalScenarios(next);
  }, [savedScenarios]);

  async function handleUnlockByEmail(values: { email: string; role: ToolboxCapturedRole }) {
    const email = values.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      toast({ variant: 'destructive', title: 'Enter a valid email' });
      return;
    }
    setIsEmailSubmitting(true);
    const captureResult = await captureToolboxUnlockEmail({ email, role: values.role });
    if (!captureResult.ok) {
      console.warn('[WaitExperienceCoach] unlock capture failed:', captureResult.message);
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

  const tensionDegrees = Math.round((clamp(tensionLevel) / 100) * 360);

  const ToggleButton = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-all ${
        active
          ? 'border-[#9DEE75] bg-[#9DEE75] text-[#041106] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_0_1px_rgba(157,238,117,0.45),0_8px_20px_rgba(157,238,117,0.22)]'
          : 'border-[#2c3e5c] bg-[#101c30] text-[#d2def2] hover:border-[#4b2b9a] hover:bg-[#152743] hover:text-[#e6e0ff]'
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
            <Link href="/autoshop">
              <ChevronLeft className="mr-1 h-4 w-4" />
              AutoShop
            </Link>
          </Button>
          <Badge className="border border-[#00d8e5]/40 bg-[#00f2ff]/10 text-[#6eeef8]">AutoDriveCX</Badge>
        </div>

        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[#f5f9ff] md:text-3xl">Wait Experience Coach</h1>
          <p className="max-w-2xl text-sm text-[#a7b7d1] md:text-base">
            Improve waiting-customer comfort with clearer updates, better expectation resets, and calmer timing.
          </p>
        </section>

        {!canUseBaseTool && (
          <Card className="border-[#3f2a2a] bg-[#231718]">
            <CardHeader>
              <CardTitle className="text-lg text-[#ffe5e5]">Free limit reached</CardTitle>
              <CardDescription className="text-[#f2b6b6]">Add email and role to keep using standalone tools.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="bg-[#9DEE75] text-[#0d1d11] hover:bg-[#ABF28A]" onClick={() => setShowEmailGate(true)}>
                Continue with Free Account
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
          <Card className="border-[#2a3f5f] bg-[#0f1b30]">
            <CardHeader>
              <CardTitle className="text-lg text-[#eff6ff]">Live Wait Inputs</CardTitle>
              <CardDescription className="text-[#9cb2cf]">Read tension, patience, and service-lane flow at a glance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Wait-Time Tension Bar</p>
                <div className="rounded-xl border border-[#294665] bg-[#0f2238] p-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={tensionLevel}
                    onChange={(event) => withUsageTracking(() => setTensionLevel(clamp(Number(event.target.value))))}
                    className="w-full accent-[#00d8e5]"
                  />
                  <div className="mt-2 flex justify-between text-xs text-[#9ab4d4]">
                    <span>Calm</span>
                    <span className="font-semibold text-[#d9eeff]">{tensionLevel}</span>
                    <span>High tension</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[#10243a]">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${tensionTone(tensionLevel)}`}
                      style={{ width: `${Math.round((tensionDegrees / 360) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Patience Timer</p>
                <div className="rounded-xl border border-[#294665] bg-[#0f2238] p-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={customerPatience}
                    onChange={(event) => withUsageTracking(() => setCustomerPatience(clamp(Number(event.target.value))))}
                    className="w-full accent-[#00d8e5]"
                  />
                  <div className="mt-2 flex justify-between text-xs text-[#9ab4d4]">
                    <span>Low patience</span>
                    <span className="font-semibold text-[#d9eeff]">{customerPatience}</span>
                    <span>High patience</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Lounge Frustration Meter</p>
                <div className="rounded-xl border border-[#294665] bg-[#0f2238] p-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={loungeFrustration}
                    onChange={(event) => withUsageTracking(() => setLoungeFrustration(clamp(Number(event.target.value))))}
                    className="w-full accent-[#00d8e5]"
                  />
                  <div className="mt-2 flex justify-between text-xs text-[#9ab4d4]">
                    <span>Relaxed</span>
                    <span className="font-semibold text-[#d9eeff]">{loungeFrustration}</span>
                    <span>Frustrated</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Service Progress Strip</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {WAIT_EXPERIENCE_STAGES.map((stage) => (
                    <ToggleButton
                      key={stage}
                      active={progressStage === stage}
                      label={stage[0].toUpperCase() + stage.slice(1)}
                      onClick={() => withUsageTracking(() => setProgressStage(stage))}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Customer Mood (Optional)</p>
                <div className="flex flex-wrap gap-2">
                  {WAIT_EXPERIENCE_MOODS.map((mood) => (
                    <button
                      key={mood}
                      type="button"
                      onClick={() => withUsageTracking(() => setCustomerMood(mood))}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                        customerMood === mood
                          ? 'border-[#00d8e5] bg-[#00f2ff]/15 text-[#dffaff]'
                          : 'border-[#2d4567] bg-[#10233a] text-[#b8cde9] hover:bg-[#183154]'
                      }`}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#2a3f5f] bg-[#0f1b30]">
            <CardHeader>
              <CardTitle className="text-lg text-[#f4fbff]">Comfort Plan</CardTitle>
              <CardDescription className="text-[#9cb2cf]">Clear and calming update guidance for this exact moment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Best Update Approach</p>
                <p className="mt-1 text-sm font-semibold text-[#e6f3ff]">{plan.bestUpdateApproach}</p>
              </div>
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Say This Now</p>
                <p className="mt-1 text-sm text-[#d5e9ff]">{plan.sayThisNow}</p>
              </div>
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Reset Expectations This Way</p>
                <p className="mt-1 text-sm text-[#d5e9ff]">{plan.resetExpectationsThisWay}</p>
              </div>
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Update Again At This Point</p>
                <p className="mt-1 text-sm text-[#d5e9ff]">{plan.updateAgainAtThisPoint}</p>
              </div>
              <div className="rounded-xl border border-[#6b3c46] bg-[#291820] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#ffc3cf]">Do Not Say This</p>
                <p className="mt-1 text-sm text-[#ffdce4]">{plan.doNotSayThis}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button className="h-11 bg-[#182945] text-[#e6f0ff] hover:bg-[#253a60]" onClick={handleCopy}>
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
                <Button className="h-11 bg-[#182945] text-[#e6f0ff] hover:bg-[#253a60]" onClick={() => withUsageTracking(handleSaveLocal)}>
                  <Save className="mr-2 h-4 w-4" /> Save Local
                </Button>
                <Button
                  className="h-11 border border-[#3c5878] bg-[#0f1b30] text-[#dce7f8] hover:bg-[#172845]"
                  onClick={() => withUsageTracking(() => { void handleSaveCloud(); })}
                  disabled={isCloudSaving}
                >
                  <Cloud className="mr-2 h-4 w-4" /> {isCloudSaving ? 'Saving...' : 'Save to Cloud'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

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
                  className="bg-[#9DEE75] text-[#0d1d11] hover:bg-[#ABF28A]"
                  onClick={() => {
                    setUpgradeContextMessage('AutoDriveCX unlocks Sprocket Insight.');
                    void handleUpgrade();
                  }}
                >
                  Unlock Sprocket
                </Button>
              </CardContent>
            </Card>
          )}
        >
          <Card className="border-[#1f4b66] bg-[#0c2236]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Insight</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="h-11 bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]" onClick={() => withUsageTracking(handleRunSprocket)}>
                Run Sprocket Enhancement
              </Button>
              {sprocketOutput && (
                <div className="space-y-2 rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                  <p><span className="font-semibold text-[#88f3ff]">Likely emotional risk:</span> {sprocketOutput.likelyEmotionalRisk}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Stronger reset language:</span> {sprocketOutput.strongerResetLanguage}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Natural rewrite:</span> {sprocketOutput.naturalRewrite}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Update tone coaching:</span> {sprocketOutput.updateToneCoaching}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </FeatureGate>

<Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">Saved Scenarios</CardTitle>
            <CardDescription className="text-[#9cb0cd]">
              {savedScenarios.length} saved on this device · {favoriteCount} favorites.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedScenarios.length === 0 ? (
              <p className="text-sm text-[#90a7ca]">No saved scenarios yet.</p>
            ) : (
              savedScenarios.slice(0, 8).map((scenario) => (
                <div key={scenario.id} className="rounded-xl border border-[#29415e] bg-[#0c182a] p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#e8f1ff]">
                      {scenario.progressStage[0].toUpperCase() + scenario.progressStage.slice(1)} · tension {scenario.tensionLevel}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-8 px-2 ${scenario.favorite ? 'text-[#ffe69b]' : 'text-[#bdd0ea]'} hover:bg-[#172845]`}
                      onClick={() => toggleFavorite(scenario.id)}
                    >
                      <Star className="mr-1 h-4 w-4" />
                      {scenario.favorite ? 'Favorited' : 'Favorite'}
                    </Button>
                  </div>
                  <p className="text-sm text-[#c9d7ee]">{scenario.bestUpdateApproach}</p>
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
        defaultRole={accountProfile?.role || 'Consultant'}
        onOpenChange={setShowEmailGate}
        onSubmit={handleUnlockByEmail}
      />

      <UpgradeModal
        open={gateModalType !== null}
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks skill-aware wait-experience coaching.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

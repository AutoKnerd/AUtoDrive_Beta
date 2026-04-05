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
  enhanceSprocketInsight,
  saveToolboxEntry,
} from '@/lib/tools/toolbox-client';
import { clearFullToolHandoff, readFullToolHandoff } from '@/lib/tools/toolbox-storage';
import { applySprocketCxOverlay } from '@/lib/tools/sprocket-cx-overlay';
import { readUserCxStatScore } from '@/lib/tools/cx-stats';
import {
  PICKUP_CHECKPOINTS,
  PICKUP_IMPRESSIONS,
  PICKUP_TYPES,
  getAutoDriveCxPickupExperienceEnhancement,
  getPickupExperiencePlan,
  getSprocketPickupExperienceEnhancement,
  type PickupCheckpoint,
  type PickupExperienceInput,
  type PickupExperienceSavedScenario,
  type PickupImpression,
  type PickupType,
} from '@/lib/tools/pickup-experience-designer';

const TOOL_ID = 'pickup-experience-designer';
const LOCAL_SCENARIOS_KEY = 'pickupExperienceDesignerSavedScenariosV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function readLocalScenarios(): PickupExperienceSavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PickupExperienceSavedScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScenarios(scenarios: PickupExperienceSavedScenario[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios));
}

function buildCloudContent(input: PickupExperienceInput, summary: string): string {
  return [
    'PICKUP EXPERIENCE DESIGNER',
    '',
    `Completion Confidence: ${input.completionConfidence}`,
    `Explanation Depth: ${input.explanationDepth}`,
    `Satisfaction Checkpoints: ${input.satisfactionCheckpoints.join(', ') || 'none'}`,
    `Final Impression: ${input.desiredFinalImpression}`,
    `Pickup Type: ${input.pickupType ?? 'not set'}`,
    '',
    summary,
  ].join('\n');
}

function confidenceTone(value: number): string {
  if (value < 40) return 'from-[#ff9f92] via-[#f87976] to-[#d05266]';
  if (value < 70) return 'from-[#ffd795] via-[#f2bc69] to-[#e28f56]';
  return 'from-[#76ecc9] via-[#59d8df] to-[#4aace8]';
}

export default function PickupExperienceDesignerPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [completionConfidence, setCompletionConfidence] = useState(64);
  const [explanationDepth, setExplanationDepth] = useState(46);
  const [satisfactionCheckpoints, setSatisfactionCheckpoints] = useState<PickupCheckpoint[]>([
    'work completed',
    'invoice clarity',
    'vehicle ready',
  ]);
  const [desiredFinalImpression, setDesiredFinalImpression] = useState<PickupImpression>('reassuring');
  const [pickupType, setPickupType] = useState<PickupType | null>('same-day');
  const [savedScenarios, setSavedScenarios] = useState<PickupExperienceSavedScenario[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketPickupExperienceEnhancement> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxPickupExperienceEnhancement> | null>(null);

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
  }, [completionConfidence, explanationDepth, satisfactionCheckpoints, desiredFinalImpression, pickupType]);

  const input = useMemo<PickupExperienceInput>(() => ({
    completionConfidence,
    explanationDepth,
    satisfactionCheckpoints,
    desiredFinalImpression,
    pickupType,
  }), [completionConfidence, explanationDepth, satisfactionCheckpoints, desiredFinalImpression, pickupType]);

  const plan = useMemo(() => getPickupExperiencePlan(input), [input]);
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

  const toggleCheckpoint = useCallback((checkpoint: PickupCheckpoint) => {
    withUsageTracking(() => {
      setSatisfactionCheckpoints((prev) => (
        prev.includes(checkpoint)
          ? prev.filter((item) => item !== checkpoint)
          : [...prev, checkpoint]
      ));
    });
  }, [withUsageTracking]);

  const handleCopy = useCallback(async () => {
    const payload = [
      `[Best Pickup Flow] ${plan.bestPickupFlow}`,
      `[Say This Recap] ${plan.sayThisRecap}`,
      `[Explain This Clearly] ${plan.explainThisClearly}`,
      `[Ownership Next Step] ${plan.ownershipNextStep}`,
      `[Do Not Do This] ${plan.doNotDoThis}`,
    ].join('\n\n');
    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Pickup-experience plan copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [plan, toast]);

  const handleSaveLocal = useCallback(() => {
    const scenario: PickupExperienceSavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      completionConfidence,
      explanationDepth,
      satisfactionCheckpoints,
      desiredFinalImpression,
      pickupType,
      bestPickupFlow: plan.bestPickupFlow,
      sayThisRecap: plan.sayThisRecap,
      explainThisClearly: plan.explainThisClearly,
      ownershipNextStep: plan.ownershipNextStep,
      doNotDoThis: plan.doNotDoThis,
      favorite: false,
    };
    const next = [scenario, ...savedScenarios].slice(0, 40);
    setSavedScenarios(next);
    writeLocalScenarios(next);
    toast({ title: 'Saved locally', description: 'Scenario saved on this device.' });
  }, [completionConfidence, explanationDepth, satisfactionCheckpoints, desiredFinalImpression, pickupType, plan, savedScenarios, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock cloud saves to sync pickup-experience scenarios.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this scenario.' });
      return;
    }
    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(input, `Best Pickup Flow: ${plan.bestPickupFlow}\nSay This Recap: ${plan.sayThisRecap}`),
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
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for deeper pickup-friction diagnosis and recap coaching.')) return;
    const baseOutput = applySprocketCxOverlay(getSprocketPickupExperienceEnhancement(input, plan), user);

    const cxSummary = user?.hasAutoDriveCX
      ? `Trust ${Math.round(readUserCxStatScore(user, 'trust'))}, Listening ${Math.round(readUserCxStatScore(user, 'listening'))}, Follow-Up ${Math.round(readUserCxStatScore(user, 'followUp'))}, Closing ${Math.round(readUserCxStatScore(user, 'closing'))}`
      : undefined;

    setSprocketOutput(baseOutput);

    void (async () => {
      const aiResult = await enhanceSprocketInsight({
        toolId: TOOL_ID,
        userRole: user?.role,
        cxSummary,
        output: {
          likelyFriction: baseOutput.likelyFriction,
          smarterReset: baseOutput.smarterReset,
          recapRewrite: baseOutput.recapRewrite,
          coachingAdjustment: baseOutput.coachingAdjustment,
        },
      });

      if (!aiResult.ok) return;

      setSprocketOutput({
        likelyFriction: aiResult.data.output.likelyFriction || baseOutput.likelyFriction,
        smarterReset: aiResult.data.output.smarterReset || baseOutput.smarterReset,
        recapRewrite: aiResult.data.output.recapRewrite || baseOutput.recapRewrite,
        coachingAdjustment: aiResult.data.output.coachingAdjustment || baseOutput.coachingAdjustment,
      });
    })();
  }, [input, plan, requireFeature, user]);

  const handleRunAutoDrive = useCallback(() => {
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for personalized pickup-experience adaptation.')) return;
    setCxOutput(getAutoDriveCxPickupExperienceEnhancement(input, plan, user));
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
      console.warn('[PickupExperienceDesigner] unlock capture failed:', captureResult.message);
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

  const confidenceDegrees = Math.round((clamp(completionConfidence) / 100) * 360);

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
          <h1 className="text-2xl font-semibold tracking-tight text-[#f5f9ff] md:text-3xl">Pickup Experience Designer</h1>
          <p className="max-w-2xl text-sm text-[#a7b7d1] md:text-base">
            Design a cleaner, more satisfying pickup with structured recap language and clear ownership next steps.
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
              <CardTitle className="text-lg text-[#eff6ff]">Completion Inputs</CardTitle>
              <CardDescription className="text-[#9cb2cf]">Tune confidence, depth, checkpoints, and final impression.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Completion Confidence Ring</p>
                <div className="flex items-center gap-4 rounded-xl border border-[#294665] bg-[#0f2238] p-3">
                  <div
                    className={`grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br ${confidenceTone(completionConfidence)}`}
                    style={{ boxShadow: 'inset 0 0 0 5px rgba(6,18,35,0.6)' }}
                  >
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-[#081727] text-sm font-bold text-[#e8f5ff]">
                      {completionConfidence}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={completionConfidence}
                      onChange={(event) => withUsageTracking(() => setCompletionConfidence(clamp(Number(event.target.value))))}
                      className="w-full accent-[#00d8e5]"
                    />
                    <div className="flex justify-between text-xs text-[#9ab4d4]">
                      <span>Uncertain</span>
                      <span>Confident</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#10243a]">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${confidenceTone(completionConfidence)}`}
                        style={{ width: `${Math.round((confidenceDegrees / 360) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Explanation Depth</p>
                <div className="rounded-xl border border-[#294665] bg-[#0f2238] p-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={explanationDepth}
                    onChange={(event) => withUsageTracking(() => setExplanationDepth(clamp(Number(event.target.value))))}
                    className="w-full accent-[#00d8e5]"
                  />
                  <div className="mt-2 flex justify-between text-xs text-[#9ab4d4]">
                    <span>Very simple</span>
                    <span className="font-semibold text-[#d9eeff]">{explanationDepth}</span>
                    <span>Detailed</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Satisfaction Checkpoint Stack</p>
                <div className="flex flex-wrap gap-2">
                  {PICKUP_CHECKPOINTS.map((checkpoint) => {
                    const active = satisfactionCheckpoints.includes(checkpoint);
                    return (
                      <button
                        key={checkpoint}
                        type="button"
                        onClick={() => toggleCheckpoint(checkpoint)}
                        className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                          active
                            ? 'border-[#00d8e5] bg-[#00f2ff]/15 text-[#dffaff]'
                            : 'border-[#2d4567] bg-[#10233a] text-[#b8cde9] hover:bg-[#183154]'
                        }`}
                      >
                        {checkpoint}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Final Impression Selector</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PICKUP_IMPRESSIONS.map((item) => (
                    <ToggleButton
                      key={item}
                      active={desiredFinalImpression === item}
                      label={item[0].toUpperCase() + item.slice(1)}
                      onClick={() => withUsageTracking(() => setDesiredFinalImpression(item))}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Pickup Type (Optional)</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {PICKUP_TYPES.map((item) => (
                    <ToggleButton
                      key={item}
                      active={pickupType === item}
                      label={item[0].toUpperCase() + item.slice(1)}
                      onClick={() => withUsageTracking(() => setPickupType(item))}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#2a3f5f] bg-[#0f1b30]">
            <CardHeader>
              <CardTitle className="text-lg text-[#f4fbff]">Pickup Plan</CardTitle>
              <CardDescription className="text-[#9cb2cf]">Organized recap + confident closeout guidance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Best Pickup Flow</p>
                <p className="mt-1 text-sm font-semibold text-[#e6f3ff]">{plan.bestPickupFlow}</p>
              </div>
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Say This Recap</p>
                <p className="mt-1 text-sm text-[#d5e9ff]">{plan.sayThisRecap}</p>
              </div>
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Explain This Clearly</p>
                <p className="mt-1 text-sm text-[#d5e9ff]">{plan.explainThisClearly}</p>
              </div>
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Ownership Next Step</p>
                <p className="mt-1 text-sm text-[#d5e9ff]">{plan.ownershipNextStep}</p>
              </div>
              <div className="rounded-xl border border-[#6b3c46] bg-[#291820] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#ffc3cf]">Do Not Do This</p>
                <p className="mt-1 text-sm text-[#ffdce4]">{plan.doNotDoThis}</p>
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
                  <p><span className="font-semibold text-[#88f3ff]">Likely pickup friction:</span> {sprocketOutput.likelyPickupFrictionPoint}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Better recap sequence:</span> {sprocketOutput.betterRecapSequence}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Natural rewrite:</span> {sprocketOutput.naturalRewrite}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Final impression coaching:</span> {sprocketOutput.finalImpressionCoaching}</p>
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
                      {scenario.desiredFinalImpression[0].toUpperCase() + scenario.desiredFinalImpression.slice(1)} · confidence {scenario.completionConfidence}
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
                  <p className="text-sm text-[#c9d7ee]">{scenario.bestPickupFlow}</p>
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
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks skill-aware pickup-experience coaching.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

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
import {
  PRESSURE_DROP_PATHS,
  PRESSURE_DROP_TRIGGERS,
  getAutoDriveCxPressureDropEnhancement,
  getPressureDropPlan,
  getSprocketPressureDropEnhancement,
  type PressureDropInput,
  type PressureDropPath,
  type PressureDropSavedScenario,
  type PressureDropTrigger,
} from '@/lib/tools/pressure-drop-planner';

const TOOL_ID = 'pressure-drop-planner';
const LOCAL_SCENARIOS_KEY = 'pressureDropPlannerSavedScenariosV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function readLocalScenarios(): PressureDropSavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PressureDropSavedScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScenarios(scenarios: PressureDropSavedScenario[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios));
}

function buildCloudContent(input: PressureDropInput, summary: string): string {
  return [
    'PRESSURE DROP PLANNER',
    '',
    `Pressure Level: ${input.currentPressureLevel}`,
    `Customer Defensiveness: ${input.customerDefensiveness}`,
    `Consultant Intensity: ${input.consultantIntensity}`,
    `De-Escalation Path: ${input.preferredDeEscalationPath}`,
    `Trigger: ${input.trigger ?? 'not set'}`,
    '',
    summary,
  ].join('\n');
}

function pressureTone(value: number): string {
  if (value >= 75) return 'from-[#ff9b8d] via-[#f77473] to-[#cf4f63]';
  if (value >= 45) return 'from-[#ffd697] via-[#f2b66c] to-[#e18a57]';
  return 'from-[#74ebc9] via-[#4ed6dc] to-[#4dace8]';
}

export default function PressureDropPlannerPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [currentPressureLevel, setCurrentPressureLevel] = useState(58);
  const [customerDefensiveness, setCustomerDefensiveness] = useState(54);
  const [consultantIntensity, setConsultantIntensity] = useState(60);
  const [preferredDeEscalationPath, setPreferredDeEscalationPath] = useState<PressureDropPath>('clarify');
  const [trigger, setTrigger] = useState<PressureDropTrigger | null>('numbers');
  const [savedScenarios, setSavedScenarios] = useState<PressureDropSavedScenario[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketPressureDropEnhancement> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxPressureDropEnhancement> | null>(null);

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
  }, [currentPressureLevel, customerDefensiveness, consultantIntensity, preferredDeEscalationPath, trigger]);

  const input = useMemo<PressureDropInput>(() => ({
    currentPressureLevel,
    customerDefensiveness,
    consultantIntensity,
    preferredDeEscalationPath,
    trigger,
  }), [currentPressureLevel, customerDefensiveness, consultantIntensity, preferredDeEscalationPath, trigger]);

  const plan = useMemo(() => getPressureDropPlan(input), [input]);
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
      `[Best Pressure Drop Move] ${plan.bestPressureDropMove}`,
      `[Say This] ${plan.sayThis}`,
      `[Reassure This Way] ${plan.reassureThisWay}`,
      `[Next Safe Step] ${plan.nextSafeStep}`,
      `[Do Not Do This] ${plan.doNotDoThis}`,
    ].join('\n\n');
    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Pressure-drop plan copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [plan, toast]);

  const handleSaveLocal = useCallback(() => {
    const scenario: PressureDropSavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      currentPressureLevel,
      customerDefensiveness,
      consultantIntensity,
      preferredDeEscalationPath,
      trigger,
      bestPressureDropMove: plan.bestPressureDropMove,
      sayThis: plan.sayThis,
      reassureThisWay: plan.reassureThisWay,
      nextSafeStep: plan.nextSafeStep,
      doNotDoThis: plan.doNotDoThis,
      favorite: false,
    };
    const next = [scenario, ...savedScenarios].slice(0, 40);
    setSavedScenarios(next);
    writeLocalScenarios(next);
    toast({ title: 'Saved locally', description: 'Scenario saved on this device.' });
  }, [currentPressureLevel, customerDefensiveness, consultantIntensity, preferredDeEscalationPath, trigger, plan, savedScenarios, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock cloud saves to sync pressure-drop scenarios.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this scenario.' });
      return;
    }
    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(input, `Best Pressure Drop Move: ${plan.bestPressureDropMove}\nSay This: ${plan.sayThis}`),
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
    toast({ title: 'Saved to cloud', description: 'Scenario now syncs across devices.' });
  }, [firebaseUser, input, plan, requireFeature, toast]);

  const handleRunSprocket = useCallback(() => {
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for deeper pressure-spike diagnosis.')) return;
    setSprocketOutput(getSprocketPressureDropEnhancement(input, plan));
  }, [input, plan, requireFeature]);

  const handleRunAutoDrive = useCallback(() => {
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for personalized de-escalation coaching.')) return;
    setCxOutput(getAutoDriveCxPressureDropEnhancement(input, plan, user));
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
      console.warn('[PressureDropPlanner] unlock capture failed:', captureResult.message);
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

  const pressureDegrees = Math.round((clamp(currentPressureLevel) / 100) * 360);

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
      className={`min-h-[44px] rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${
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
          <h1 className="text-2xl font-semibold tracking-tight text-[#f5f9ff] md:text-3xl">Pressure Drop Planner</h1>
          <p className="max-w-2xl text-sm text-[#a7b7d1] md:text-base">
            Lower customer tension without losing momentum by choosing the right de-escalation path in real time.
          </p>
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

        <div className="grid gap-5 md:grid-cols-[1.1fr_1fr]">
          <Card className="border-[#2a3f5f] bg-[#0f1b30]">
            <CardHeader>
              <CardTitle className="text-lg text-[#eff6ff]">Pressure Controls</CardTitle>
              <CardDescription className="text-[#9cb2cf]">Make emotional temperature visible and controllable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Pressure Gauge</p>
                <div className="flex items-center gap-4 rounded-xl border border-[#294665] bg-[#0f2238] p-3">
                  <div
                    className={`grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br ${pressureTone(currentPressureLevel)}`}
                    style={{ boxShadow: 'inset 0 0 0 5px rgba(6,18,35,0.6)' }}
                  >
                    <div className="grid h-14 w-14 place-items-center rounded-full bg-[#081727] text-sm font-bold text-[#e8f5ff]">
                      {currentPressureLevel}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={currentPressureLevel}
                      onChange={(event) => withUsageTracking(() => setCurrentPressureLevel(clamp(Number(event.target.value))))}
                      className="w-full accent-[#00d8e5]"
                    />
                    <div className="flex justify-between text-xs text-[#9ab4d4]">
                      <span>Low pressure</span>
                      <span>High pressure</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#10243a]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#5bd0ec] via-[#f2b467] to-[#e96c78]"
                        style={{ width: `${Math.round((pressureDegrees / 360) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Customer Defensiveness</p>
                <div className="rounded-xl border border-[#294665] bg-[#0f2238] p-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={customerDefensiveness}
                    onChange={(event) => withUsageTracking(() => setCustomerDefensiveness(clamp(Number(event.target.value))))}
                    className="w-full accent-[#00d8e5]"
                  />
                  <div className="mt-2 flex justify-between text-xs text-[#9ab4d4]">
                    <span>Open</span>
                    <span className="font-semibold text-[#d9eeff]">{customerDefensiveness}</span>
                    <span>Defensive</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Consultant Intensity</p>
                <div className="rounded-xl border border-[#294665] bg-[#0f2238] p-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={consultantIntensity}
                    onChange={(event) => withUsageTracking(() => setConsultantIntensity(clamp(Number(event.target.value))))}
                    className="w-full accent-[#00d8e5]"
                  />
                  <div className="mt-2 flex justify-between text-xs text-[#9ab4d4]">
                    <span>Calm</span>
                    <span className="font-semibold text-[#d9eeff]">{consultantIntensity}</span>
                    <span>Intense</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">De-Escalation Path</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {PRESSURE_DROP_PATHS.map((path) => (
                    <ToggleButton
                      key={path}
                      active={preferredDeEscalationPath === path}
                      label={path[0].toUpperCase() + path.slice(1)}
                      onClick={() => withUsageTracking(() => setPreferredDeEscalationPath(path))}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Trigger (Optional)</p>
                <div className="flex flex-wrap gap-2">
                  {PRESSURE_DROP_TRIGGERS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => withUsageTracking(() => setTrigger(item))}
                      className={`rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                        trigger === item
                          ? 'border-[#00d8e5] bg-[#00f2ff]/15 text-[#dffaff]'
                          : 'border-[#2d4567] bg-[#10233a] text-[#b8cde9] hover:bg-[#183154]'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#2a3f5f] bg-[#0f1b30]">
            <CardHeader>
              <CardTitle className="text-lg text-[#f4fbff]">Pressure Drop Output</CardTitle>
              <CardDescription className="text-[#9cb2cf]">Use this to reduce tension and keep trust intact.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Best Pressure Drop Move</p>
                <p className="mt-1 text-sm font-semibold text-[#e6f3ff]">{plan.bestPressureDropMove}</p>
              </div>
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Say This</p>
                <p className="mt-1 text-sm text-[#d5e9ff]">{plan.sayThis}</p>
              </div>
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Reassure This Way</p>
                <p className="mt-1 text-sm text-[#d5e9ff]">{plan.reassureThisWay}</p>
              </div>
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Next Safe Step</p>
                <p className="mt-1 text-sm text-[#d5e9ff]">{plan.nextSafeStep}</p>
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
                <CardTitle className="flex items-center gap-2 text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Layer</CardTitle>
                <CardDescription className="text-[#9cb0cd]">Deeper pressure diagnosis and tone guidance.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-[#b8c8e2]">{gate.message}</p>
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Layer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="h-11 bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]" onClick={() => withUsageTracking(handleRunSprocket)}>
                Run Sprocket Enhancement
              </Button>
              {sprocketOutput && (
                <div className="space-y-2 rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                  <p><span className="font-semibold text-[#88f3ff]">Likely spike reason:</span> {sprocketOutput.likelySpikeReason}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Better path:</span> {sprocketOutput.betterDeEscalationPath}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Natural rewrite:</span> {sprocketOutput.naturalRewrite}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Tone coaching:</span> {sprocketOutput.toneCoaching}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </FeatureGate>

        <FeatureGate
          feature={FEATURES.AUTODRIVE_CX}
          entitlements={entitlements}
          fallback={(gate) => (
            <Card className="border-[#35556f] bg-[#101f33]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#9ff5ff]"><BrainCircuit className="h-4 w-4" /> AutoDriveCX Layer</CardTitle>
                <CardDescription className="text-[#9cb0cd]">Skill-aware de-escalation personalization.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-[#b8c8e2]">{gate.message}</p>
                <Button
                  className="bg-[#76ff8f] text-[#0d1d11] hover:bg-[#92ffa7]"
                  onClick={() => {
                    if (gate.gate === 'account') {
                      setShowEmailGate(true);
                      return;
                    }
                    setUpgradeContextMessage(gate.message);
                    setGateModalType(gate.gate === 'autodrive_cx' ? 'autodrive_cx' : 'paid');
                  }}
                >
                  Unlock AutoDriveCX
                </Button>
              </CardContent>
            </Card>
          )}
        >
          <Card className="border-[#2f516f] bg-[#10253b]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#9ff5ff]"><BrainCircuit className="h-4 w-4" /> AutoDriveCX Layer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="h-11 bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]" onClick={() => withUsageTracking(handleRunAutoDrive)}>
                Personalize with AutoDriveCX
              </Button>
              {cxOutput && (
                <div className="space-y-2 rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                  <p><span className="font-semibold text-[#88f3ff]">Why this is tailored:</span> {cxOutput.tailoredReason}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Adjusted approach:</span> {cxOutput.adjustedApproach}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Focus skill:</span> {cxOutput.focusSkillTag}</p>
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
                      {scenario.preferredDeEscalationPath[0].toUpperCase() + scenario.preferredDeEscalationPath.slice(1)} · pressure {scenario.currentPressureLevel}
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
                  <p className="text-sm text-[#c9d7ee]">{scenario.bestPressureDropMove}</p>
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
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks skill-aware de-escalation guidance.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

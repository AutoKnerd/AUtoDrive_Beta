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
  REPAIR_TRUST_PROOF_POINTS,
  REPAIR_TRUST_TYPES,
  REPAIR_TRUST_URGENCY,
  getAutoDriveCxRepairTrustEnhancement,
  getRepairTrustPlan,
  getSprocketRepairTrustEnhancement,
  type RepairTrustInput,
  type RepairTrustProofPoint,
  type RepairTrustSavedScenario,
  type RepairTrustType,
  type RepairTrustUrgency,
} from '@/lib/tools/repair-trust-builder';

const TOOL_ID = 'repair-trust-builder';
const LOCAL_SCENARIOS_KEY = 'repairTrustBuilderSavedScenariosV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function readLocalScenarios(): RepairTrustSavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RepairTrustSavedScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScenarios(scenarios: RepairTrustSavedScenario[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios));
}

function buildCloudContent(input: RepairTrustInput, summary: string): string {
  return [
    'REPAIR TRUST BUILDER',
    '',
    `Trust Level: ${input.trustLevel}`,
    `Urgency: ${input.urgency}`,
    `Skepticism Level: ${input.skepticismLevel}`,
    `Proof Points: ${input.selectedProofPoints.join(', ') || 'none'}`,
    `Repair Type: ${input.repairType ?? 'not set'}`,
    '',
    summary,
  ].join('\n');
}

function trustTone(value: number): string {
  if (value <= 35) return 'from-[#ff9c8d] via-[#f67876] to-[#d15266]';
  if (value <= 65) return 'from-[#ffd798] via-[#f4bf71] to-[#e5965a]';
  return 'from-[#7cedc8] via-[#56d9df] to-[#48aee8]';
}

export default function RepairTrustBuilderPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [trustLevel, setTrustLevel] = useState(52);
  const [urgency, setUrgency] = useState<RepairTrustUrgency>('medium');
  const [skepticismLevel, setSkepticismLevel] = useState(58);
  const [selectedProofPoints, setSelectedProofPoints] = useState<RepairTrustProofPoint[]>([
    'technician findings',
    'wear evidence',
  ]);
  const [repairType, setRepairType] = useState<RepairTrustType | null>('maintenance');
  const [savedScenarios, setSavedScenarios] = useState<RepairTrustSavedScenario[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketRepairTrustEnhancement> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxRepairTrustEnhancement> | null>(null);

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
  }, [trustLevel, urgency, skepticismLevel, selectedProofPoints, repairType]);

  const input = useMemo<RepairTrustInput>(() => ({
    trustLevel,
    urgency,
    skepticismLevel,
    selectedProofPoints,
    repairType,
  }), [trustLevel, urgency, skepticismLevel, selectedProofPoints, repairType]);

  const plan = useMemo(() => getRepairTrustPlan(input), [input]);
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

  const toggleProofPoint = useCallback((point: RepairTrustProofPoint) => {
    withUsageTracking(() => {
      setSelectedProofPoints((prev) => (
        prev.includes(point)
          ? prev.filter((item) => item !== point)
          : [...prev, point]
      ));
    });
  }, [withUsageTracking]);

  const handleCopy = useCallback(async () => {
    const payload = [
      `[Best Trust-First Explanation] ${plan.bestTrustFirstExplanation}`,
      `[Show / Explain This First] ${plan.showExplainThisFirst}`,
      `[Say This] ${plan.sayThis}`,
      `[Ask This] ${plan.askThis}`,
      `[Do Not Do This] ${plan.doNotDoThis}`,
    ].join('\n\n');
    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Repair-trust plan copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [plan, toast]);

  const handleSaveLocal = useCallback(() => {
    const scenario: RepairTrustSavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      trustLevel,
      urgency,
      skepticismLevel,
      selectedProofPoints,
      repairType,
      bestTrustFirstExplanation: plan.bestTrustFirstExplanation,
      showExplainThisFirst: plan.showExplainThisFirst,
      sayThis: plan.sayThis,
      askThis: plan.askThis,
      doNotDoThis: plan.doNotDoThis,
      favorite: false,
    };
    const next = [scenario, ...savedScenarios].slice(0, 40);
    setSavedScenarios(next);
    writeLocalScenarios(next);
    toast({ title: 'Saved locally', description: 'Scenario saved on this device.' });
  }, [trustLevel, urgency, skepticismLevel, selectedProofPoints, repairType, plan, savedScenarios, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock cloud saves to sync repair-trust scenarios.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this scenario.' });
      return;
    }
    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(input, `Best Trust-First Explanation: ${plan.bestTrustFirstExplanation}\nSay This: ${plan.sayThis}`),
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
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for deeper trust-barrier diagnosis and proof sequencing.')) return;
    setSprocketOutput(applySprocketCxOverlay(getSprocketRepairTrustEnhancement(input, plan), user));
  }, [input, plan, requireFeature]);

  const handleRunAutoDrive = useCallback(() => {
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for personalized trust-building guidance.')) return;
    setCxOutput(getAutoDriveCxRepairTrustEnhancement(input, plan, user));
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
      console.warn('[RepairTrustBuilder] unlock capture failed:', captureResult.message);
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

  const trustDegrees = Math.round((clamp(trustLevel) / 100) * 360);

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
          <h1 className="text-2xl font-semibold tracking-tight text-[#f5f9ff] md:text-3xl">Repair Trust Builder</h1>
          <p className="max-w-2xl text-sm text-[#a7b7d1] md:text-base">
            Build transparent, customer-centered repair recommendations that increase trust without pressure.
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
              <CardTitle className="text-lg text-[#eff6ff]">Trust Inputs</CardTitle>
              <CardDescription className="text-[#9cb2cf]">Map trust, urgency, skepticism, and proof path.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Trust Slider</p>
                <div className="rounded-xl border border-[#294665] bg-[#0f2238] p-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={trustLevel}
                    onChange={(event) => withUsageTracking(() => setTrustLevel(clamp(Number(event.target.value))))}
                    className="w-full accent-[#00d8e5]"
                  />
                  <div className="mt-2 flex justify-between text-xs text-[#9ab4d4]">
                    <span>Low trust</span>
                    <span className="font-semibold text-[#d9eeff]">{trustLevel}</span>
                    <span>High trust</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[#10243a]">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${trustTone(trustLevel)}`}
                      style={{ width: `${Math.round((trustDegrees / 360) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Urgency Ladder</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {REPAIR_TRUST_URGENCY.map((item) => (
                    <ToggleButton
                      key={item}
                      active={urgency === item}
                      label={item[0].toUpperCase() + item.slice(1)}
                      onClick={() => withUsageTracking(() => setUrgency(item))}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Skepticism Toggle</p>
                <div className="rounded-xl border border-[#294665] bg-[#0f2238] p-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={skepticismLevel}
                    onChange={(event) => withUsageTracking(() => setSkepticismLevel(clamp(Number(event.target.value))))}
                    className="w-full accent-[#00d8e5]"
                  />
                  <div className="mt-2 flex justify-between text-xs text-[#9ab4d4]">
                    <span>Open</span>
                    <span className="font-semibold text-[#d9eeff]">{skepticismLevel}</span>
                    <span>Skeptical</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Proof Stack Builder</p>
                <div className="flex flex-wrap gap-2">
                  {REPAIR_TRUST_PROOF_POINTS.map((point) => {
                    const active = selectedProofPoints.includes(point);
                    return (
                      <button
                        key={point}
                        type="button"
                        onClick={() => toggleProofPoint(point)}
                        className={`rounded-full border px-3 py-2 text-xs font-semibold transition-all ${
                          active
                            ? 'border-[#00d8e5] bg-[#00f2ff]/15 text-[#dffaff]'
                            : 'border-[#2d4567] bg-[#10233a] text-[#b8cde9] hover:bg-[#183154]'
                        }`}
                      >
                        {point}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#7fa7cf]">Repair Type (Optional)</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {REPAIR_TRUST_TYPES.map((item) => (
                    <ToggleButton
                      key={item}
                      active={repairType === item}
                      label={item[0].toUpperCase() + item.slice(1)}
                      onClick={() => withUsageTracking(() => setRepairType(item))}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#2a3f5f] bg-[#0f1b30]">
            <CardHeader>
              <CardTitle className="text-lg text-[#f4fbff]">Trust-First Output</CardTitle>
              <CardDescription className="text-[#9cb2cf]">Evidence-based wording to reduce skepticism.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Best Trust-First Explanation</p>
                <p className="mt-1 text-sm font-semibold text-[#e6f3ff]">{plan.bestTrustFirstExplanation}</p>
              </div>
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Show / Explain This First</p>
                <p className="mt-1 text-sm text-[#d5e9ff]">{plan.showExplainThisFirst}</p>
              </div>
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Say This</p>
                <p className="mt-1 text-sm text-[#d5e9ff]">{plan.sayThis}</p>
              </div>
              <div className="rounded-xl border border-[#2b4d6f] bg-[#10253d] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Ask This</p>
                <p className="mt-1 text-sm text-[#d5e9ff]">{plan.askThis}</p>
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
                  <p><span className="font-semibold text-[#88f3ff]">Likely trust barrier:</span> {sprocketOutput.likelyTrustBarrier}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Sharper proof sequence:</span> {sprocketOutput.sharperProofSequence}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Natural rewrite:</span> {sprocketOutput.naturalRewrite}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Coaching:</span> {sprocketOutput.confidenceWithoutPressureCoaching}</p>
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
                      {scenario.urgency[0].toUpperCase() + scenario.urgency.slice(1)} urgency · trust {scenario.trustLevel}
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
                  <p className="text-sm text-[#c9d7ee]">{scenario.bestTrustFirstExplanation}</p>
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
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks skill-aware repair-trust coaching.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

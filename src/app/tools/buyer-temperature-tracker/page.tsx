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
  BUYER_TEMPERATURE_STAGES,
  getAutoDriveCxBuyerTemperatureEnhancement,
  getBuyerTemperaturePlan,
  getSprocketBuyerTemperatureEnhancement,
  type BuyerTemperatureInput,
  type BuyerTemperatureSavedScenario,
  type BuyerTemperatureStage,
} from '@/lib/tools/buyer-temperature-tracker';

const TOOL_ID = 'buyer-temperature-tracker';
const LOCAL_SCENARIOS_KEY = 'buyerTemperatureTrackerSavedScenariosV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function readLocalScenarios(): BuyerTemperatureSavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BuyerTemperatureSavedScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScenarios(scenarios: BuyerTemperatureSavedScenario[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios));
}

function buildCloudContent(input: BuyerTemperatureInput, summary: string): string {
  return [
    'BUYER TEMPERATURE TRACKER',
    '',
    `Buying Energy: ${input.buyingEnergy}`,
    `Consultant Confidence: ${input.consultantConfidence}`,
    `Trust Level: ${input.trustLevel}`,
    `Urgency Level: ${input.urgencyLevel}`,
    `Deal Stage: ${input.dealStage ?? 'not set'}`,
    '',
    summary,
  ].join('\n');
}

function pulseColorClasses(score: number): string {
  if (score >= 72) return 'from-[#00f5a0] via-[#24e39b] to-[#12c47c]';
  if (score >= 54) return 'from-[#86f96f] via-[#d7f366] to-[#f5db62]';
  if (score >= 38) return 'from-[#ffd772] via-[#ffbf66] to-[#ff935c]';
  return 'from-[#ff8d7a] via-[#ff6f66] to-[#ff4f59]';
}

export default function BuyerTemperatureTrackerPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [buyingEnergy, setBuyingEnergy] = useState(58);
  const [consultantConfidence, setConsultantConfidence] = useState(62);
  const [trustLevel, setTrustLevel] = useState(56);
  const [urgencyLevel, setUrgencyLevel] = useState(44);
  const [dealStage, setDealStage] = useState<BuyerTemperatureStage | null>('middle');
  const [savedScenarios, setSavedScenarios] = useState<BuyerTemperatureSavedScenario[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [isPadDragging, setIsPadDragging] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketBuyerTemperatureEnhancement> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxBuyerTemperatureEnhancement> | null>(null);

  const hasTrackedMeaningfulInteraction = useRef(false);
  const padRef = useRef<HTMLDivElement | null>(null);

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
  }, [buyingEnergy, consultantConfidence, trustLevel, urgencyLevel, dealStage]);

  const input = useMemo<BuyerTemperatureInput>(() => ({
    buyingEnergy,
    consultantConfidence,
    trustLevel,
    urgencyLevel,
    dealStage,
  }), [buyingEnergy, consultantConfidence, trustLevel, urgencyLevel, dealStage]);

  const plan = useMemo(() => getBuyerTemperaturePlan(input), [input]);

  const favoriteCount = useMemo(
    () => savedScenarios.filter((scenario) => scenario.favorite).length,
    [savedScenarios]
  );

  const energyDegrees = Math.round((buyingEnergy / 100) * 360);
  const pulseWidth = `${clamp(plan.momentumScore)}%`;
  const trustX = `${trustLevel}%`;
  const urgencyY = `${100 - urgencyLevel}%`;

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

  const updateTrustUrgencyFromPoint = useCallback((clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;
    const nextTrust = clamp(Math.round(rawX));
    const nextUrgency = clamp(Math.round(100 - rawY));

    withUsageTracking(() => {
      setTrustLevel(nextTrust);
      setUrgencyLevel(nextUrgency);
    });
  }, [withUsageTracking]);

  const handlePadPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    setIsPadDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateTrustUrgencyFromPoint(event.clientX, event.clientY);
  }, [updateTrustUrgencyFromPoint]);

  const handlePadPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPadDragging) return;
    updateTrustUrgencyFromPoint(event.clientX, event.clientY);
  }, [isPadDragging, updateTrustUrgencyFromPoint]);

  const handlePadPointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setIsPadDragging(false);
  }, []);

  const handleCopy = useCallback(async () => {
    const payload = [
      `[Current Deal Temperature] ${plan.currentDealTemperature} (${plan.momentumScore}/100)`,
      `[Hidden Risk] ${plan.hiddenRisk}`,
      `[Best Next Move] ${plan.bestNextMove}`,
      `[Say This Next] ${plan.sayThisNext}`,
      `[Do Not Do This] ${plan.doNotDoThis}`,
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Temperature read copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [plan, toast]);

  const handleSaveLocal = useCallback(() => {
    const scenario: BuyerTemperatureSavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      buyingEnergy,
      consultantConfidence,
      trustLevel,
      urgencyLevel,
      dealStage,
      currentDealTemperature: plan.currentDealTemperature,
      hiddenRisk: plan.hiddenRisk,
      bestNextMove: plan.bestNextMove,
      sayThisNext: plan.sayThisNext,
      doNotDoThis: plan.doNotDoThis,
      momentumScore: plan.momentumScore,
      favorite: false,
    };

    const next = [scenario, ...savedScenarios].slice(0, 40);
    setSavedScenarios(next);
    writeLocalScenarios(next);
    toast({ title: 'Saved locally', description: 'Scenario saved on this device.' });
  }, [buyingEnergy, consultantConfidence, trustLevel, urgencyLevel, dealStage, plan, savedScenarios, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock cloud saves to sync buyer-temperature scenarios.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this scenario.' });
      return;
    }

    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(input, `Current Deal Temperature: ${plan.currentDealTemperature}\nBest Next Move: ${plan.bestNextMove}`),
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
  }, [firebaseUser, input, plan.bestNextMove, plan.currentDealTemperature, requireFeature, toast]);

  const handleRunSprocket = useCallback(() => {
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for deeper momentum diagnosis.')) return;
    setSprocketOutput(getSprocketBuyerTemperatureEnhancement(input, plan));
  }, [input, plan, requireFeature]);

  const handleRunAutoDrive = useCallback(() => {
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for skill-aware momentum adaptation.')) return;
    setCxOutput(getAutoDriveCxBuyerTemperatureEnhancement(input, plan, user));
  }, [input, plan, requireFeature, user]);

  const toggleFavorite = useCallback((scenarioId: string) => {
    const next = savedScenarios.map((scenario) => {
      if (scenario.id !== scenarioId) return scenario;
      return { ...scenario, favorite: !scenario.favorite };
    });
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
      console.warn('[BuyerTemperatureTracker] unlock capture failed:', captureResult.message);
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
          <h1 className="text-2xl font-semibold tracking-tight text-[#f5f9ff] md:text-3xl">Buyer Temperature Tracker</h1>
          <p className="max-w-2xl text-sm text-[#a7b7d1] md:text-base">
            Assess deal momentum fast and choose the next move before the customer cools off.
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

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">Heat Meter Dial</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Buying energy drives the top-line momentum read.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-3">
              <div
                className="relative h-36 w-36 rounded-full border border-[#33506d] bg-[#0b1a2d]"
                style={{ background: `conic-gradient(#00e7f5 0deg, #00e7f5 ${energyDegrees}deg, #1b2b43 ${energyDegrees}deg 360deg)` }}
              >
                <div className="absolute inset-[10px] flex items-center justify-center rounded-full bg-[#081321]">
                  <div className="text-center">
                    <p className="text-2xl font-semibold text-[#e8f5ff]">{buyingEnergy}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-[#87a4c8]">Energy</p>
                  </div>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={buyingEnergy}
                onChange={(event) => withUsageTracking(() => setBuyingEnergy(Number(event.target.value)))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#1a304c]"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">Consultant Confidence Slider</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Confidence affects customer certainty in live delivery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm text-[#c8d8f1]">
              <span>Low</span>
              <span className="font-semibold text-[#eff7ff]">{consultantConfidence}</span>
              <span>High</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={consultantConfidence}
              onChange={(event) => withUsageTracking(() => setConsultantConfidence(Number(event.target.value)))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#1a304c]"
            />
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">Trust vs Urgency Pad</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Tap or drag to map the customer’s current state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs text-[#9fb4d2]">
              <p>Trust: <span className="font-semibold text-[#dff0ff]">{trustLevel}</span></p>
              <p className="text-right">Urgency: <span className="font-semibold text-[#dff0ff]">{urgencyLevel}</span></p>
            </div>

            <div className="relative mx-auto max-w-sm">
              <div
                ref={padRef}
                className="relative h-56 w-full touch-none rounded-2xl border border-[#36506f] bg-gradient-to-br from-[#0e2439] via-[#133250] to-[#1f4866]"
                onPointerDown={handlePadPointerDown}
                onPointerMove={handlePadPointerMove}
                onPointerUp={handlePadPointerEnd}
                onPointerCancel={handlePadPointerEnd}
              >
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute left-1/2 top-0 h-full w-px bg-[#6f8db3]/35" />
                  <div className="absolute left-0 top-1/2 h-px w-full bg-[#6f8db3]/35" />
                </div>
                <div
                  className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#dffaff] bg-[#00d9e6] shadow-[0_0_0_6px_rgba(0,216,229,0.22)]"
                  style={{ left: trustX, top: urgencyY }}
                />
                <div className="pointer-events-none absolute bottom-2 left-2 text-[10px] text-[#c5d8f3]">Low trust</div>
                <div className="pointer-events-none absolute bottom-2 right-2 text-[10px] text-[#c5d8f3]">High trust</div>
                <div className="pointer-events-none absolute left-2 top-2 text-[10px] text-[#c5d8f3]">High urgency</div>
                <div className="pointer-events-none absolute left-2 bottom-7 text-[10px] text-[#c5d8f3]">Low urgency</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader><CardTitle className="text-lg text-[#f2f7ff]">Optional Deal Stage</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <ChipButton active={dealStage === null} label="Not set" onClick={() => withUsageTracking(() => setDealStage(null))} />
            {BUYER_TEMPERATURE_STAGES.map((item) => (
              <ChipButton key={item} active={dealStage === item} label={item} onClick={() => withUsageTracking(() => setDealStage(item))} />
            ))}
          </CardContent>
        </Card>

        <Card className="border-[#2f4d69] bg-[#0d2036]">
          <CardHeader>
            <CardTitle className="text-lg text-[#e9f6ff]">Live Momentum Pulse</CardTitle>
            <CardDescription className="text-[#9db5d3]">Instant read as controls change.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-4 w-full overflow-hidden rounded-full border border-[#335172] bg-[#12263f]">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${pulseColorClasses(plan.momentumScore)} transition-all duration-300`}
                style={{ width: pulseWidth }}
              />
            </div>
            <p className="text-sm text-[#d8e7fb]">
              {plan.currentDealTemperature} momentum at <span className="font-semibold text-[#f4fbff]">{plan.momentumScore}/100</span>
            </p>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[#f4f8ff]">Temperature Read</h2>

          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Current Deal Temperature</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.currentDealTemperature}</p></CardContent>
          </Card>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Hidden Risk</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.hiddenRisk}</p></CardContent>
          </Card>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Best Next Move</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.bestNextMove}</p></CardContent>
          </Card>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Say This Next</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.sayThisNext}</p></CardContent>
          </Card>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#ffb8b8]">Do Not Do This</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#ffd8d8]">{plan.doNotDoThis}</p></CardContent>
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
                  <p><span className="font-semibold text-[#88f3ff]">Deeper diagnosis:</span> {sprocketOutput.deeperDiagnosis}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Why warming/cooling:</span> {sprocketOutput.warmingOrCoolingReason}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Sharper next move:</span> {sprocketOutput.sharperNextMove}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Natural rewrite:</span> {sprocketOutput.naturalRewrite}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Delivery coaching:</span> {sprocketOutput.deliveryCoaching}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </FeatureGate>

<Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">Saved Local Scenarios</CardTitle>
            <CardDescription className="text-[#9cb0cd]">
              {savedScenarios.length} saved on this device. {favoriteCount} favorited.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedScenarios.length === 0 ? (
              <p className="text-sm text-[#90a7ca]">No saved scenarios yet.</p>
            ) : (
              savedScenarios.slice(0, 6).map((scenario) => (
                <div key={scenario.id} className="rounded-xl border border-[#29415e] bg-[#0c182a] p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#e8f1ff]">
                      {scenario.currentDealTemperature} - {scenario.momentumScore}/100
                    </p>
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
                  <p className="text-sm text-[#c9d7ee]">{scenario.bestNextMove}</p>
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
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks personalized momentum guidance.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

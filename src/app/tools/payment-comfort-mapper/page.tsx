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
  PAYMENT_COMFORT_STYLES,
  getAutoDriveCxPaymentComfortEnhancement,
  getPaymentComfortPlan,
  getSprocketPaymentComfortEnhancement,
  type PaymentComfortInput,
  type PaymentComfortSavedScenario,
  type PaymentComfortStyle,
} from '@/lib/tools/payment-comfort-mapper';

const TOOL_ID = 'payment-comfort-mapper';
const LOCAL_SCENARIOS_KEY = 'paymentComfortMapperSavedScenariosV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function readLocalScenarios(): PaymentComfortSavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PaymentComfortSavedScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScenarios(scenarios: PaymentComfortSavedScenario[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios));
}

function buildCloudContent(input: PaymentComfortInput, summary: string): string {
  const flex = [
    input.flexTerm ? 'term' : null,
    input.flexDownPayment ? 'down payment' : null,
    input.flexVehicle ? 'vehicle' : null,
    input.flexPayment ? 'payment' : null,
  ].filter(Boolean).join(', ') || 'none';

  return [
    'PAYMENT COMFORT MAPPER',
    '',
    `Comfort Range: ${input.comfortRange}`,
    `Pain Point Threshold: ${input.painPointThreshold}`,
    `Reaction Intensity: ${input.reactionIntensity}`,
    `Flexibility Areas: ${flex}`,
    `Customer Style: ${input.customerStyle ?? 'not set'}`,
    '',
    summary,
  ].join('\n');
}

export default function PaymentComfortMapperPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [comfortRange, setComfortRange] = useState(56);
  const [painPointThreshold, setPainPointThreshold] = useState(64);
  const [reactionIntensity, setReactionIntensity] = useState(48);
  const [flexTerm, setFlexTerm] = useState(true);
  const [flexDownPayment, setFlexDownPayment] = useState(false);
  const [flexVehicle, setFlexVehicle] = useState(true);
  const [flexPayment, setFlexPayment] = useState(true);
  const [customerStyle, setCustomerStyle] = useState<PaymentComfortStyle | null>('payment-focused');
  const [savedScenarios, setSavedScenarios] = useState<PaymentComfortSavedScenario[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketPaymentComfortEnhancement> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxPaymentComfortEnhancement> | null>(null);

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
  }, [comfortRange, painPointThreshold, reactionIntensity, flexTerm, flexDownPayment, flexVehicle, flexPayment, customerStyle]);

  const input = useMemo<PaymentComfortInput>(() => ({
    comfortRange,
    painPointThreshold,
    reactionIntensity,
    flexTerm,
    flexDownPayment,
    flexVehicle,
    flexPayment,
    customerStyle,
  }), [comfortRange, painPointThreshold, reactionIntensity, flexTerm, flexDownPayment, flexVehicle, flexPayment, customerStyle]);

  const plan = useMemo(() => getPaymentComfortPlan(input), [input]);
  const favoriteCount = useMemo(() => savedScenarios.filter((entry) => entry.favorite).length, [savedScenarios]);

  const rangeMin = Math.min(comfortRange, painPointThreshold);
  const rangeMax = Math.max(comfortRange, painPointThreshold);

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
      `[Likely Payment Tolerance Pattern] ${plan.likelyPaymentTolerancePattern}`,
      `[Best Framing Approach] ${plan.bestFramingApproach}`,
      `[What To Emphasize] ${plan.whatToEmphasize}`,
      `[Ask This] ${plan.askThis}`,
      `[Do Not Do This] ${plan.doNotDoThis}`,
    ].join('\n\n');
    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Payment strategy copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [plan, toast]);

  const handleSaveLocal = useCallback(() => {
    const scenario: PaymentComfortSavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      comfortRange,
      painPointThreshold,
      reactionIntensity,
      flexTerm,
      flexDownPayment,
      flexVehicle,
      flexPayment,
      customerStyle,
      likelyPaymentTolerancePattern: plan.likelyPaymentTolerancePattern,
      bestFramingApproach: plan.bestFramingApproach,
      whatToEmphasize: plan.whatToEmphasize,
      askThis: plan.askThis,
      doNotDoThis: plan.doNotDoThis,
      favorite: false,
    };

    const next = [scenario, ...savedScenarios].slice(0, 40);
    setSavedScenarios(next);
    writeLocalScenarios(next);
    toast({ title: 'Saved locally', description: 'Scenario saved on this device.' });
  }, [comfortRange, painPointThreshold, reactionIntensity, flexTerm, flexDownPayment, flexVehicle, flexPayment, customerStyle, plan, savedScenarios, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock cloud saves to sync payment-comfort scenarios.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this scenario.' });
      return;
    }

    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(input, `Likely Payment Tolerance Pattern: ${plan.likelyPaymentTolerancePattern}\nBest Framing Approach: ${plan.bestFramingApproach}`),
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
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for deeper payment-reaction interpretation.')) return;
    setSprocketOutput(applySprocketCxOverlay(getSprocketPaymentComfortEnhancement(input, plan), user));
  }, [input, plan, requireFeature]);

  const handleRunAutoDrive = useCallback(() => {
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for personalized payment-strategy adaptation.')) return;
    setCxOutput(getAutoDriveCxPaymentComfortEnhancement(input, plan, user));
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
      console.warn('[PaymentComfortMapper] unlock capture failed:', captureResult.message);
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
              AutoShop
            </Link>
          </Button>
          <Badge className="border border-[#00d8e5]/40 bg-[#00f2ff]/10 text-[#6eeef8]">AutoDriveCX</Badge>
        </div>

        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[#f5f9ff] md:text-3xl">Payment Comfort Mapper</h1>
          <p className="max-w-2xl text-sm text-[#a7b7d1] md:text-base">
            Map payment tolerance and reaction points to choose smarter payment framing before friction rises.
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
            <CardTitle className="text-lg text-[#f2f7ff]">Comfort Range + Pain Threshold Map</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Map where comfort sits and where the reaction happened.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative h-4 w-full overflow-hidden rounded-full border border-[#365270] bg-[#13253f]">
              <div
                className="absolute top-0 h-full rounded-full bg-gradient-to-r from-[#20d4ff] to-[#00f2af] transition-all"
                style={{
                  left: `${rangeMin}%`,
                  width: `${Math.max(2, rangeMax - rangeMin)}%`,
                }}
              />
              <div
                className="absolute top-1/2 h-6 w-[2px] -translate-y-1/2 bg-[#ffd86a]"
                style={{ left: `${painPointThreshold}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.14em] text-[#9fb4d2]">Comfort Range</p>
                <p className="text-sm text-[#ebf4ff]">{comfortRange}</p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={comfortRange}
                  onChange={(event) => withUsageTracking(() => setComfortRange(clamp(Number(event.target.value))))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#1a304c]"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.14em] text-[#9fb4d2]">Pain Point Marker</p>
                <p className="text-sm text-[#ebf4ff]">{painPointThreshold}</p>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={painPointThreshold}
                  onChange={(event) => withUsageTracking(() => setPainPointThreshold(clamp(Number(event.target.value))))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#1a304c]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">Flexibility Toggle Stack</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Tap the variables the customer appears open to adjusting.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ToggleButton active={flexTerm} label="Term" onClick={() => withUsageTracking(() => setFlexTerm((prev) => !prev))} />
            <ToggleButton active={flexDownPayment} label="Down Payment" onClick={() => withUsageTracking(() => setFlexDownPayment((prev) => !prev))} />
            <ToggleButton active={flexVehicle} label="Vehicle" onClick={() => withUsageTracking(() => setFlexVehicle((prev) => !prev))} />
            <ToggleButton active={flexPayment} label="Payment" onClick={() => withUsageTracking(() => setFlexPayment((prev) => !prev))} />
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">Reaction Intensity Scrubber</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Low to high emotional reaction during payment discussion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm text-[#c8d8f1]">
              <span>Low</span>
              <span className="font-semibold text-[#eff7ff]">{reactionIntensity}</span>
              <span>High</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={reactionIntensity}
              onChange={(event) => withUsageTracking(() => setReactionIntensity(clamp(Number(event.target.value))))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#1a304c]"
            />
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader><CardTitle className="text-lg text-[#f2f7ff]">Optional Customer Style</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <ToggleButton active={customerStyle === null} label="Not Set" onClick={() => withUsageTracking(() => setCustomerStyle(null))} />
            {PAYMENT_COMFORT_STYLES.map((style) => (
              <ToggleButton key={style} active={customerStyle === style} label={style} onClick={() => withUsageTracking(() => setCustomerStyle(style))} />
            ))}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[#f4f8ff]">Payment Strategy Read</h2>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Likely Payment Tolerance Pattern</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.likelyPaymentTolerancePattern}</p></CardContent>
          </Card>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Best Framing Approach</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.bestFramingApproach}</p></CardContent>
          </Card>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">What To Emphasize</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.whatToEmphasize}</p></CardContent>
          </Card>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Ask This</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.askThis}</p></CardContent>
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
              onClick={() => withUsageTracking(() => { void handleSaveCloud(); })}
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
            <CardHeader><CardTitle className="flex items-center gap-2 text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Insight</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button className="h-11 bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]" onClick={() => withUsageTracking(handleRunSprocket)}>
                Run Sprocket Enhancement
              </Button>
              {sprocketOutput && (
                <div className="space-y-2 rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                  <p><span className="font-semibold text-[#88f3ff]">Deeper interpretation:</span> {sprocketOutput.deeperInterpretation}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Likely hidden issue:</span> {sprocketOutput.likelyHiddenIssue}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Sharper framing:</span> {sprocketOutput.sharperFraming}</p>
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
                    <p className="text-sm font-semibold text-[#e8f1ff]">{scenario.likelyPaymentTolerancePattern}</p>
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
                  <p className="text-sm text-[#c9d7ee]">{scenario.bestFramingApproach}</p>
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
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks personalized payment-friction adaptation.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

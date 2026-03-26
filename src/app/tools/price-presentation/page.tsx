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
  PRICE_PRESENTATION_CHANNELS,
  PRICE_PRESENTATION_GOALS,
  PRICE_PRESENTATION_INVENTORY_TYPES,
  PRICE_PRESENTATION_PAYMENT_ORDERS,
  PRICE_PRESENTATION_REACTIONS,
  PRICE_PRESENTATION_ROUNDS,
  PRICE_PRESENTATION_SCENARIOS,
  getAutoDriveCxPricePresentationRecommendation,
  getPricePresentationBaseRecommendation,
  getSprocketPricePresentationRecommendation,
  type PricePresentationGoal,
  type PricePresentationInput,
  type PricePresentationReaction,
  type PricePresentationSavedScenario,
  type PricePresentationScenario,
} from '@/lib/tools/price-presentation-planner';

const TOOL_ID = 'price-presentation';
const LOCAL_SCENARIOS_KEY = 'pricePresentationPlannerScenariosV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

function scenarioToCloudContent(input: PricePresentationInput, scenario: PricePresentationSavedScenario): string {
  const sequence = getPricePresentationBaseRecommendation(input).orderToPresent.map((step, idx) => `${idx + 1}. ${step}`).join('\n');
  return [
    'PRICE PRESENTATION PLANNER',
    '',
    `Scenario: ${input.scenario}`,
    `Reaction: ${input.reaction || 'Neutral'}`,
    `Goal: ${input.goal || 'Not set'}`,
    `Inventory: ${input.modifiers?.inventoryType || 'Not set'}`,
    `Channel: ${input.modifiers?.channel || 'Not set'}`,
    `Payment Order: ${input.modifiers?.paymentOrder || 'Not set'}`,
    `Presentation Round: ${input.modifiers?.presentationRound || 'Not set'}`,
    `Manager Involved: ${input.modifiers?.managerInvolved ? 'Yes' : 'No'}`,
    '',
    `[Approach] ${scenario.approachLabel}`,
    '',
    '[Say This]',
    scenario.sayThis,
    '',
    '[Do Not Do This]',
    scenario.doNotDoThis,
    '',
    '[Best Order]',
    sequence,
  ].join('\n');
}

function readLocalScenarios(): PricePresentationSavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PricePresentationSavedScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScenarios(scenarios: PricePresentationSavedScenario[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios));
}

export default function PricePresentationPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [selectedScenario, setSelectedScenario] = useState<PricePresentationScenario | null>(null);
  const [selectedReaction, setSelectedReaction] = useState<PricePresentationReaction>('Neutral');
  const [selectedGoal, setSelectedGoal] = useState<PricePresentationGoal | undefined>(undefined);

  const [inventoryType, setInventoryType] = useState<(typeof PRICE_PRESENTATION_INVENTORY_TYPES)[number]>('New');
  const [channel, setChannel] = useState<(typeof PRICE_PRESENTATION_CHANNELS)[number]>('In-store');
  const [paymentOrder, setPaymentOrder] = useState<(typeof PRICE_PRESENTATION_PAYMENT_ORDERS)[number]>('Trade Before Payment');
  const [presentationRound, setPresentationRound] = useState<(typeof PRICE_PRESENTATION_ROUNDS)[number]>('First Presentation');
  const [managerInvolved, setManagerInvolved] = useState(false);

  const [savedScenarios, setSavedScenarios] = useState<PricePresentationSavedScenario[]>([]);
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketPricePresentationRecommendation> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxPricePresentationRecommendation> | null>(null);

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
    const handoff = readFullToolHandoff<{ source?: string; draft?: string }>(TOOL_ID);
    const draft = handoff?.draft?.toLowerCase() || '';
    const matched = PRICE_PRESENTATION_SCENARIOS.find((scenario) => draft.includes(scenario.toLowerCase()));
    if (matched) setSelectedScenario(matched);
    clearFullToolHandoff(TOOL_ID);
  }, []);

  useEffect(() => {
    setSprocketOutput(null);
    setCxOutput(null);
  }, [selectedScenario, selectedReaction, selectedGoal, inventoryType, channel, paymentOrder, presentationRound, managerInvolved]);

  const currentInput = useMemo<PricePresentationInput | null>(() => {
    if (!selectedScenario) return null;
    return {
      scenario: selectedScenario,
      reaction: selectedReaction,
      goal: selectedGoal,
      modifiers: {
        inventoryType,
        channel,
        paymentOrder,
        presentationRound,
        managerInvolved,
      },
    };
  }, [selectedScenario, selectedReaction, selectedGoal, inventoryType, channel, paymentOrder, presentationRound, managerInvolved]);

  const baseRecommendation = useMemo(() => {
    if (!currentInput) return null;
    return getPricePresentationBaseRecommendation(currentInput);
  }, [currentInput]);

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

  const handleScenarioSelect = useCallback((scenario: PricePresentationScenario) => {
    if (!canUseBaseTool) {
      setShowEmailGate(true);
      return;
    }
    setSelectedScenario(scenario);
    trackMeaningfulInteraction();
  }, [canUseBaseTool, trackMeaningfulInteraction]);

  const handleCopy = useCallback(async () => {
    if (!baseRecommendation || !currentInput) {
      toast({ variant: 'destructive', title: 'Pick a scenario first', description: 'Choose a pricing scenario to generate your plan.' });
      return;
    }

    const sequence = baseRecommendation.orderToPresent.map((step, idx) => `${idx + 1}. ${step}`).join('\n');
    const output = [
      `Approach: ${baseRecommendation.approachLabel}`,
      baseRecommendation.approachExplanation,
      '',
      '[Best Order to Present]',
      sequence,
      '',
      `[Say This] ${baseRecommendation.sayThis}`,
      '',
      '[Emphasize]',
      ...baseRecommendation.emphasize.map((item) => `- ${item}`),
      '',
      `[Do Not Do This] ${baseRecommendation.doNotDoThis}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(output);
      toast({ title: 'Copied', description: 'Presentation plan copied and ready to use.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [baseRecommendation, currentInput, toast]);

  const handleSaveLocal = useCallback(() => {
    if (!baseRecommendation || !currentInput) {
      toast({ variant: 'destructive', title: 'Pick a scenario first', description: 'Choose a pricing scenario to save a plan.' });
      return;
    }

    const scenario: PricePresentationSavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      scenario: currentInput.scenario,
      reaction: currentInput.reaction || 'Neutral',
      goal: currentInput.goal,
      approachLabel: baseRecommendation.approachLabel,
      sayThis: baseRecommendation.sayThis,
      doNotDoThis: baseRecommendation.doNotDoThis,
      favorite: false,
    };

    const next = [scenario, ...savedScenarios].slice(0, 30);
    setSavedScenarios(next);
    writeLocalScenarios(next);
    toast({ title: 'Saved locally', description: 'Plan saved on this device.' });
  }, [baseRecommendation, currentInput, savedScenarios, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!baseRecommendation || !currentInput) {
      toast({ variant: 'destructive', title: 'Pick a scenario first', description: 'Choose a pricing scenario before cloud save.' });
      return;
    }

    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock cloud saves to sync pricing plans across devices.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this plan to your account.' });
      return;
    }

    const scenario: PricePresentationSavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      scenario: currentInput.scenario,
      reaction: currentInput.reaction || 'Neutral',
      goal: currentInput.goal,
      approachLabel: baseRecommendation.approachLabel,
      sayThis: baseRecommendation.sayThis,
      doNotDoThis: baseRecommendation.doNotDoThis,
    };

    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: scenarioToCloudContent(currentInput, scenario),
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

    toast({ title: 'Saved to cloud', description: 'Plan now syncs across devices.' });
  }, [baseRecommendation, currentInput, firebaseUser, requireFeature, toast]);

  const handleRunSprocket = useCallback(() => {
    if (!baseRecommendation || !currentInput) {
      toast({ variant: 'destructive', title: 'Pick a scenario first' });
      return;
    }

    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for diagnosis and sharper framing.')) return;
    setSprocketOutput(getSprocketPricePresentationRecommendation(currentInput, baseRecommendation));
  }, [baseRecommendation, currentInput, requireFeature, toast]);

  const handleRunAutoDrive = useCallback(() => {
    if (!baseRecommendation || !currentInput) {
      toast({ variant: 'destructive', title: 'Pick a scenario first' });
      return;
    }

    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for skill-aware adaptation.')) return;
    setCxOutput(getAutoDriveCxPricePresentationRecommendation(currentInput, baseRecommendation, user));
  }, [baseRecommendation, currentInput, requireFeature, toast, user]);

  const toggleFavorite = useCallback((scenarioId: string) => {
    const next = savedScenarios.map((scenario) => {
      if (scenario.id !== scenarioId) return scenario;
      return { ...scenario, favorite: !scenario.favorite };
    });
    setSavedScenarios(next);
    writeLocalScenarios(next);
  }, [savedScenarios]);

  async function handleUnlockByEmail(input: { email: string; role: ToolboxCapturedRole }) {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      toast({ variant: 'destructive', title: 'Enter a valid email' });
      return;
    }

    setIsEmailSubmitting(true);
    const captureResult = await captureToolboxUnlockEmail({ email, role: input.role });
    if (!captureResult.ok) {
      console.warn('[PricePresentationPlanner] unlock capture failed:', captureResult.message);
    }

    setLocalAccountProfile({ email, role: input.role });
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
          <h1 className="text-2xl font-semibold tracking-tight text-[#f5f9ff] md:text-3xl">Price Presentation Planner</h1>
          <p className="max-w-2xl text-sm text-[#a7b7d1] md:text-base">
            Pick the deal scenario and reaction, then get the exact structure to present numbers with confidence.
          </p>
          <p className="text-xs uppercase tracking-[0.12em] text-[#6f89af]">Built for real live number presentations</p>
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
            <CardTitle className="text-lg text-[#f2f7ff]">1. Pricing Scenario</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Start with the current deal situation.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PRICE_PRESENTATION_SCENARIOS.map((scenario) => (
              <ChipButton
                key={scenario}
                active={selectedScenario === scenario}
                label={scenario}
                onClick={() => handleScenarioSelect(scenario)}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">2. Customer Reaction (Optional)</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Sharpen how you present and pace the numbers.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PRICE_PRESENTATION_REACTIONS.map((reaction) => (
              <ChipButton
                key={reaction}
                active={selectedReaction === reaction}
                label={reaction}
                onClick={() => {
                  if (!canUseBaseTool) {
                    setShowEmailGate(true);
                    return;
                  }
                  setSelectedReaction(reaction);
                  trackMeaningfulInteraction();
                }}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">3. Goal + Modifiers (Optional)</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Refine trust, pacing, and commitment strategy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#84a0c4]">Presentation Goal</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PRICE_PRESENTATION_GOALS.map((goal) => (
                  <ChipButton
                    key={goal}
                    active={selectedGoal === goal}
                    label={goal}
                    onClick={() => setSelectedGoal((current) => (current === goal ? undefined : goal))}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PRICE_PRESENTATION_INVENTORY_TYPES.map((value) => (
                <ChipButton key={value} active={inventoryType === value} label={value} onClick={() => setInventoryType(value)} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRICE_PRESENTATION_CHANNELS.map((value) => (
                <ChipButton key={value} active={channel === value} label={value} onClick={() => setChannel(value)} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRICE_PRESENTATION_PAYMENT_ORDERS.map((value) => (
                <ChipButton key={value} active={paymentOrder === value} label={value} onClick={() => setPaymentOrder(value)} />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {PRICE_PRESENTATION_ROUNDS.map((value) => (
                <ChipButton key={value} active={presentationRound === value} label={value} onClick={() => setPresentationRound(value)} />
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2">
              <ChipButton
                active={managerInvolved}
                label={managerInvolved ? 'Manager Involved: Yes' : 'Manager Involved: No'}
                onClick={() => setManagerInvolved((current) => !current)}
              />
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[#f4f8ff]">Your Presentation Plan</h2>
          {!baseRecommendation ? (
            <Card className="border-dashed border-[#2f4568] bg-[#0b1627]">
              <CardContent className="p-5 text-sm text-[#90a7ca]">Select a pricing scenario to generate your plan instantly.</CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <Card className="border-[#2d4b66] bg-[#10243a]">
                <CardHeader>
                  <CardTitle className="text-base text-[#7eeeff]">Recommended Presentation Approach</CardTitle>
                  <CardDescription className="text-[#a8bfdc]">{baseRecommendation.approachLabel}</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-[#eff6ff]">{baseRecommendation.approachExplanation}</CardContent>
              </Card>

              <Card className="border-[#2d4b66] bg-[#10243a]">
                <CardHeader>
                  <CardTitle className="text-base text-[#7eeeff]">Best Order to Present</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {baseRecommendation.orderToPresent.map((step, idx) => (
                    <p key={`${step}-${idx}`} className="text-sm text-[#eff6ff]">{idx + 1}. {step}</p>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-[#2d4b66] bg-[#10243a]">
                <CardHeader>
                  <CardTitle className="text-base text-[#7eeeff]">Say This</CardTitle>
                </CardHeader>
                <CardContent className="text-base font-medium text-[#eff6ff]">{baseRecommendation.sayThis}</CardContent>
              </Card>

              <Card className="border-[#2d4b66] bg-[#10243a]">
                <CardHeader>
                  <CardTitle className="text-base text-[#7eeeff]">Emphasize</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {baseRecommendation.emphasize.map((item) => (
                    <p key={item} className="text-sm text-[#eff6ff]">- {item}</p>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-[#4f3442] bg-[#261823]">
                <CardHeader>
                  <CardTitle className="text-base text-[#ffb5d2]">Do Not Do This</CardTitle>
                </CardHeader>
                <CardContent className="text-base font-medium text-[#ffe7f2]">{baseRecommendation.doNotDoThis}</CardContent>
              </Card>

              <Card className="border-[#2b3e5d] bg-[#0f1b30]">
                <CardHeader>
                  <CardTitle className="text-sm text-[#dce8ff]">Why this works</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-[#a8b9d4]">{baseRecommendation.whyThisWorks}</CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button className="h-11 bg-[#172845] text-[#eaf2ff] hover:bg-[#22375a]" onClick={handleCopy}>
                  <Copy className="mr-2 h-4 w-4" /> Copy
                </Button>
                <Button className="h-11 bg-[#172845] text-[#eaf2ff] hover:bg-[#22375a]" onClick={handleSaveLocal}>
                  <Save className="mr-2 h-4 w-4" /> Save Local
                </Button>
                <Button className="h-11 border border-[#3c5878] bg-[#0f1b30] text-[#dce7f8] hover:bg-[#172845]" onClick={handleSaveCloud} disabled={isCloudSaving}>
                  <Cloud className="mr-2 h-4 w-4" /> {isCloudSaving ? 'Saving...' : 'Save to Cloud'}
                </Button>
              </div>
            </div>
          )}
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Insight</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="h-11 bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]" onClick={handleRunSprocket}>
                Run Sprocket Enhancement
              </Button>

              {sprocketOutput && (
                <div className="space-y-2 rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                  <p><span className="font-semibold text-[#88f3ff]">Likely breakdown:</span> {sprocketOutput.likelyBreakdown}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Better framing choice:</span> {sprocketOutput.betterFramingChoice}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Natural rewrite:</span> {sprocketOutput.naturalRewrite}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Delivery coaching:</span> {sprocketOutput.deliveryCoaching}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Likely reaction and response:</span> {sprocketOutput.likelyReactionAndResponse}</p>
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
              <p className="text-sm text-[#90a7ca]">No saved plans yet.</p>
            ) : (
              savedScenarios.slice(0, 6).map((scenario) => (
                <div key={scenario.id} className="rounded-xl border border-[#29415e] bg-[#0c182a] p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#e8f1ff]">{scenario.scenario} · {scenario.reaction}</p>
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
                  <p className="text-sm text-[#c9d7ee]">{scenario.approachLabel}</p>
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
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX adds skill-aware presentation intelligence.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

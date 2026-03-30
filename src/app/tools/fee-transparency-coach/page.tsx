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
import { Input } from '@/components/ui/input';
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
  enhanceSprocketInsight,
  saveToolboxEntry,
} from '@/lib/tools/toolbox-client';
import { clearFullToolHandoff, readFullToolHandoff } from '@/lib/tools/toolbox-storage';
import {
  FEE_TRANSPARENCY_EMOTIONS,
  FEE_TRANSPARENCY_FEE_TYPES,
  FEE_TRANSPARENCY_FRUSTRATIONS,
  FEE_TRANSPARENCY_RESPONSE_MODES,
  FEE_TRANSPARENCY_RISK,
  FEE_TRANSPARENCY_SCRIPT_MODES,
  FEE_TRANSPARENCY_STAGES,
  getAutoDriveCxFeeTransparencyEnhancement,
  getFeeTransparencyPlan,
  getSprocketFeeTransparencyEnhancement,
  type FeeTransparencyEmotion,
  type FeeTransparencyFeeType,
  type FeeTransparencyFrustration,
  type FeeTransparencyInput,
  type FeeTransparencyResponseMode,
  type FeeTransparencyRiskLevel,
  type FeeTransparencySavedScenario,
  type FeeTransparencyScriptMode,
  type FeeTransparencyStage,
} from '@/lib/tools/fee-transparency-coach';

const TOOL_ID = 'fee-transparency-coach';
const LOCAL_SCENARIOS_KEY = 'feeTransparencyCoachSavedScenariosV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

function readLocalScenarios(): FeeTransparencySavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FeeTransparencySavedScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScenarios(scenarios: FeeTransparencySavedScenario[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios));
}

function buildCloudContent(input: FeeTransparencyInput, summary: string): string {
  return [
    'FEE TRANSPARENCY COACH',
    '',
    `Fee: ${input.feeType === 'Other / custom' ? input.customFeeName || input.feeType : input.feeType}`,
    `Amount: ${input.amount || 'Not provided'}`,
    `Stage: ${input.objectionStage}`,
    `Emotion: ${input.emotion}`,
    `Frustration Factors: ${input.frustrationFactors.join(', ') || 'none'}`,
    `Risk: ${input.riskLevel}`,
    `Response Preference: ${input.desiredResponse}`,
    `Notes: ${input.messyNotes || 'Not provided'}`,
    '',
    summary,
  ].join('\n');
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s/]+/)
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

function riskTone(riskLevel: FeeTransparencyRiskLevel): string {
  if (riskLevel === 'critical') return 'border-[#8a3548] bg-[#2d1720] text-[#ffd7df]';
  if (riskLevel === 'high') return 'border-[#80593a] bg-[#2d2117] text-[#ffe0c2]';
  if (riskLevel === 'medium') return 'border-[#3f5f7c] bg-[#172434] text-[#d6ebff]';
  return 'border-[#31624f] bg-[#12241d] text-[#d0ffe8]';
}

function responseModeToScriptMode(mode: FeeTransparencyResponseMode): FeeTransparencyScriptMode {
  if (mode === 'short response') return '10-second version';
  if (mode === 'fuller explanation') return '30-second version';
  return 'full conversation version';
}

function formatScriptParagraphs(script: string): string[] {
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length <= 2) return sentences;

  const paragraphs: string[] = [];
  let current: string[] = [];

  sentences.forEach((sentence) => {
    current.push(sentence);

    const isQuestion = sentence.endsWith('?');
    const isPivot = /what i do not want|i want to|let me|before we/i.test(sentence);

    if (current.length >= 2 || isQuestion || isPivot) {
      paragraphs.push(current.join(' '));
      current = [];
    }
  });

  if (current.length) paragraphs.push(current.join(' '));
  return paragraphs;
}

export default function FeeTransparencyCoachPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [feeType, setFeeType] = useState<FeeTransparencyFeeType>('Documentation fee');
  const [customFeeName, setCustomFeeName] = useState('');
  const [amount, setAmount] = useState('');
  const [objectionStage, setObjectionStage] = useState<FeeTransparencyStage>('First pencil / numbers');
  const [emotion, setEmotion] = useState<FeeTransparencyEmotion>('skeptical');
  const [frustrationFactors, setFrustrationFactors] = useState<FeeTransparencyFrustration[]>(['surprise or timing']);
  const [riskLevel, setRiskLevel] = useState<FeeTransparencyRiskLevel>('medium');
  const [desiredResponse, setDesiredResponse] = useState<FeeTransparencyResponseMode>('short response');
  const [messyNotes, setMessyNotes] = useState('');
  const [activeScriptMode, setActiveScriptMode] = useState<FeeTransparencyScriptMode>('10-second version');
  const [savedScenarios, setSavedScenarios] = useState<FeeTransparencySavedScenario[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [isRunningSprocket, setIsRunningSprocket] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<Awaited<ReturnType<typeof getSprocketFeeTransparencyEnhancement>> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxFeeTransparencyEnhancement> | null>(null);

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
    const handoff = readFullToolHandoff<{ draft?: string }>(TOOL_ID);
    if (handoff?.draft) {
      setMessyNotes((current) => current || handoff.draft || '');
    }
    clearFullToolHandoff(TOOL_ID);
  }, []);

  useEffect(() => {
    setActiveScriptMode(responseModeToScriptMode(desiredResponse));
  }, [desiredResponse]);

  useEffect(() => {
    setSprocketOutput(null);
    setCxOutput(null);
  }, [feeType, customFeeName, amount, objectionStage, emotion, frustrationFactors, riskLevel, desiredResponse, messyNotes]);

  const input = useMemo<FeeTransparencyInput>(() => ({
    feeType,
    customFeeName,
    amount,
    objectionStage,
    emotion,
    frustrationFactors,
    riskLevel,
    desiredResponse,
    messyNotes,
  }), [feeType, customFeeName, amount, objectionStage, emotion, frustrationFactors, riskLevel, desiredResponse, messyNotes]);

  const plan = useMemo(() => getFeeTransparencyPlan(input), [input]);
  const favoriteCount = useMemo(() => savedScenarios.filter((entry) => entry.favorite).length, [savedScenarios]);
  const activeScriptParagraphs = useMemo(
    () => formatScriptParagraphs(plan.scripts[activeScriptMode]),
    [activeScriptMode, plan]
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

  const toggleFrustration = useCallback((value: FeeTransparencyFrustration) => {
    withUsageTracking(() => {
      setFrustrationFactors((prev) => {
        if (prev.includes(value)) {
          const next = prev.filter((entry) => entry !== value);
          return next.length ? next : ['surprise or timing'];
        }
        return [...prev, value].slice(0, 3);
      });
    });
  }, [withUsageTracking]);

  const handleCopy = useCallback(async () => {
    const payload = [
      `[Scenario] ${plan.scenarioSummary}`,
      `[Opening Line] ${plan.recommendedOpeningLine}`,
      `[Explanation] ${plan.plainEnglishFeeExplanation}`,
      `[Primary Approach] ${plan.primaryApproach}`,
      `[Backup Approach] ${plan.backupApproach}`,
      `[Likely Hidden Objection] ${plan.likelyHiddenObjection}`,
      `[Best Response Path] ${plan.bestResponsePath}`,
      `[Next Step] ${plan.nextStepRecommendation}`,
      `[Avoid Saying] ${plan.whatNotToSay}`,
      `[${activeScriptMode}] ${plan.scripts[activeScriptMode]}`,
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Fee coaching script copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [activeScriptMode, plan, toast]);

  const handleSaveLocal = useCallback(() => {
    const scenario: FeeTransparencySavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      feeLabel: plan.feeLabel,
      amount,
      emotion,
      frustrationFactors,
      riskLevel,
      primaryApproach: plan.primaryApproach,
      backupApproach: plan.backupApproach,
      recommendedOpeningLine: plan.recommendedOpeningLine,
      nextStepRecommendation: plan.nextStepRecommendation,
      scenarioSummary: plan.scenarioSummary,
      favorite: false,
    };

    const next = [scenario, ...savedScenarios].slice(0, 40);
    setSavedScenarios(next);
    writeLocalScenarios(next);
    toast({ title: 'Saved locally', description: 'Scenario saved on this device.' });
  }, [amount, emotion, frustrationFactors, plan, riskLevel, savedScenarios, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!firebaseUser) {
      setUpgradeContextMessage('Cloud sync is part of the paid layer. Sign in and upgrade to sync fee scenarios.');
      setGateModalType('paid');
      return;
    }

    if (!entitlements.hasPaidAccess) {
      setUpgradeContextMessage('Cloud sync, reusable playbooks, and saved wording are available on the paid layer.');
      setGateModalType('paid');
      return;
    }

    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(input, `Primary Approach: ${plan.primaryApproach}\nActive Script: ${plan.scripts[activeScriptMode]}`),
    });
    setIsCloudSaving(false);

    if (!result.ok) {
      toast({ variant: 'destructive', title: result.message });
      return;
    }

    toast({ title: 'Saved to cloud', description: 'Scenario now syncs across devices.' });
  }, [activeScriptMode, entitlements.hasPaidAccess, firebaseUser, input, plan, toast]);

  const handleRunSprocket = useCallback(async () => {
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for note interpretation, tone rewrites, and objection recovery coaching.')) return;

    setIsRunningSprocket(true);
    const base = getSprocketFeeTransparencyEnhancement(input, plan);
    const result = await enhanceSprocketInsight({
      toolId: TOOL_ID,
      userRole: String(accountProfile?.role || user?.role || 'Sales Consultant'),
      cxSummary: plan.likelyHiddenObjection,
      output: base,
    });
    setIsRunningSprocket(false);

    if (!result.ok) {
      setSprocketOutput(base);
      toast({ title: 'Sprocket fallback', description: 'Using the built-in coaching version right now.' });
      return;
    }

    setSprocketOutput(result.data.output as typeof base);
  }, [accountProfile?.role, input, plan, requireFeature, toast, user?.role]);

  const handleRunAutoDrive = useCallback(() => {
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for skill-aware fee-handling coaching.')) return;
    setCxOutput(getAutoDriveCxFeeTransparencyEnhancement(input, plan, user));
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
      console.warn('[FeeTransparencyCoach] unlock capture failed:', captureResult.message);
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
    tone = 'blue',
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
    tone?: 'blue' | 'green' | 'amber';
  }) => {
    const activeClass = tone === 'green'
      ? 'border-[#9DEE75] bg-[#9DEE75] text-[#061207]'
      : tone === 'amber'
        ? 'border-[#f4bf71] bg-[#f4bf71] text-[#1f1404]'
        : 'border-[#00d8e5] bg-[#00f2ff]/15 text-[#dbfcff]';

    return (
      <button
        type="button"
        onClick={onClick}
        className={`min-h-[46px] rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition-all ${
          active
            ? activeClass
            : 'border-[#2d4567] bg-[#101c31] text-[#c6d8f1] hover:bg-[#172844]'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#070d18] text-[#dce7f8]">
      <Header />

      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-32 pt-4 sm:px-5 md:space-y-6 md:px-8 md:pt-8">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" asChild className="h-10 px-2 text-[#b8c8e2] hover:bg-[#13233b] hover:text-[#e6efff]">
            <Link href="/tools">
              <ChevronLeft className="mr-1 h-4 w-4" />
              AutoShop
            </Link>
          </Button>
          <Badge className="border border-[#00d8e5]/40 bg-[#00f2ff]/10 text-[#6eeef8]">Tool Shop</Badge>
        </div>

        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[#f5f9ff] md:text-3xl">Fee Transparency Coach</h1>
          <p className="max-w-3xl text-sm text-[#a7b7d1] md:text-base">
            Fast, ethical fee scripting for live deals. Clarify the fee, diagnose the real objection, and keep trust intact without sounding defensive.
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

        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-[#2a3f5f] bg-[#0f1b30]">
            <CardHeader>
              <CardTitle className="text-lg text-[#eff6ff]">Fast Intake</CardTitle>
              <CardDescription className="text-[#9cb2cf]">Get to a usable explanation in a few taps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-[#7fa7cf]">Fee Type</p>
                <div className="grid grid-cols-2 gap-2">
                  {FEE_TRANSPARENCY_FEE_TYPES.map((item) => (
                    <ChipButton
                      key={item}
                      active={feeType === item}
                      label={item}
                      onClick={() => withUsageTracking(() => setFeeType(item))}
                    />
                  ))}
                </div>
                {feeType === 'Other / custom' && (
                  <Input
                    value={customFeeName}
                    onChange={(event) => withUsageTracking(() => setCustomFeeName(event.target.value))}
                    placeholder="Type the fee name"
                    className="border-[#294665] bg-[#0f2238] text-[#e5f2ff] placeholder:text-[#7595bc]"
                  />
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7fa7cf]">Amount</p>
                  <Input
                    value={amount}
                    onChange={(event) => withUsageTracking(() => setAmount(event.target.value))}
                    placeholder="e.g. 499"
                    className="border-[#294665] bg-[#0f2238] text-[#e5f2ff] placeholder:text-[#7595bc]"
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7fa7cf]">Deal Risk</p>
                  <div className="grid grid-cols-2 gap-2">
                    {FEE_TRANSPARENCY_RISK.map((item) => (
                      <ChipButton
                        key={item}
                        active={riskLevel === item}
                        label={toTitleCase(item)}
                        onClick={() => withUsageTracking(() => setRiskLevel(item))}
                        tone={item === 'critical' || item === 'high' ? 'amber' : 'green'}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-[#7fa7cf]">When It Hit</p>
                <div className="grid grid-cols-2 gap-2">
                  {FEE_TRANSPARENCY_STAGES.map((item) => (
                    <ChipButton
                      key={item}
                      active={objectionStage === item}
                      label={item}
                      onClick={() => withUsageTracking(() => setObjectionStage(item))}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-[#7fa7cf]">Customer Emotion</p>
                <div className="grid grid-cols-2 gap-2">
                  {FEE_TRANSPARENCY_EMOTIONS.map((item) => (
                    <ChipButton
                      key={item}
                      active={emotion === item}
                      label={toTitleCase(item)}
                      onClick={() => withUsageTracking(() => setEmotion(item))}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-[#7fa7cf]">What Is Driving It</p>
                  <p className="text-xs text-[#8ea9cb]">Pick up to 3</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {FEE_TRANSPARENCY_FRUSTRATIONS.map((item) => (
                    <ChipButton
                      key={item}
                      active={frustrationFactors.includes(item)}
                      label={toTitleCase(item)}
                      onClick={() => toggleFrustration(item)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-[#7fa7cf]">What You Need Right Now</p>
                <div className="grid grid-cols-3 gap-2">
                  {FEE_TRANSPARENCY_RESPONSE_MODES.map((item) => (
                    <ChipButton
                      key={item}
                      active={desiredResponse === item}
                      label={toTitleCase(item)}
                      onClick={() => withUsageTracking(() => setDesiredResponse(item))}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.18em] text-[#7fa7cf]">Message Notes</p>
                <Textarea
                  value={messyNotes}
                  onChange={(event) => withUsageTracking(() => setMessyNotes(event.target.value))}
                  placeholder="Optional: customer said website price was different, spouse is texting them, payment already felt high..."
                  className="min-h-[108px] border-[#294665] bg-[#0f2238] text-[#e5f2ff] placeholder:text-[#7595bc]"
                />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="border-[#2a3f5f] bg-[#0f1b30]">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg text-[#f4fbff]">Scenario Summary</CardTitle>
                    <CardDescription className="text-[#9cb2cf]">Primary and backup approach for this moment.</CardDescription>
                  </div>
                  <Badge className={riskTone(riskLevel)}>{toTitleCase(riskLevel)} risk</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-[#315274] bg-[#10253d] p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Scenario</p>
                  <p className="mt-1 text-sm font-semibold text-[#e6f3ff]">{plan.scenarioSummary}</p>
                </div>
                <div className="rounded-2xl border border-[#315274] bg-[#10253d] p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Primary Approach</p>
                  <p className="mt-1 text-sm text-[#d5e9ff]">{plan.primaryApproach}</p>
                </div>
                <div className="rounded-2xl border border-[#315274] bg-[#10253d] p-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Backup Approach</p>
                  <p className="mt-1 text-sm text-[#d5e9ff]">{plan.backupApproach}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#2a3f5f] bg-[#0f1b30]">
              <CardHeader>
                <CardTitle className="text-lg text-[#f4fbff]">Instant Script</CardTitle>
                <CardDescription className="text-[#9cb2cf]">Switch between quick, fuller, and follow-up versions.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {FEE_TRANSPARENCY_SCRIPT_MODES.map((item) => (
                    <ChipButton
                      key={item}
                      active={activeScriptMode === item}
                      label={item.replace(' version', '')}
                      onClick={() => setActiveScriptMode(item)}
                    />
                  ))}
                </div>
                <div className="rounded-2xl border border-[#2b4d6f] bg-[#10253d] p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">{activeScriptMode}</p>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-[#e6f3ff]">
                    {activeScriptParagraphs.map((paragraph, index) => (
                      <p key={`${activeScriptMode}-${index}`}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-[#2a3f5f] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f4fbff]">Coach Output</CardTitle>
            <CardDescription className="text-[#9cb2cf]">Clear explanation, hidden objection read, and the cleanest next path.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-[#2b4d6f] bg-[#10253d] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Recommended Opening Line</p>
              <p className="mt-1 text-sm text-[#e6f3ff]">{plan.recommendedOpeningLine}</p>
            </div>
            <div className="rounded-2xl border border-[#2b4d6f] bg-[#10253d] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Plain-English Fee Explanation</p>
              <p className="mt-1 text-sm text-[#e6f3ff]">{plan.plainEnglishFeeExplanation}</p>
            </div>
            <div className="rounded-2xl border border-[#6b3c46] bg-[#291820] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#ffc3cf]">What Not To Say</p>
              <p className="mt-1 text-sm text-[#ffdce4]">{plan.whatNotToSay}</p>
            </div>
            <div className="rounded-2xl border border-[#2b4d6f] bg-[#10253d] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Likely Hidden Objection</p>
              <p className="mt-1 text-sm text-[#e6f3ff]">{plan.likelyHiddenObjection}</p>
            </div>
            <div className="rounded-2xl border border-[#2b4d6f] bg-[#10253d] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Best Response Path</p>
              <p className="mt-1 text-sm text-[#e6f3ff]">{plan.bestResponsePath}</p>
            </div>
            <div className="rounded-2xl border border-[#2b4d6f] bg-[#10253d] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Next-Step Recommendation</p>
              <p className="mt-1 text-sm text-[#e6f3ff]">{plan.nextStepRecommendation}</p>
            </div>
            <div className="rounded-2xl border border-[#2b4d6f] bg-[#10253d] p-3 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.14em] text-[#7de9ff]">Optional De-Escalation Phrasing</p>
              <p className="mt-1 text-sm text-[#e6f3ff]">{plan.deEscalationPhrasing}</p>
            </div>
          </CardContent>
        </Card>

        <FeatureGate
          feature={FEATURES.SPROCKET}
          entitlements={entitlements}
          fallback={() => (
            <Card className="border-[#2f4568] bg-[#0f1c31]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Coaching</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-[#d8e6fb]">Sprocket can read message notes, spot the real objection under the fee complaint, and rewrite your delivery in different tones.</p>
                <div className="relative overflow-hidden rounded-xl border border-[#2c4464] bg-[#0b1728]/85 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7fa7cf]">Sample preview</p>
                  <div className="space-y-2 text-sm text-[#c3d5ec]">
                    <p>Example diagnosis: trust, payment, or surprise may be the real issue.</p>
                    <p>Example rewrites: calm, direct, and empathetic delivery options.</p>
                    <p>Example next move: de-escalate first, then choose whether to clarify or escalate.</p>
                  </div>
                </div>
                <Button
                  className="bg-[#9DEE75] text-[#0d1d11] hover:bg-[#ABF28A]"
                  onClick={() => {
                    setUpgradeContextMessage('AutoDriveCX unlocks Sprocket fee coaching.');
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
              <CardTitle className="flex items-center gap-2 text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Coaching</CardTitle>
              <CardDescription className="text-[#a7c6dc]">Upgrade notes into a smarter read and tone-specific rewrites.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="h-11 bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]" onClick={() => withUsageTracking(() => { void handleRunSprocket(); })}>
                {isRunningSprocket ? 'Running Sprocket...' : 'Run Sprocket Coaching'}
              </Button>
              {sprocketOutput && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                    <p className="font-semibold text-[#88f3ff]">Note interpretation</p>
                    <p className="mt-1">{sprocketOutput.noteInterpretation}</p>
                  </div>
                  <div className="rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                    <p className="font-semibold text-[#88f3ff]">Real objection</p>
                    <p className="mt-1">{sprocketOutput.realObjection}</p>
                  </div>
                  <div className="rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                    <p className="font-semibold text-[#88f3ff]">Best next move</p>
                    <p className="mt-1">{sprocketOutput.bestNextMove}</p>
                  </div>
                  <div className="rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                    <p className="font-semibold text-[#88f3ff]">How not to trigger more resistance</p>
                    <p className="mt-1">{sprocketOutput.triggerAvoidance}</p>
                  </div>
                  <div className="rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                    <p className="font-semibold text-[#88f3ff]">Calm rewrite</p>
                    <p className="mt-1">{sprocketOutput.calmRewrite}</p>
                  </div>
                  <div className="rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                    <p className="font-semibold text-[#88f3ff]">Direct rewrite</p>
                    <p className="mt-1">{sprocketOutput.directRewrite}</p>
                  </div>
                  <div className="rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                    <p className="font-semibold text-[#88f3ff]">Empathetic rewrite</p>
                    <p className="mt-1">{sprocketOutput.empatheticRewrite}</p>
                  </div>
                  <div className="rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                    <p className="font-semibold text-[#88f3ff]">Assertive rewrite</p>
                    <p className="mt-1">{sprocketOutput.assertiveRewrite}</p>
                  </div>
                  <div className="rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb] md:col-span-2">
                    <p className="font-semibold text-[#88f3ff]">Trust-rebuilding rewrite</p>
                    <p className="mt-1">{sprocketOutput.trustRebuildingRewrite}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </FeatureGate>

        <FeatureGate
          feature={FEATURES.AUTODRIVE_CX}
          entitlements={entitlements}
          fallback={() => null}
        >
          <Card className="border-[#2a3f5f] bg-[#0f1b30]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#f4fbff]"><BrainCircuit className="h-4 w-4 text-[#9DEE75]" /> AutoDriveCX Coaching Layer</CardTitle>
              <CardDescription className="text-[#9cb2cf]">Skill-aware coaching based on existing CX patterns.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="h-11 bg-[#9DEE75] text-[#071107] hover:bg-[#ABF28A]" onClick={() => withUsageTracking(handleRunAutoDrive)}>
                Load Skill-Aware Coaching
              </Button>
              {cxOutput && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-[#315b45] bg-[#102319] p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#9DEE75]">Why this is tailored</p>
                    <p className="mt-1 text-sm text-[#e4ffea]">{cxOutput.tailoredReason}</p>
                  </div>
                  <div className="rounded-xl border border-[#315b45] bg-[#102319] p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#9DEE75]">Recurring coaching pattern</p>
                    <p className="mt-1 text-sm text-[#e4ffea]">{cxOutput.coachingPattern}</p>
                  </div>
                  <div className="rounded-xl border border-[#315b45] bg-[#102319] p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#9DEE75]">Recommended adjustment</p>
                    <p className="mt-1 text-sm text-[#e4ffea]">{cxOutput.recommendedAdjustment}</p>
                  </div>
                  <div className="rounded-xl border border-[#315b45] bg-[#102319] p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-[#9DEE75]">Skill-aware tip</p>
                    <p className="mt-1 text-sm text-[#e4ffea]">{cxOutput.skillAwareTip}</p>
                  </div>
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
              <p className="text-sm text-[#90a7ca]">No saved fee scenarios yet.</p>
            ) : (
              savedScenarios.slice(0, 8).map((scenario) => (
                <div key={scenario.id} className="rounded-xl border border-[#29415e] bg-[#0c182a] p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#e8f1ff]">{scenario.scenarioSummary}</p>
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
                  <p className="text-sm text-[#c9d7ee]">{scenario.primaryApproach}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#223555] bg-[#08111f]/94 backdrop-blur">
        <div className="mx-auto flex max-w-5xl gap-2 px-4 py-3 sm:px-5 md:px-8">
          <Button className="h-11 flex-1 bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]" onClick={handleCopy}>
            <Copy className="mr-2 h-4 w-4" /> Copy Script
          </Button>
          <Button className="h-11 flex-1 bg-[#182945] text-[#e6f0ff] hover:bg-[#253a60]" onClick={() => withUsageTracking(handleSaveLocal)}>
            <Save className="mr-2 h-4 w-4" /> Save Local
          </Button>
          <Button
            className="h-11 flex-1 border border-[#3c5878] bg-[#0f1b30] text-[#dce7f8] hover:bg-[#172845]"
            onClick={() => withUsageTracking(() => { void handleSaveCloud(); })}
            disabled={isCloudSaving}
          >
            <Cloud className="mr-2 h-4 w-4" /> {isCloudSaving ? 'Saving...' : 'Save Cloud'}
          </Button>
        </div>
      </div>

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
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks fee coaching and personalization.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

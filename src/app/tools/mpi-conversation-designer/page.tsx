'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, BrainCircuit, ChevronLeft, Cloud, Copy, Save, Sparkles, Star } from 'lucide-react';
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
  MPI_CUSTOMER_ATTITUDES,
  MPI_ITEM_LEVELS,
  MPI_URGENCY_LEVELS,
  getAutoDriveCxMpiConversationEnhancement,
  getMpiConversationPlan,
  getSprocketMpiConversationEnhancement,
  type MpiConversationInput,
  type MpiConversationSavedScenario,
  type MpiCustomerAttitude,
  type MpiItemLevel,
  type MpiUrgencyLevel,
} from '@/lib/tools/mpi-conversation-designer';

const TOOL_ID = 'mpi-conversation-designer';
const LOCAL_SCENARIOS_KEY = 'mpiConversationDesignerSavedScenariosV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function readLocalScenarios(): MpiConversationSavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MpiConversationSavedScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScenarios(scenarios: MpiConversationSavedScenario[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios));
}

function buildCloudContent(input: MpiConversationInput, summary: string): string {
  return [
    'MPI CONVERSATION DESIGNER',
    '',
    `Priority Stack: ${input.priorityStack.join(' -> ')}`,
    `Urgency Level: ${input.urgencyLevel}`,
    `Budget Sensitivity: ${input.budgetSensitivity}`,
    `Customer Attitude: ${input.customerAttitude ?? 'not set'}`,
    '',
    summary,
  ].join('\n');
}

function moveItem(stack: MpiItemLevel[], index: number, direction: -1 | 1): MpiItemLevel[] {
  const next = [...stack];
  const target = index + direction;
  if (target < 0 || target >= next.length) return stack;
  const temp = next[index];
  next[index] = next[target];
  next[target] = temp;
  return next;
}

function urgencyLevelHeight(level: MpiUrgencyLevel): number {
  if (level === 'low') return 25;
  if (level === 'moderate') return 50;
  if (level === 'high') return 75;
  return 100;
}

export default function MpiConversationDesignerPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [priorityStack, setPriorityStack] = useState<MpiItemLevel[]>(['red', 'yellow', 'green']);
  const [urgencyLevel, setUrgencyLevel] = useState<MpiUrgencyLevel>('moderate');
  const [budgetSensitivity, setBudgetSensitivity] = useState(52);
  const [customerAttitude, setCustomerAttitude] = useState<MpiCustomerAttitude | null>('neutral');
  const [savedScenarios, setSavedScenarios] = useState<MpiConversationSavedScenario[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketMpiConversationEnhancement> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxMpiConversationEnhancement> | null>(null);

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
  }, [priorityStack, urgencyLevel, budgetSensitivity, customerAttitude]);

  const input = useMemo<MpiConversationInput>(() => ({
    priorityStack,
    urgencyLevel,
    budgetSensitivity,
    customerAttitude,
  }), [priorityStack, urgencyLevel, budgetSensitivity, customerAttitude]);

  const plan = useMemo(() => getMpiConversationPlan(input), [input]);
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

  const handleMove = (index: number, direction: -1 | 1) => {
    withUsageTracking(() => {
      setPriorityStack((prev) => moveItem(prev, index, direction));
    });
  };

  const handleCopy = useCallback(async () => {
    const payload = [
      `[Best Order To Present] ${plan.bestOrderToPresent}`,
      `[Lead With This] ${plan.leadWithThis}`,
      `[How To Frame Urgency] ${plan.howToFrameUrgency}`,
      `[Ask This] ${plan.askThis}`,
      `[Do Not Do This] ${plan.doNotDoThis}`,
    ].join('\n\n');
    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'MPI conversation plan copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [plan, toast]);

  const handleSaveLocal = useCallback(() => {
    const scenario: MpiConversationSavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      priorityStack,
      urgencyLevel,
      budgetSensitivity,
      customerAttitude,
      bestOrderToPresent: plan.bestOrderToPresent,
      leadWithThis: plan.leadWithThis,
      howToFrameUrgency: plan.howToFrameUrgency,
      askThis: plan.askThis,
      doNotDoThis: plan.doNotDoThis,
      favorite: false,
    };

    const next = [scenario, ...savedScenarios].slice(0, 40);
    setSavedScenarios(next);
    writeLocalScenarios(next);
    toast({ title: 'Saved locally', description: 'Scenario saved on this device.' });
  }, [priorityStack, urgencyLevel, budgetSensitivity, customerAttitude, plan, savedScenarios, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock cloud saves to sync MPI conversation scenarios.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this scenario.' });
      return;
    }
    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(input, `Best Order To Present: ${plan.bestOrderToPresent}\nLead With This: ${plan.leadWithThis}`),
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
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for sharper MPI sequencing and wording.')) return;
    setSprocketOutput(getSprocketMpiConversationEnhancement(input, plan));
  }, [input, plan, requireFeature]);

  const handleRunAutoDrive = useCallback(() => {
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for personalized MPI adaptation.')) return;
    setCxOutput(getAutoDriveCxMpiConversationEnhancement(input, plan, user));
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
      console.warn('[MpiConversationDesigner] unlock capture failed:', captureResult.message);
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
          <h1 className="text-2xl font-semibold tracking-tight text-[#f5f9ff] md:text-3xl">MPI Conversation Designer</h1>
          <p className="max-w-2xl text-sm text-[#a7b7d1] md:text-base">
            Turn MPI findings into a structured, customer-friendly conversation with clearer urgency framing.
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
            <CardTitle className="text-lg text-[#f2f7ff]">Priority Stack Builder</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Reorder red/yellow/green to design conversation flow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {priorityStack.map((level, index) => (
              <div key={`${level}-${index}`} className="flex items-center gap-2 rounded-xl border border-[#335376] bg-[#102541] px-3 py-2">
                <p className="flex-1 text-sm font-semibold text-[#e8f3ff]">{index + 1}. {level.toUpperCase()} items</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-[#bcd1ee] hover:bg-[#173153]"
                  disabled={index === 0}
                  onClick={() => handleMove(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-[#bcd1ee] hover:bg-[#173153]"
                  disabled={index === priorityStack.length - 1}
                  onClick={() => handleMove(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2">
              {MPI_ITEM_LEVELS.map((level) => (
                <ChipButton key={level} active={priorityStack[0] === level} label={level} onClick={() => withUsageTracking(() => setPriorityStack((prev) => [level, ...prev.filter((v) => v !== level)]))} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">Urgency Ladder</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Define how strongly urgency should be framed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-32 w-8 rounded-full border border-[#355274] bg-[#12263f] p-1">
              <div
                className="w-full rounded-full bg-gradient-to-t from-[#2d83ff] to-[#ff6f7d]"
                style={{ height: `${urgencyLevelHeight(urgencyLevel)}%`, marginTop: `${100 - urgencyLevelHeight(urgencyLevel)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MPI_URGENCY_LEVELS.map((level) => (
                <ChipButton key={level} active={urgencyLevel === level} label={level} onClick={() => withUsageTracking(() => setUrgencyLevel(level))} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">Budget Sensitivity Slider</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Adjust how much budget constraints shape the conversation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm text-[#c8d8f1]">
              <span>Low</span>
              <span className="font-semibold text-[#eff7ff]">{budgetSensitivity}</span>
              <span>High</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={budgetSensitivity}
              onChange={(event) => withUsageTracking(() => setBudgetSensitivity(clamp(Number(event.target.value))))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#1a304c]"
            />
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">Conversation Map Preview</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Visual order of discussion path.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {priorityStack.map((item, index) => (
              <div key={`${item}-map-${index}`} className="flex items-start gap-2">
                <div className="flex flex-col items-center">
                  <span className="h-2 w-2 rounded-full bg-[#00d8e5]" />
                  {index < priorityStack.length - 1 ? <span className="h-5 w-px bg-[#4d6c91]" /> : null}
                </div>
                <p className="text-sm text-[#dce9fb]">Discuss {item.toUpperCase()} findings</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader><CardTitle className="text-lg text-[#f2f7ff]">Optional Customer Attitude</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <ChipButton active={customerAttitude === null} label="Not set" onClick={() => withUsageTracking(() => setCustomerAttitude(null))} />
            {MPI_CUSTOMER_ATTITUDES.map((attitude) => (
              <ChipButton key={attitude} active={customerAttitude === attitude} label={attitude} onClick={() => withUsageTracking(() => setCustomerAttitude(attitude))} />
            ))}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[#f4f8ff]">Conversation Strategy</h2>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Best Order To Present</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.bestOrderToPresent}</p></CardContent>
          </Card>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Lead With This</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.leadWithThis}</p></CardContent>
          </Card>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">How To Frame Urgency</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.howToFrameUrgency}</p></CardContent>
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
                <CardTitle className="flex items-center gap-2 text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Layer</CardTitle>
                <CardDescription className="text-[#9cb0cd]">Sharper MPI sequencing and simpler customer wording.</CardDescription>
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
            <CardHeader><CardTitle className="flex items-center gap-2 text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Layer</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button className="h-11 bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]" onClick={() => withUsageTracking(handleRunSprocket)}>
                Run Sprocket Enhancement
              </Button>
              {sprocketOutput && (
                <div className="space-y-2 rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                  <p><span className="font-semibold text-[#88f3ff]">Sharper sequencing:</span> {sprocketOutput.sharperSequencing}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Clearer wording:</span> {sprocketOutput.clearerWording}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Natural rewrite:</span> {sprocketOutput.naturalRewrite}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Simplification coaching:</span> {sprocketOutput.simplificationCoaching}</p>
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
                <CardDescription className="text-[#9cb0cd]">Skill-aware MPI conversation adaptation.</CardDescription>
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
            <CardHeader><CardTitle className="flex items-center gap-2 text-[#9ff5ff]"><BrainCircuit className="h-4 w-4" /> AutoDriveCX Layer</CardTitle></CardHeader>
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
                    <p className="text-sm font-semibold text-[#e8f1ff]">{scenario.priorityStack[0].toUpperCase()} first - {scenario.urgencyLevel}</p>
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
                  <p className="text-sm text-[#c9d7ee]">{scenario.leadWithThis}</p>
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
        defaultRole={accountProfile?.role || 'manager'}
        onOpenChange={setShowEmailGate}
        onSubmit={handleUnlockByEmail}
      />

      <UpgradeModal
        open={gateModalType !== null}
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks personalized MPI conversation adaptation.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

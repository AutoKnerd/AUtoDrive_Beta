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
  DESK_CUSTOMER_POSTURES,
  DESK_INVOLVEMENT_REASONS,
  DESK_SALESPERSON_PROGRESS,
  DESK_URGENCY_LEVELS,
  getAutoDriveCxDeskConversationEnhancement,
  getDeskConversationPlan,
  getSprocketDeskConversationEnhancement,
  type DeskConversationInput,
  type DeskConversationSavedScenario,
  type DeskCustomerPosture,
  type DeskInvolvementReason,
  type DeskSalespersonProgress,
  type DeskUrgencyLevel,
} from '@/lib/tools/desk-conversation-planner';

const TOOL_ID = 'desk-conversation';
const LOCAL_SCENARIOS_KEY = 'deskConversationSavedScenariosV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

function readLocalScenarios(): DeskConversationSavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeskConversationSavedScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScenarios(scenarios: DeskConversationSavedScenario[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios));
}

function buildCloudContent(input: DeskConversationInput, summary: string): string {
  return [
    'DESK CONVERSATION PLANNER',
    '',
    `Reason: ${input.reason}`,
    `Customer Posture: ${input.customerPosture}`,
    `Salesperson Progress: ${input.salespersonProgress}`,
    `Urgency: ${input.urgency}`,
    '',
    summary,
  ].join('\n');
}

export default function DeskConversationPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [reason, setReason] = useState<DeskInvolvementReason>('price objection');
  const [customerPosture, setCustomerPosture] = useState<DeskCustomerPosture>('skeptical');
  const [salespersonProgress, setSalespersonProgress] = useState<DeskSalespersonProgress>('decent');
  const [urgency, setUrgency] = useState<DeskUrgencyLevel>('medium');
  const [savedScenarios, setSavedScenarios] = useState<DeskConversationSavedScenario[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketDeskConversationEnhancement> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxDeskConversationEnhancement> | null>(null);

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
  }, [reason, customerPosture, salespersonProgress, urgency]);

  const input = useMemo<DeskConversationInput>(() => ({
    reason,
    customerPosture,
    salespersonProgress,
    urgency,
  }), [reason, customerPosture, salespersonProgress, urgency]);

  const plan = useMemo(() => getDeskConversationPlan(input), [input]);

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
      `[Best Entry Angle] ${plan.bestEntryAngle}`,
      `[Say This First] ${plan.sayThisFirst}`,
      `[Ask This] ${plan.askThis}`,
      `[Reinforce This] ${plan.reinforceThis}`,
      `[Do Not Do This] ${plan.doNotDoThis}`,
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Desk plan copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [plan, toast]);

  const handleSaveLocal = useCallback(() => {
    const scenario: DeskConversationSavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      reason,
      customerPosture,
      salespersonProgress,
      urgency,
      bestEntryAngle: plan.bestEntryAngle,
      sayThisFirst: plan.sayThisFirst,
      askThis: plan.askThis,
      reinforceThis: plan.reinforceThis,
      doNotDoThis: plan.doNotDoThis,
      favorite: false,
    };

    const next = [scenario, ...savedScenarios].slice(0, 40);
    setSavedScenarios(next);
    writeLocalScenarios(next);
    toast({ title: 'Saved locally', description: 'Scenario saved on this device.' });
  }, [customerPosture, plan.askThis, plan.bestEntryAngle, plan.doNotDoThis, plan.reinforceThis, plan.sayThisFirst, reason, salespersonProgress, savedScenarios, toast, urgency]);

  const handleSaveCloud = useCallback(async () => {
    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock cloud saves to sync desk conversation scenarios.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this scenario.' });
      return;
    }

    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(input, `Best Entry Angle: ${plan.bestEntryAngle}\nAsk This: ${plan.askThis}`),
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
  }, [firebaseUser, input, plan.askThis, plan.bestEntryAngle, requireFeature, toast]);

  const handleRunSprocket = useCallback(() => {
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for deeper desk-entry coaching.')) return;
    setSprocketOutput(applySprocketCxOverlay(getSprocketDeskConversationEnhancement(input, plan), user));
  }, [input, plan, requireFeature]);

  const handleRunAutoDrive = useCallback(() => {
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for personalized desk conversation guidance.')) return;
    setCxOutput(getAutoDriveCxDeskConversationEnhancement(input, plan, user));
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
      console.warn('[DeskConversation] unlock capture failed:', captureResult.message);
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
          ? 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-[#00d8e5] dark:bg-[#00f2ff]/15 dark:text-[#e6fdff]'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[#2c3e5c] dark:bg-[#101c30] dark:text-[#d2def2] dark:hover:bg-[#152743]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#070d18] dark:text-[#dce7f8]">
      <Header />

      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-24 pt-4 sm:px-5 md:space-y-6 md:px-8 md:pt-8">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" asChild className="h-10 px-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-[#b8c8e2] dark:hover:bg-[#13233b] dark:hover:text-[#e6efff]">
            <Link href="/tools">
              <ChevronLeft className="mr-1 h-4 w-4" />
              AutoShop
            </Link>
          </Button>
          <Badge className="border border-[#00d8e5]/40 bg-[#00f2ff]/10 text-[#6eeef8]">AutoDriveCX</Badge>
        </div>

        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-[#f5f9ff] md:text-3xl">Desk Conversation Planner</h1>
          <p className="max-w-2xl text-sm text-slate-600 dark:text-[#a7b7d1] md:text-base">
            Help managers enter live deals with strategy, continuity, and better customer alignment.
          </p>
        </section>

        {!canUseBaseTool && (
          <Card className="border-rose-200 bg-rose-50 dark:border-[#3f2a2a] dark:bg-[#231718]">
            <CardHeader>
              <CardTitle className="text-lg text-rose-900 dark:text-[#ffe5e5]">Free limit reached</CardTitle>
              <CardDescription className="text-rose-700 dark:text-[#f2b6b6]">Add email and role to keep using standalone tools.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="bg-[#76ff8f] text-[#0d1d11] hover:bg-[#92ffa7]" onClick={() => setShowEmailGate(true)}>
                Continue with Free Account
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200 bg-white dark:border-[#2b3e5d] dark:bg-[#0f1b30]">
          <CardHeader><CardTitle className="text-lg text-slate-900 dark:text-[#f2f7ff]">1. Reason for Manager Involvement</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DESK_INVOLVEMENT_REASONS.map((item) => (
              <ChipButton key={item} active={reason === item} label={item} onClick={() => withUsageTracking(() => setReason(item))} />
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white dark:border-[#2b3e5d] dark:bg-[#0f1b30]">
          <CardHeader><CardTitle className="text-lg text-slate-900 dark:text-[#f2f7ff]">2. Customer Posture</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {DESK_CUSTOMER_POSTURES.map((item) => (
              <ChipButton key={item} active={customerPosture === item} label={item} onClick={() => withUsageTracking(() => setCustomerPosture(item))} />
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white dark:border-[#2b3e5d] dark:bg-[#0f1b30]">
          <CardHeader><CardTitle className="text-lg text-slate-900 dark:text-[#f2f7ff]">3. Salesperson Progress</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DESK_SALESPERSON_PROGRESS.map((item) => (
              <ChipButton key={item} active={salespersonProgress === item} label={item} onClick={() => withUsageTracking(() => setSalespersonProgress(item))} />
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white dark:border-[#2b3e5d] dark:bg-[#0f1b30]">
          <CardHeader><CardTitle className="text-lg text-slate-900 dark:text-[#f2f7ff]">4. Urgency</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-2">
            {DESK_URGENCY_LEVELS.map((item) => (
              <ChipButton key={item} active={urgency === item} label={item} onClick={() => withUsageTracking(() => setUrgency(item))} />
            ))}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-[#f4f8ff]">Manager Entry Plan</h2>

          <Card className="border-slate-200 bg-slate-50 dark:border-[#2d4b66] dark:bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-cyan-700 dark:text-[#7eeeff]">Best Entry Angle</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-slate-800 dark:text-[#eff6ff]">{plan.bestEntryAngle}</p></CardContent>
          </Card>
          <Card className="border-slate-200 bg-slate-50 dark:border-[#2d4b66] dark:bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-cyan-700 dark:text-[#7eeeff]">Say This First</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-slate-800 dark:text-[#eff6ff]">{plan.sayThisFirst}</p></CardContent>
          </Card>
          <Card className="border-slate-200 bg-slate-50 dark:border-[#2d4b66] dark:bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-cyan-700 dark:text-[#7eeeff]">Ask This</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-slate-800 dark:text-[#eff6ff]">{plan.askThis}</p></CardContent>
          </Card>
          <Card className="border-slate-200 bg-slate-50 dark:border-[#2d4b66] dark:bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-cyan-700 dark:text-[#7eeeff]">Reinforce This</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-slate-800 dark:text-[#eff6ff]">{plan.reinforceThis}</p></CardContent>
          </Card>
          <Card className="border-slate-200 bg-slate-50 dark:border-[#2d4b66] dark:bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-rose-700 dark:text-[#ffb8b8]">Do Not Do This</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-rose-700 dark:text-[#ffd8d8]">{plan.doNotDoThis}</p></CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button className="h-11 bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-[#172845] dark:text-[#eaf2ff] dark:hover:bg-[#22375a]" onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
            <Button className="h-11 bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-[#172845] dark:text-[#eaf2ff] dark:hover:bg-[#22375a]" onClick={() => withUsageTracking(handleSaveLocal)}>
              <Save className="mr-2 h-4 w-4" /> Save Local
            </Button>
            <Button
              className="h-11 border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-[#3c5878] dark:bg-[#0f1b30] dark:text-[#dce7f8] dark:hover:bg-[#172845]"
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
            <Card className="border-slate-200 bg-white dark:border-[#2f4568] dark:bg-[#0f1c31]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Insight</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-[#2f4568]" />
                <p className="text-sm text-slate-700 dark:text-[#d8e6fb]">There's a smarter way to sequence this conversation based on trust signals, urgency, and customer skepticism.</p>
                <p className="text-sm text-slate-600 dark:text-[#c5d6ef]">The system can adapt your wording, proof order, and next move in real time.</p>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-[#8ca5c7]">Unlocked with AutoDriveCX</p>
                <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-slate-100/90 p-3 dark:border-[#2c4464] dark:bg-[#0b1728]/85">
                  <div className="space-y-2 text-sm text-slate-600 opacity-70 blur-[8px] select-none pointer-events-none dark:text-[#c3d5ec]">
                    <p className="font-semibold text-amber-700 dark:text-[#f3c46b]">Failure Risk Detected</p>
                    <p>Customer may delay due to...</p>
                    <p className="font-semibold text-cyan-700 dark:text-[#9fe8ff]">Recommended Shift</p>
                    <p>Lead with...</p>
                    <p className="font-semibold text-cyan-700 dark:text-[#9fe8ff]">Next Best Action</p>
                    <p>Ask: "If this fails..."</p>
                  </div>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-100 via-slate-100/90 to-transparent dark:from-[#0b1728] dark:via-[#0b1728]/90" />
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
          <Card className="border-slate-200 bg-white dark:border-[#1f4b66] dark:bg-[#0c2236]">
            <CardHeader><CardTitle className="flex items-center gap-2 text-slate-900 dark:text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Insight</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button className="h-11 bg-cyan-600 text-white hover:bg-cyan-500 dark:bg-[#00d8e5] dark:text-[#06232b] dark:hover:bg-[#39eaf4]" onClick={() => withUsageTracking(handleRunSprocket)}>
                Run Sprocket Enhancement
              </Button>

              {sprocketOutput && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 dark:border-[#2e5872] dark:bg-[#0c1d2f] dark:text-[#dce9fb]">
                  <p><span className="font-semibold text-cyan-700 dark:text-[#88f3ff]">Likely hidden issue:</span> {sprocketOutput.likelyHiddenIssue}</p>
                  <p><span className="font-semibold text-cyan-700 dark:text-[#88f3ff]">Sharper manager entry:</span> {sprocketOutput.sharperManagerEntry}</p>
                  <p><span className="font-semibold text-cyan-700 dark:text-[#88f3ff]">Natural rewrite:</span> {sprocketOutput.naturalRewrite}</p>
                  <p><span className="font-semibold text-cyan-700 dark:text-[#88f3ff]">Coaching:</span> {sprocketOutput.coaching}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </FeatureGate>

        <Card className="border-slate-200 bg-white dark:border-[#2b3e5d] dark:bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-slate-900 dark:text-[#f2f7ff]">Saved Local Scenarios</CardTitle>
            <CardDescription className="text-slate-600 dark:text-[#9cb0cd]">
              {savedScenarios.length} saved on this device. {favoriteCount} favorited.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedScenarios.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-[#90a7ca]">No saved scenarios yet.</p>
            ) : (
              savedScenarios.slice(0, 6).map((scenario) => (
                <div key={scenario.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#29415e] dark:bg-[#0c182a]">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-[#e8f1ff]">{scenario.reason} - {scenario.customerPosture}</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-[#bdd0ea] dark:hover:bg-[#172845] dark:hover:text-[#fff8ca]"
                      onClick={() => toggleFavorite(scenario.id)}
                    >
                      <Star className={`mr-1 h-4 w-4 ${scenario.favorite ? 'fill-[#ffd95e] text-[#ffd95e]' : ''}`} />
                      {scenario.favorite ? 'Favorited' : 'Favorite'}
                    </Button>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-[#c9d7ee]">{scenario.bestEntryAngle}</p>
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
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks skill-aware desk-conversation intelligence.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

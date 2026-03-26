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
  STATUS_CHANNELS,
  STATUS_SENSITIVITY,
  STATUS_JOB_STATES,
  STATUS_REASONS,
  getAutoDriveCxStatusUpdateEnhancement,
  getSprocketStatusUpdateEnhancement,
  getStatusUpdatePlan,
  type StatusChannel,
  type StatusSensitivity,
  type StatusJobState,
  type StatusReason,
  type StatusUpdateInput,
  type StatusUpdateSavedScenario,
} from '@/lib/tools/status-update-composer';

const TOOL_ID = 'status-update';
const LOCAL_SCENARIOS_KEY = 'statusUpdateSavedScenariosV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

function readLocalScenarios(): StatusUpdateSavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StatusUpdateSavedScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScenarios(scenarios: StatusUpdateSavedScenario[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios));
}

function buildCloudContent(input: StatusUpdateInput, summary: string): string {
  return [
    'STATUS UPDATE COMPOSER',
    '',
    `Job Status: ${input.jobStatus}`,
    `Reason: ${input.reason}`,
    `Sensitivity: ${input.customerSensitivity}`,
    `Channel: ${input.channel}`,
    '',
    summary,
  ].join('\n');
}

export default function StatusUpdatePage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [jobStatus, setJobStatus] = useState<StatusJobState>('inspection in progress');
  const [reason, setReason] = useState<StatusReason>('routine update');
  const [customerSensitivity, setCustomerSensitivity] = useState<StatusSensitivity>('anxious');
  const [channel, setChannel] = useState<StatusChannel>('text');
  const [savedScenarios, setSavedScenarios] = useState<StatusUpdateSavedScenario[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketStatusUpdateEnhancement> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxStatusUpdateEnhancement> | null>(null);

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
  }, [jobStatus, reason, customerSensitivity, channel]);

  const input = useMemo<StatusUpdateInput>(() => ({
    jobStatus,
    reason,
    customerSensitivity,
    channel,
  }), [jobStatus, reason, customerSensitivity, channel]);

  const plan = useMemo(() => getStatusUpdatePlan(input), [input]);

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
      `[Best Update Structure] ${plan.bestUpdateStructure}`,
      `[Say This] ${plan.sayThis}`,
      `[Set This Expectation] ${plan.setThisExpectation}`,
      `[Next Step] ${plan.nextStep}`,
      `[Do Not Say This] ${plan.doNotSayThis}`,
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Status update copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [plan, toast]);

  const handleSaveLocal = useCallback(() => {
    const scenario: StatusUpdateSavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      jobStatus,
      reason,
      customerSensitivity,
      channel,
      bestUpdateStructure: plan.bestUpdateStructure,
      sayThis: plan.sayThis,
      setThisExpectation: plan.setThisExpectation,
      nextStep: plan.nextStep,
      doNotSayThis: plan.doNotSayThis,
      favorite: false,
    };

    const next = [scenario, ...savedScenarios].slice(0, 40);
    setSavedScenarios(next);
    writeLocalScenarios(next);
    toast({ title: 'Saved locally', description: 'Scenario saved on this device.' });
  }, [channel, customerSensitivity, jobStatus, plan.bestUpdateStructure, plan.doNotSayThis, plan.nextStep, plan.sayThis, plan.setThisExpectation, reason, savedScenarios, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock cloud saves to sync status update scenarios.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this scenario.' });
      return;
    }

    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(input, `Best Update Structure: ${plan.bestUpdateStructure}\nSet Expectation: ${plan.setThisExpectation}`),
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
  }, [firebaseUser, input, plan.bestUpdateStructure, plan.setThisExpectation, requireFeature, toast]);

  const handleRunSprocket = useCallback(() => {
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for sharper update coaching.')) return;
    setSprocketOutput(applySprocketCxOverlay(getSprocketStatusUpdateEnhancement(input, plan), user));
  }, [input, plan, requireFeature]);

  const handleRunAutoDrive = useCallback(() => {
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for personalized communication guidance.')) return;
    setCxOutput(getAutoDriveCxStatusUpdateEnhancement(input, plan, user));
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
      console.warn('[StatusUpdate] unlock capture failed:', captureResult.message);
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
              AutoShop
            </Link>
          </Button>
          <Badge className="border border-[#00d8e5]/40 bg-[#00f2ff]/10 text-[#6eeef8]">AutoDriveCX</Badge>
        </div>

        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[#f5f9ff] md:text-3xl">Status Update Composer</h1>
          <p className="max-w-2xl text-sm text-[#a7b7d1] md:text-base">
            Build clear, trust-building service updates with better timing and next-step clarity.
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
          <CardHeader><CardTitle className="text-lg text-[#f2f7ff]">1. Job Status</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STATUS_JOB_STATES.map((item) => (
              <ChipButton key={item} active={jobStatus === item} label={item} onClick={() => withUsageTracking(() => setJobStatus(item))} />
            ))}
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader><CardTitle className="text-lg text-[#f2f7ff]">2. Reason for Update</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STATUS_REASONS.map((item) => (
              <ChipButton key={item} active={reason === item} label={item} onClick={() => withUsageTracking(() => setReason(item))} />
            ))}
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader><CardTitle className="text-lg text-[#f2f7ff]">3. Customer Sensitivity</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STATUS_SENSITIVITY.map((item) => (
              <ChipButton key={item} active={customerSensitivity === item} label={item} onClick={() => withUsageTracking(() => setCustomerSensitivity(item))} />
            ))}
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader><CardTitle className="text-lg text-[#f2f7ff]">4. Channel</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STATUS_CHANNELS.map((item) => (
              <ChipButton key={item} active={channel === item} label={item} onClick={() => withUsageTracking(() => setChannel(item))} />
            ))}
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[#f4f8ff]">Update Plan</h2>

          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Best Update Structure</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.bestUpdateStructure}</p></CardContent>
          </Card>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Say This</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.sayThis}</p></CardContent>
          </Card>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Set This Expectation</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.setThisExpectation}</p></CardContent>
          </Card>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#7eeeff]">Next Step</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#eff6ff]">{plan.nextStep}</p></CardContent>
          </Card>
          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader><CardTitle className="text-base text-[#ffb8b8]">Do Not Say This</CardTitle></CardHeader>
            <CardContent><p className="text-sm text-[#ffd8d8]">{plan.doNotSayThis}</p></CardContent>
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
                  <p><span className="font-semibold text-[#88f3ff]">Better tone:</span> {sprocketOutput.betterTone}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Natural rewrite:</span> {sprocketOutput.naturalRewrite}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Delivery coaching:</span> {sprocketOutput.deliveryCoaching}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Likely reaction prep:</span> {sprocketOutput.likelyReactionPrep}</p>
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
                    <p className="text-sm font-semibold text-[#e8f1ff]">{scenario.reason} - {scenario.channel}</p>
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
                  <p className="text-sm text-[#c9d7ee]">{scenario.bestUpdateStructure}</p>
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
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks skill-aware status communication intelligence.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

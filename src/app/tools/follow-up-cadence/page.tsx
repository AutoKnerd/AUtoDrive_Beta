'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BrainCircuit, ChevronLeft, Cloud, Copy, Download, Save, Sparkles, Star } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { EmailGateModal } from '@/components/tools/email-gate-modal';
import { FeatureGate } from '@/components/tools/feature-gate';
import { UpgradeModal } from '@/components/tools/upgrade-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  saveToolboxEntry,
} from '@/lib/tools/toolbox-client';
import { clearFullToolHandoff, readFullToolHandoff } from '@/lib/tools/toolbox-storage';
import { applySprocketCxOverlay } from '@/lib/tools/sprocket-cx-overlay';
import {
  FOLLOW_UP_CUSTOMER_TYPES,
  FOLLOW_UP_DEAL_STATUSES,
  FOLLOW_UP_DURATIONS,
  buildFollowUpCadence,
  getAutoDriveCxFollowUpEnhancement,
  getSprocketFollowUpEnhancement,
  type FollowUpCustomerType,
  type FollowUpDealStatus,
  type FollowUpDuration,
  type FollowUpInput,
  type FollowUpSavedScenario,
} from '@/lib/tools/follow-up-cadence';

const TOOL_ID = 'follow-up-cadence';
const LOCAL_SCENARIOS_KEY = 'followUpCadenceScenariosV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

function readLocalScenarios(): FollowUpSavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FollowUpSavedScenario[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScenarios(scenarios: FollowUpSavedScenario[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(scenarios));
}

function buildCloudContent(input: FollowUpInput, summary: string): string {
  return [
    'FOLLOW-UP CADENCE',
    '',
    `Deal Status: ${input.dealStatus}`,
    `Days: ${input.days}`,
    `Customer Type: ${input.customerType || 'Neutral'}`,
    `Notes: ${input.notes || 'Not provided'}`,
    '',
    summary,
  ].join('\n');
}

async function downloadPdf(payload: unknown, filename = 'follow-up-cadence.pdf') {
  const response = await fetch('/api/tools/follow-up-cadence/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(String(payload?.message || 'Could not generate PDF.'));
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function cadenceSummaryText(input: FollowUpInput) {
  return `${input.dealStatus} • ${input.days}-day cadence • ${input.customerType || 'Neutral'}`;
}

export default function FollowUpCadencePage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [dealStatus, setDealStatus] = useState<FollowUpDealStatus>('No decision after visit');
  const [days, setDays] = useState<FollowUpDuration>(7);
  const [customerType, setCustomerType] = useState<FollowUpCustomerType>('Neutral');
  const [notes, setNotes] = useState('');

  const [savedScenarios, setSavedScenarios] = useState<FollowUpSavedScenario[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketFollowUpEnhancement> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxFollowUpEnhancement> | null>(null);

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
    if (handoff?.draft) {
      setNotes((current) => current || handoff.draft || '');
    }
    clearFullToolHandoff(TOOL_ID);
  }, []);

  useEffect(() => {
    setSprocketOutput(null);
    setCxOutput(null);
  }, [dealStatus, days, customerType, notes]);

  const input = useMemo<FollowUpInput>(() => ({
    dealStatus,
    days,
    customerType,
    notes,
  }), [dealStatus, days, customerType, notes]);

  const cadence = useMemo(() => buildFollowUpCadence(input), [input]);

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
    const timeline = cadence.days
      .map((day) => `Day ${day.day} (${day.action})\nDo: ${day.do}\nSay: ${day.say}`)
      .join('\n\n');

    const payload = [
      `Goal: ${cadence.goal}`,
      `Summary: ${cadence.summary}`,
      '',
      timeline,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Cadence copied and ready to use.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [cadence, toast]);

  const handleSaveLocal = useCallback(() => {
    const scenario: FollowUpSavedScenario = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      dealStatus,
      days,
      customerType,
      goal: cadence.goal,
      summary: cadence.summary,
      favorite: false,
    };

    const next = [scenario, ...savedScenarios].slice(0, 40);
    setSavedScenarios(next);
    writeLocalScenarios(next);
    toast({ title: 'Saved locally', description: 'Cadence saved on this device.' });
  }, [cadence.goal, cadence.summary, customerType, days, dealStatus, savedScenarios, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock cloud saves to sync cadences across devices.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this cadence.' });
      return;
    }

    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(input, cadence.days.map((d) => `Day ${d.day} ${d.action}: ${d.say}`).join('\n')),
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

    toast({ title: 'Saved to cloud', description: 'Cadence now syncs across devices.' });
  }, [cadence.days, firebaseUser, input, requireFeature, toast]);

  const handleRunSprocket = useCallback(() => {
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for smarter cadence coaching.')) return;
    setSprocketOutput(applySprocketCxOverlay(getSprocketFollowUpEnhancement(input, cadence), user));
  }, [cadence, input, requireFeature]);

  const handleRunAutoDrive = useCallback(() => {
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for personalized cadence adaptation.')) return;
    setCxOutput(getAutoDriveCxFollowUpEnhancement(input, cadence, user));
  }, [cadence, input, requireFeature, user]);

  const handleDownloadBasicPdf = useCallback(async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadPdf({
        metadata: {
          dealStatus,
          days,
          customerType,
          notes,
        },
        cadence,
      }, `follow-up-cadence-${days}day.pdf`);
      toast({ title: 'PDF downloaded', description: 'Your printable cadence is ready.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'PDF export failed', description: error?.message || 'Please try again.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [cadence, customerType, days, dealStatus, notes, toast]);

  const handleDownloadEnhancedPdf = useCallback(async () => {
    if (!requireFeature(FEATURES.SPROCKET, 'Enhanced PDF export requires paid AutoShop access.')) return;

    setIsDownloadingPdf(true);
    try {
      await downloadPdf({
        metadata: {
          dealStatus,
          days,
          customerType,
          notes,
        },
        cadence,
        enhancements: {
          sprocket: sprocketOutput,
          autodrive: cxOutput,
        },
      }, `follow-up-cadence-enhanced-${days}day.pdf`);
      toast({ title: 'Enhanced PDF downloaded', description: 'Your coaching-enhanced cadence is ready.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'PDF export failed', description: error?.message || 'Please try again.' });
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [cadence, customerType, cxOutput, days, dealStatus, notes, requireFeature, sprocketOutput, toast]);

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
      console.warn('[FollowUpCadence] unlock capture failed:', captureResult.message);
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
            <Link href="/tools">
              <ChevronLeft className="mr-1 h-4 w-4" />
              AutoShop
            </Link>
          </Button>
          <Badge className="border border-[#00d8e5]/40 bg-[#00f2ff]/10 text-[#6eeef8]">AutoDriveCX</Badge>
        </div>

        <section className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-[#f5f9ff] md:text-3xl">Follow-Up Cadence Builder</h1>
          <p className="max-w-2xl text-sm text-[#a7b7d1] md:text-base">
            Build a clear day-by-day cadence you can execute and export as a printable desk-ready PDF.
          </p>
          <p className="text-xs uppercase tracking-[0.12em] text-[#6f89af]">Consistent follow-up, less guesswork, more momentum</p>
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
            <CardTitle className="text-lg text-[#f2f7ff]">1. Deal Status</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Select where the deal is currently stalled.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FOLLOW_UP_DEAL_STATUSES.map((status) => (
              <ChipButton
                key={status}
                active={dealStatus === status}
                label={status}
                onClick={() => withUsageTracking(() => setDealStatus(status))}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">2. Cadence Setup</CardTitle>
            <CardDescription className="text-[#9cb0cd]">Choose plan length, customer type, and optional notes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#84a0c4]">Days to Follow Up</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FOLLOW_UP_DURATIONS.map((value) => (
                  <ChipButton
                    key={value}
                    active={days === value}
                    label={`${value}-day`}
                    onClick={() => withUsageTracking(() => setDays(value))}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#84a0c4]">Customer Type</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FOLLOW_UP_CUSTOMER_TYPES.map((type) => (
                  <ChipButton
                    key={type}
                    active={customerType === type}
                    label={type}
                    onClick={() => withUsageTracking(() => setCustomerType(type))}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#84a0c4]">Optional notes</p>
              <Textarea
                value={notes}
                onChange={(event) => withUsageTracking(() => setNotes(event.target.value))}
                placeholder="Ex: First visit, trade involved, manager already involved"
                className="min-h-[78px] border-[#2d4262] bg-[#0d1b30] text-[#e6efff]"
              />
            </div>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[#f4f8ff]">Cadence Timeline</h2>

          <Card className="border-[#2d4b66] bg-[#10243a]">
            <CardHeader>
              <CardTitle className="text-base text-[#7eeeff]">Cadence Summary</CardTitle>
              <CardDescription className="text-[#a8bfdc]">{cadenceSummaryText(input)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <p className="text-sm text-[#eff6ff]"><span className="font-semibold">Goal:</span> {cadence.goal}</p>
              <p className="text-sm text-[#eff6ff]"><span className="font-semibold">Plan:</span> {cadence.summary}</p>
            </CardContent>
          </Card>

          {cadence.days.map((day) => (
            <Card key={day.day} className="border-[#2d4b66] bg-[#10243a]">
              <CardHeader>
                <CardTitle className="text-base text-[#7eeeff]">Day {day.day}</CardTitle>
                <CardDescription className="text-[#a8bfdc]">Action: {day.action}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-[#eff6ff]"><span className="font-semibold">Do:</span> {day.do}</p>
                <p className="text-sm text-[#eff6ff]"><span className="font-semibold">Say:</span> {day.say}</p>
              </CardContent>
            </Card>
          ))}

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
            <Button
              className="h-11 bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]"
              onClick={() => withUsageTracking(() => {
                void handleDownloadBasicPdf();
              })}
              disabled={isDownloadingPdf}
            >
              <Download className="mr-2 h-4 w-4" /> {isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}
            </Button>
            <Button
              className="h-11 border border-[#00d8e5]/50 bg-[#00f2ff]/10 text-[#9ef6ff] hover:bg-[#00f2ff]/20"
              onClick={() => withUsageTracking(() => {
                void handleDownloadEnhancedPdf();
              })}
              disabled={isDownloadingPdf}
            >
              <Download className="mr-2 h-4 w-4" /> Enhanced PDF
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
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Insight</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="h-11 bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]" onClick={() => withUsageTracking(handleRunSprocket)}>
                Run Sprocket Enhancement
              </Button>

              {sprocketOutput && (
                <div className="space-y-2 rounded-xl border border-[#2e5872] bg-[#0c1d2f] p-3 text-sm text-[#dce9fb]">
                  <p><span className="font-semibold text-[#88f3ff]">Likely stall reason:</span> {sprocketOutput.likelyStallReason}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Smarter cadence shift:</span> {sprocketOutput.smarterCadenceShift}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Message rewrite tip:</span> {sprocketOutput.messageRewriteTip}</p>
                  <p><span className="font-semibold text-[#88f3ff]">Delivery coaching:</span> {sprocketOutput.deliveryCoaching}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </FeatureGate>

<Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-lg text-[#f2f7ff]">Saved Local Cadences</CardTitle>
            <CardDescription className="text-[#9cb0cd]">
              {savedScenarios.length} saved on this device. {favoriteCount} favorited.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {savedScenarios.length === 0 ? (
              <p className="text-sm text-[#90a7ca]">No saved cadences yet.</p>
            ) : (
              savedScenarios.slice(0, 6).map((scenario) => (
                <div key={scenario.id} className="rounded-xl border border-[#29415e] bg-[#0c182a] p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#e8f1ff]">{scenario.dealStatus} • {scenario.days}-day</p>
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
                  <p className="text-sm text-[#c9d7ee]">{scenario.summary}</p>
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
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks skill-aware follow-up intelligence.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

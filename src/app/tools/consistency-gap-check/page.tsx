'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BrainCircuit, ChevronLeft, Cloud, Copy, RotateCcw, Save, Sparkles, Star } from 'lucide-react';
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
  CONSISTENCY_MODULES,
  CONSISTENCY_ROLES,
  CONSISTENCY_TIMEFRAMES,
  getAutoDriveCxConsistencyEnhancement,
  getConsistencyPromptsByModule,
  getModuleCompletion,
  getSprocketConsistencyEnhancement,
  groupDriftMapByBand,
  labelForTheme,
  scoreConsistencyGapCheck,
  type ConsistencyBand,
  type ConsistencyResponses,
  type ConsistencyResult,
  type ConsistencyRole,
  type ConsistencySavedDiagnostic,
  type ConsistencyTimeframe,
} from '@/lib/tools/consistency-gap-check';

const TOOL_ID = 'consistency-gap-check';
const LOCAL_SCENARIOS_KEY = 'consistencyGapCheckSavedDiagnosticsV2';
const DRAFT_KEY = 'consistencyGapCheckDraftV2';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;
type Screen = 'intro' | 'role' | 'timeframe' | 'scan' | 'results';

type DraftState = {
  screen: Screen;
  role: ConsistencyRole;
  timeframe: ConsistencyTimeframe;
  moduleIndex: number;
  responses: ConsistencyResponses;
};

function readLocalDiagnostics(): ConsistencySavedDiagnostic[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ConsistencySavedDiagnostic[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalDiagnostics(data: ConsistencySavedDiagnostic[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCENARIOS_KEY, JSON.stringify(data));
}

function readDraft(): DraftState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftState;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(draft: DraftState) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function clearDraft() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DRAFT_KEY);
}

function buildCloudContent(
  role: ConsistencyRole,
  timeframe: ConsistencyTimeframe,
  result: ConsistencyResult
): string {
  return [
    'CONSISTENCY GAP CHECK',
    '',
    `Role: ${role}`,
    `Timeframe: ${timeframe}`,
    `Score: ${result.overallScore}`,
    `Band: ${result.overallBand}`,
    '',
    'Behavior Drift Map:',
    ...result.driftMap.map((row) => `- ${row.label}: ${row.band} (${row.score.toFixed(2)})`),
    '',
    `Holding: ${result.strongestZones.map((zone) => labelForTheme(zone)).join(', ')}`,
    `Slipping: ${result.weakZones.map((zone) => labelForTheme(zone)).join(', ')}`,
    `Why: ${result.whyThisIsHappening}`,
    `Next Move: ${result.nextReinforcementMove}`,
  ].join('\n');
}

function progressPercent(
  screen: Screen,
  moduleIndex: number,
  moduleAnswered: number,
  moduleTotal: number
): number {
  if (screen === 'intro') return 5;
  if (screen === 'role') return 11;
  if (screen === 'timeframe') return 18;
  if (screen === 'scan') {
    const answeredRatio = moduleTotal > 0 ? moduleAnswered / moduleTotal : 0;
    const moduleProgress = (moduleIndex + answeredRatio) / CONSISTENCY_MODULES.length;
    return Math.round(18 + (moduleProgress * 74));
  }
  return 100;
}

function bandTone(band: ConsistencyBand): string {
  if (band === 'Sticking') return 'border-[#2c6f51] bg-[#123226] text-[#bbf7d6]';
  if (band === 'Wobbling') return 'border-[#3f5a7d] bg-[#13253d] text-[#d3e8ff]';
  if (band === 'Fading') return 'border-[#6a5333] bg-[#2f2415] text-[#ffe3b7]';
  return 'border-[#6a343d] bg-[#31181d] text-[#ffd3d8]';
}

function barTone(band: ConsistencyBand): string {
  if (band === 'Sticking') return 'from-[#31d28b] to-[#1da56a]';
  if (band === 'Wobbling') return 'from-[#60b6ff] to-[#2d7ecf]';
  if (band === 'Fading') return 'from-[#ffbc62] to-[#e8892f]';
  return 'from-[#ff8b94] to-[#dc5160]';
}

export default function ConsistencyGapCheckPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [screen, setScreen] = useState<Screen>('intro');
  const [role, setRole] = useState<ConsistencyRole>('Sales Consultant');
  const [timeframe, setTimeframe] = useState<ConsistencyTimeframe>('Last 7 days');
  const [moduleIndex, setModuleIndex] = useState(0);
  const [responses, setResponses] = useState<ConsistencyResponses>({});
  const [result, setResult] = useState<ConsistencyResult | null>(null);
  const [savedDiagnostics, setSavedDiagnostics] = useState<ConsistencySavedDiagnostic[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketConsistencyEnhancement> | null>(null);
  const [cxOutput, setCxOutput] = useState<ReturnType<typeof getAutoDriveCxConsistencyEnhancement> | null>(null);

  const hasTrackedMeaningfulInteraction = useRef(false);
  const didLoadDraft = useRef(false);

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

  const activeModule = CONSISTENCY_MODULES[moduleIndex] ?? CONSISTENCY_MODULES[0];
  const modulePrompts = useMemo(
    () => getConsistencyPromptsByModule(activeModule.id, role),
    [activeModule.id, role]
  );
  const moduleCompletion = useMemo(
    () => getModuleCompletion(activeModule.id, responses),
    [activeModule.id, responses]
  );

  const progress = progressPercent(screen, moduleIndex, moduleCompletion.answered, moduleCompletion.total);

  const groupedDrift = useMemo(
    () => (result ? groupDriftMapByBand(result.driftMap) : null),
    [result]
  );

  useEffect(() => {
    setSavedDiagnostics(readLocalDiagnostics());
    readFullToolHandoff<{ source?: string; draft?: string }>(TOOL_ID);
    clearFullToolHandoff(TOOL_ID);
  }, []);

  useEffect(() => {
    if (didLoadDraft.current) return;
    const draft = readDraft();
    if (draft) {
      setScreen(draft.screen);
      setRole(draft.role);
      setTimeframe(draft.timeframe);
      setModuleIndex(Math.max(0, Math.min(draft.moduleIndex, CONSISTENCY_MODULES.length - 1)));
      setResponses(draft.responses ?? {});

      if (draft.screen === 'results') {
        setResult(scoreConsistencyGapCheck({
          role: draft.role,
          timeframe: draft.timeframe,
          responses: draft.responses ?? {},
        }));
      }
    }
    didLoadDraft.current = true;
  }, []);

  useEffect(() => {
    if (!didLoadDraft.current) return;
    if (screen === 'results') return;
    writeDraft({ screen, role, timeframe, moduleIndex, responses });
  }, [screen, role, timeframe, moduleIndex, responses]);

  useEffect(() => {
    setSprocketOutput(null);
    setCxOutput(null);
  }, [responses, role, timeframe]);

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

  const resetScan = useCallback(() => {
    setScreen('intro');
    setModuleIndex(0);
    setResponses({});
    setResult(null);
    setSprocketOutput(null);
    setCxOutput(null);
    clearDraft();
  }, []);

  const selectResponse = useCallback((promptId: string, optionKey: string) => {
    withUsageTracking(() => {
      setResponses((prev) => ({
        ...prev,
        [promptId]: optionKey,
      }));
    });
  }, [withUsageTracking]);

  const continueFromModule = useCallback(() => {
    const completion = getModuleCompletion(activeModule.id, responses);
    if (completion.answered < completion.total) {
      toast({
        variant: 'destructive',
        title: 'Complete this module',
        description: `Finish all prompts in ${activeModule.title} before continuing.`,
      });
      return;
    }

    withUsageTracking(() => {
      if (moduleIndex >= CONSISTENCY_MODULES.length - 1) {
        const scored = scoreConsistencyGapCheck({ role, timeframe, responses });
        setResult(scored);
        setScreen('results');
        clearDraft();
      } else {
        setModuleIndex((prev) => Math.min(prev + 1, CONSISTENCY_MODULES.length - 1));
      }
    });
  }, [activeModule.id, activeModule.title, moduleIndex, responses, role, timeframe, toast, withUsageTracking]);

  const goBackInScan = useCallback(() => {
    withUsageTracking(() => {
      if (moduleIndex === 0) {
        setScreen('timeframe');
        return;
      }
      setModuleIndex((prev) => Math.max(0, prev - 1));
    });
  }, [moduleIndex, withUsageTracking]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    const payload = [
      `[Status Band] ${result.overallBand} (${result.overallScore})`,
      `[What's Holding] ${result.strongestZones.map((zone) => labelForTheme(zone)).join(', ')}`,
      `[Where It's Slipping] ${result.weakZones.map((zone) => labelForTheme(zone)).join(', ')}`,
      `[Why] ${result.whyThisIsHappening}`,
      `[Next Move] ${result.nextReinforcementMove}`,
    ].join('\n\n');
    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Consistency diagnostic copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [result, toast]);

  const handleSaveLocal = useCallback(() => {
    if (!result) return;

    const entry: ConsistencySavedDiagnostic = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      role,
      timeframe,
      overallScore: result.overallScore,
      overallBand: result.overallBand,
      weakZones: result.weakZones,
      strongestZones: result.strongestZones,
      nextReinforcementMove: result.nextReinforcementMove,
      driftMap: result.driftMap.map((row) => ({
        theme: row.theme,
        score: row.score,
        band: row.band,
      })),
    };

    const next = [entry, ...savedDiagnostics].slice(0, 40);
    setSavedDiagnostics(next);
    writeLocalDiagnostics(next);
    toast({ title: 'Saved locally', description: 'Scan saved on this device.' });
  }, [result, role, timeframe, savedDiagnostics, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!result) return;
    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock paid AutoShop access to sync scans and drift maps.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this scan.' });
      return;
    }

    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const response = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(role, timeframe, result),
    });
    setIsCloudSaving(false);

    if (!response.ok) {
      if (response.code === 'PAYMENT_REQUIRED') {
        setUpgradeContextMessage('Cloud saves require paid AutoShop access.');
        setGateModalType('paid');
      }
      toast({ variant: 'destructive', title: response.message });
      return;
    }

    toast({ title: 'Saved to cloud', description: 'Diagnostic now syncs across devices.' });
  }, [firebaseUser, requireFeature, result, role, timeframe, toast]);

  const handleRunSprocket = useCallback(() => {
    if (!result) return;
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket to diagnose drift causes and tighten reinforcement language.')) return;
    setSprocketOutput(getSprocketConsistencyEnhancement(result));
  }, [requireFeature, result]);

  const handleRunAutoDrive = useCallback(() => {
    if (!result) return;
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for skill-aware consistency interpretation.')) return;
    setCxOutput(getAutoDriveCxConsistencyEnhancement(result, user));
  }, [requireFeature, result, user]);

  async function handleUnlockByEmail(values: { email: string; role: ToolboxCapturedRole }) {
    const email = values.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      toast({ variant: 'destructive', title: 'Enter a valid email' });
      return;
    }

    setIsEmailSubmitting(true);
    const captureResult = await captureToolboxUnlockEmail({ email, role: values.role });
    if (!captureResult.ok) {
      console.warn('[ConsistencyGapCheck] unlock capture failed:', captureResult.message);
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

  return (
    <div className="min-h-screen bg-[#070d18] text-[#dce7f8]">
      <Header />

      <main className="mx-auto w-full max-w-2xl space-y-5 px-4 pb-28 pt-4 sm:px-5 md:space-y-6 md:px-8 md:pt-8">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" asChild className="h-10 px-2 text-[#b8c8e2] hover:bg-[#13233b] hover:text-[#e6efff]">
            <Link href="/tools">
              <ChevronLeft className="mr-1 h-4 w-4" />
              AutoShop
            </Link>
          </Button>
          <Badge className="border border-[#00d8e5]/40 bg-[#00f2ff]/10 text-[#6eeef8]">AutoDriveCX</Badge>
        </div>

        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full border border-[#2f4567] bg-[#11233a]">
            <div className="h-full bg-gradient-to-r from-[#00d8e5] to-[#71f6b4] transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-[#9eb5d3]">Progress: {progress}%</p>
        </div>

        {!canUseBaseTool && (
          <Card className="border-[#3f2a2a] bg-[#231718]">
            <CardHeader>
              <CardTitle className="text-lg text-[#ffe5e5]">Free limit reached</CardTitle>
              <CardDescription className="text-[#f2b6b6]">Add email and role to keep running standalone diagnostics.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="bg-[#76ff8f] text-[#0d1d11] hover:bg-[#92ffa7]" onClick={() => setShowEmailGate(true)}>
                Continue with Free Account
              </Button>
            </CardContent>
          </Card>
        )}

        {screen === 'intro' && (
          <Card className="border-[#2b3e5d] bg-[#0f1b30]">
            <CardHeader>
              <CardTitle className="text-2xl text-[#f4f9ff]">Consistency Gap Check</CardTitle>
              <CardDescription className="text-[#9fb5d3]">
                Fast drift scan to see what trained behaviors are sticking, wobbling, or fading.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-[#c8d9f3]">
                This is a fast behavioral scan, not a long survey. Complete four modules, then review your Behavior Drift Map and one clear reinforcement move.
              </p>
              <Button className="h-11 bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]" onClick={() => withUsageTracking(() => setScreen('role'))}>
                Start Check
              </Button>
            </CardContent>
          </Card>
        )}

        {screen === 'role' && (
          <Card className="border-[#2b3e5d] bg-[#0f1b30]">
            <CardHeader>
              <CardTitle className="text-xl text-[#f4f9ff]">Select Role</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {CONSISTENCY_ROLES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => withUsageTracking(() => {
                    setRole(option);
                    setResponses({});
                    setResult(null);
                    setModuleIndex(0);
                    setScreen('timeframe');
                  })}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                    role === option
                      ? 'border-[#00d8e5] bg-[#00f2ff]/15 text-[#e6fdff]'
                      : 'border-[#2c3e5c] bg-[#101c30] text-[#d2def2] hover:bg-[#152743]'
                  }`}
                >
                  {option}
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {screen === 'timeframe' && (
          <Card className="border-[#2b3e5d] bg-[#0f1b30]">
            <CardHeader>
              <CardTitle className="text-xl text-[#f4f9ff]">Select Time Frame</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {CONSISTENCY_TIMEFRAMES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => withUsageTracking(() => {
                    setTimeframe(option);
                    setResponses({});
                    setResult(null);
                    setModuleIndex(0);
                    setScreen('scan');
                  })}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                    timeframe === option
                      ? 'border-[#00d8e5] bg-[#00f2ff]/15 text-[#e6fdff]'
                      : 'border-[#2c3e5c] bg-[#101c30] text-[#d2def2] hover:bg-[#152743]'
                  }`}
                >
                  {option}
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {screen === 'scan' && (
          <>
            <Card className="border-[#2b3e5d] bg-[#0f1b30]">
              <CardHeader>
                <CardTitle className="text-xl text-[#f4f9ff]">{activeModule.title}</CardTitle>
                <CardDescription className="text-[#9fb5d3]">
                  Module {moduleIndex + 1} of {CONSISTENCY_MODULES.length} · {activeModule.subtitle}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-[#2b476a] bg-[#0d1d33] px-3 py-2 text-xs text-[#96b1d5]">
                  {role} · {timeframe}
                </div>

                {modulePrompts.map((prompt) => {
                  const selected = responses[prompt.id];
                  const selectedIndex = prompt.options.findIndex((item) => item.key === selected);

                  if (activeModule.style === 'slider') {
                    const fallbackIndex = prompt.options.length > 1 ? 1 : 0;
                    const currentIndex = selectedIndex >= 0 ? selectedIndex : fallbackIndex;
                    return (
                      <div key={prompt.id} className="space-y-3 rounded-xl border border-[#2a4262] bg-[#0e1d31] p-3">
                        <p className="text-sm font-semibold text-[#e6f1ff]">{prompt.prompt}</p>
                        <input
                          type="range"
                          min={0}
                          max={prompt.options.length - 1}
                          step={1}
                          value={currentIndex}
                          onChange={(event) => {
                            const option = prompt.options[Number(event.target.value)] ?? prompt.options[0];
                            selectResponse(prompt.id, option.key);
                          }}
                          className="w-full accent-[#00d8e5]"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          {prompt.options.map((option) => {
                            const isSelected = selected === option.key;
                            return (
                              <button
                                key={option.key}
                                type="button"
                                onClick={() => selectResponse(prompt.id, option.key)}
                                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                                  isSelected
                                    ? 'border-[#00d8e5] bg-[#00f2ff]/15 text-[#dffaff]'
                                    : 'border-[#2d4567] bg-[#10233a] text-[#b8cde9] hover:bg-[#183154]'
                                }`}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  const gridCols = activeModule.style === 'cards'
                    ? 'grid-cols-2'
                    : activeModule.style === 'status'
                      ? 'grid-cols-1'
                      : 'grid-cols-1';

                  return (
                    <div key={prompt.id} className="space-y-3 rounded-xl border border-[#2a4262] bg-[#0e1d31] p-3">
                      <p className="text-sm font-semibold text-[#e6f1ff]">{prompt.prompt}</p>
                      <div className={`grid ${gridCols} gap-2`}>
                        {prompt.options.map((option) => {
                          const isSelected = selected === option.key;
                          return (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => selectResponse(prompt.id, option.key)}
                              className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${
                                isSelected
                                  ? 'border-[#00d8e5] bg-[#00f2ff]/15 text-[#dcfaff]'
                                  : 'border-[#2d4567] bg-[#10233a] text-[#b8cde9] hover:bg-[#183154]'
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    className="text-[#b4c8e8] hover:bg-[#162a46] hover:text-[#e8f3ff]"
                    onClick={goBackInScan}
                  >
                    Back
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-[#b4c8e8] hover:bg-[#162a46] hover:text-[#e8f3ff]"
                    onClick={() => withUsageTracking(() => setScreen('role'))}
                  >
                    Change Role / Time Frame
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="sticky bottom-3 z-20 rounded-xl border border-[#2d4a6c] bg-[#0d1d33]/95 p-3 backdrop-blur">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-[#95b2d6]">
                  {moduleCompletion.answered}/{moduleCompletion.total} completed
                </p>
                {moduleCompletion.answered < moduleCompletion.total && (
                  <p className="text-xs text-[#f6b7b7]">Complete all prompts to continue</p>
                )}
              </div>
              <Button className="h-11 w-full bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]" onClick={continueFromModule}>
                {moduleIndex === CONSISTENCY_MODULES.length - 1 ? 'Generate Drift Map' : 'Continue to Next Module'}
              </Button>
            </div>
          </>
        )}

        {screen === 'results' && result && (
          <>
            <Card className="border-[#2b3e5d] bg-[#0f1b30]">
              <CardHeader>
                <CardTitle className="text-xl text-[#f4f9ff]">Overall Status Band</CardTitle>
                <CardDescription className="text-[#9fb5d3]">{role} · {timeframe}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`rounded-xl border px-4 py-3 ${bandTone(result.overallBand)}`}>
                  <p className="text-lg font-semibold">{result.overallBand}</p>
                  <p className="text-sm">Score {result.overallScore}/100</p>
                </div>
                <p className="mt-3 text-sm text-[#b3c8e7]">{result.interpretation}</p>
              </CardContent>
            </Card>

            <Card className="border-[#2b3e5d] bg-[#0f1b30]">
              <CardHeader>
                <CardTitle className="text-xl text-[#f4f9ff]">Behavior Drift Map</CardTitle>
                <CardDescription className="text-[#9fb5d3]">Strongest to most at-risk behavior zones</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {groupedDrift && (
                  (['Sticking', 'Wobbling', 'Fading', 'Needs Reinforcement'] as ConsistencyBand[]).map((band) => {
                    const rows = groupedDrift[band];
                    if (rows.length === 0) return null;
                    return (
                      <div key={band} className="space-y-2">
                        <p className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${bandTone(band)}`}>
                          {band}
                        </p>
                        <div className="space-y-2">
                          {rows.map((row) => {
                            const highlightedByCx = Boolean(cxOutput?.mapHighlights.includes(row.theme));
                            return (
                              <div
                                key={row.theme}
                                className={`rounded-xl border p-2 ${
                                  row.atRisk
                                    ? 'border-[#8a3b46] bg-[#2a1720]'
                                    : highlightedByCx
                                      ? 'border-[#2f5f79] bg-[#12263d]'
                                      : 'border-[#2c4260] bg-[#0e1d31]'
                                }`}
                              >
                                <div className="mb-1 flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold text-[#e8f2ff]">{row.label}</p>
                                  <p className="text-xs text-[#afc6e6]">{row.percent}%</p>
                                </div>
                                <div className="h-2 rounded-full bg-[#11233a]">
                                  <div
                                    className={`h-full rounded-full bg-gradient-to-r ${barTone(row.band)}`}
                                    style={{ width: `${Math.max(8, row.percent)}%` }}
                                  />
                                </div>
                                {row.atRisk && (
                                  <p className="mt-1 text-xs text-[#ffc4cc]">At-risk behavior</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            <Card className="border-[#2b3e5d] bg-[#0f1b30]">
              <CardHeader>
                <CardTitle className="text-lg text-[#f4f9ff]">What’s Holding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.strongestZones.map((zone) => (
                  <p key={zone} className="text-sm text-[#d8e9ff]">{labelForTheme(zone)}</p>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[#2b3e5d] bg-[#0f1b30]">
              <CardHeader>
                <CardTitle className="text-lg text-[#ffe2ce]">Where It’s Slipping</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.weakZones.map((zone) => (
                  <p key={zone} className="text-sm text-[#ffd9bf]">{labelForTheme(zone)}</p>
                ))}
              </CardContent>
            </Card>

            <Card className="border-[#2b3e5d] bg-[#0f1b30]">
              <CardHeader>
                <CardTitle className="text-lg text-[#f4f9ff]">Why This Is Happening</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#d5e5fb]">{result.whyThisIsHappening}</p>
              </CardContent>
            </Card>

            <Card className="border-[#2b3e5d] bg-[#0f1b30]">
              <CardHeader>
                <CardTitle className="text-lg text-[#7ef7bf]">Best Next Reinforcement Move</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[#e8f7ff]">{result.nextReinforcementMove}</p>
              </CardContent>
            </Card>

            <Card className="border-[#2b3e5d] bg-[#0f1b30]">
              <CardContent className="grid grid-cols-2 gap-2 p-4 sm:flex sm:flex-wrap">
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
                <Button className="h-11 border border-[#3c5878] bg-[#0f1b30] text-[#dce7f8] hover:bg-[#172845]" onClick={resetScan}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Retake
                </Button>
              </CardContent>
            </Card>

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
                      <p><span className="font-semibold text-[#88f3ff]">Likely cause:</span> {sprocketOutput.likelyCause}</p>
                      <p><span className="font-semibold text-[#88f3ff]">Sharper angle:</span> {sprocketOutput.sharperReinforcementAngle}</p>
                      <p><span className="font-semibold text-[#88f3ff]">Coaching language:</span> {sprocketOutput.coachingLanguage}</p>
                      <p><span className="font-semibold text-[#88f3ff]">3-day reset:</span> {sprocketOutput.resetMove3Day}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </FeatureGate>

<Card className="border-[#2b3e5d] bg-[#0f1b30]">
              <CardHeader>
                <CardTitle className="text-lg text-[#f2f7ff]">Saved Checks</CardTitle>
                <CardDescription className="text-[#9cb0cd]">
                  {savedDiagnostics.length} saved on this device.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {savedDiagnostics.length === 0 ? (
                  <p className="text-sm text-[#90a7ca]">No saved checks yet.</p>
                ) : (
                  savedDiagnostics.slice(0, 6).map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-[#29415e] bg-[#0c182a] p-3">
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-[#e8f1ff]">{entry.overallBand} · {entry.timeframe}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-[#bdd0ea] hover:bg-[#172845] hover:text-[#fff8ca]"
                          onClick={() => {
                            const next = savedDiagnostics.filter((item) => item.id !== entry.id);
                            setSavedDiagnostics(next);
                            writeLocalDiagnostics(next);
                          }}
                        >
                          <Star className="mr-1 h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                      <p className="text-sm text-[#c9d7ee]">{entry.nextReinforcementMove}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}
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
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks skill-aware drift interpretation.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

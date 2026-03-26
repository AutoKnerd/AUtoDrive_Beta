'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Cloud, Copy, RotateCcw, Save, Sparkles, Star } from 'lucide-react';
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
  CONSISTENCY_CATEGORIES,
  CONSISTENCY_EVALUATION_BASIS,
  CONSISTENCY_ROLES,
  getRoleDisplayLabel,
  getSprocketConsistencyEnhancement,
  scoreConsistencyGapCheck,
  type ConsistencyCategory,
  type ConsistencyCategoryId,
  type ConsistencyEvaluationBasis,
  type ConsistencyResult,
  type ConsistencyResponses,
  type ConsistencyRole,
} from '@/lib/tools/consistency-gap-check';

const TOOL_ID = 'consistency-gap-check';
const LOCAL_SCENARIOS_KEY = 'consistencyGapCheckSavedDiagnosticsV3';
const DRAFT_KEY = 'consistencyGapCheckDraftV3';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type GateModalType = 'paid' | 'autodrive_cx' | null;

type DraftState = {
  role: ConsistencyRole;
  evaluationBasis: ConsistencyEvaluationBasis;
  responses: ConsistencyResponses;
};

type SavedDiagnostic = {
  id: string;
  createdAt: string;
  role: ConsistencyRole;
  evaluationBasis: ConsistencyEvaluationBasis;
  overallScore: number;
  strongestBehavior: string;
  biggestConsistencyGap: string;
  recommendedNextFix: string;
};

function readLocalDiagnostics(): SavedDiagnostic[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedDiagnostic[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalDiagnostics(data: SavedDiagnostic[]) {
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
  evaluationBasis: ConsistencyEvaluationBasis,
  result: ConsistencyResult
): string {
  const categoryLines = result.categories
    .slice()
    .reverse()
    .map((category) => `- ${category.title}: ${category.selectedLabel} (${category.status})`);

  return [
    'CONSISTENCY GAP CHECK',
    '',
    `Role: ${getRoleDisplayLabel(role)}`,
    `Evaluation basis: ${evaluationBasis}`,
    `Overall consistency score: ${result.overallScore}`,
    '',
    `Strongest Behavior: ${result.strongestBehavior}`,
    `Biggest Consistency Gap: ${result.biggestConsistencyGap}`,
    `Likely Customer Impact: ${result.likelyCustomerImpact}`,
    `Recommended Next Fix: ${result.recommendedNextFix}`,
    `Next Interaction Move: ${result.nextInteractionMove}`,
    '',
    'Category Map:',
    ...categoryLines,
  ].join('\n');
}

function progressPercent(answered: number): number {
  return Math.round((answered / CONSISTENCY_CATEGORIES.length) * 100);
}

function statusTone(status: 'Strong' | 'Slipping' | 'At Risk'): string {
  if (status === 'Strong') return 'border-[#2c6f51] bg-[#123226] text-[#bbf7d6]';
  if (status === 'Slipping') return 'border-[#6a5333] bg-[#2f2415] text-[#ffe3b7]';
  return 'border-[#6a343d] bg-[#31181d] text-[#ffd3d8]';
}

function barTone(status: 'Strong' | 'Slipping' | 'At Risk'): string {
  if (status === 'Strong') return 'from-[#31d28b] to-[#1da56a]';
  if (status === 'Slipping') return 'from-[#ffbc62] to-[#e8892f]';
  return 'from-[#ff8b94] to-[#dc5160]';
}

function optionButtonClass(selected: boolean): string {
  if (selected) {
    return 'border-[#00d8e5] bg-[#00f2ff]/15 text-[#dcfaff]';
  }

  return 'border-[#2d4567] bg-[#10233a] text-[#b8cde9] hover:bg-[#183154]';
}

function CategoryInput({
  category,
  selectedKey,
  onSelect,
}: {
  category: ConsistencyCategory;
  selectedKey?: string;
  onSelect: (categoryId: ConsistencyCategoryId, optionKey: string) => void;
}) {
  const currentIndex = Math.max(
    0,
    category.options.findIndex((option) => option.key === selectedKey)
  );

  if (category.inputStyle === 'slider') {
    return (
      <div className="space-y-3">
        <input
          type="range"
          min={0}
          max={category.options.length - 1}
          step={1}
          value={currentIndex}
          onChange={(event) => {
            const option = category.options[Number(event.target.value)] ?? category.options[0];
            onSelect(category.id as ConsistencyCategoryId, option.key);
          }}
          className="w-full accent-[#00d8e5]"
        />
        <div className="grid grid-cols-3 gap-2">
          {category.options.map((option) => {
            const selected = option.key === selectedKey;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onSelect(category.id as ConsistencyCategoryId, option.key)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${optionButtonClass(selected)}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const gridClasses = category.inputStyle === 'cards' ? 'grid grid-cols-1 gap-2' : 'grid grid-cols-3 gap-2';

  return (
    <div className={gridClasses}>
      {category.options.map((option) => {
        const selected = option.key === selectedKey;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onSelect(category.id as ConsistencyCategoryId, option.key)}
            className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${optionButtonClass(selected)}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ConsistencyGapCheckPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [role, setRole] = useState<ConsistencyRole>('Sales Consultant');
  const [evaluationBasis, setEvaluationBasis] = useState<ConsistencyEvaluationBasis>('Today');
  const [responses, setResponses] = useState<ConsistencyResponses>({});
  const [result, setResult] = useState<ConsistencyResult | null>(null);
  const [savedDiagnostics, setSavedDiagnostics] = useState<SavedDiagnostic[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [gateModalType, setGateModalType] = useState<GateModalType>(null);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  const [sprocketOutput, setSprocketOutput] = useState<ReturnType<typeof getSprocketConsistencyEnhancement> | null>(null);

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

  const answeredCount = useMemo(
    () => CONSISTENCY_CATEGORIES.filter((category) => Boolean(responses[category.id as ConsistencyCategoryId])).length,
    [responses]
  );

  const progress = progressPercent(answeredCount);

  useEffect(() => {
    setSavedDiagnostics(readLocalDiagnostics());
    readFullToolHandoff<{ source?: string; draft?: string }>(TOOL_ID);
    clearFullToolHandoff(TOOL_ID);
  }, []);

  useEffect(() => {
    if (didLoadDraft.current) return;
    const draft = readDraft();
    if (draft) {
      setRole(draft.role);
      setEvaluationBasis(draft.evaluationBasis);
      setResponses(draft.responses ?? {});
    }
    didLoadDraft.current = true;
  }, []);

  useEffect(() => {
    if (!didLoadDraft.current) return;
    writeDraft({ role, evaluationBasis, responses });
  }, [role, evaluationBasis, responses]);

  useEffect(() => {
    setResult(null);
    setSprocketOutput(null);
  }, [responses, role, evaluationBasis]);

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

  const selectResponse = useCallback((categoryId: ConsistencyCategoryId, optionKey: string) => {
    withUsageTracking(() => {
      setResponses((prev) => ({
        ...prev,
        [categoryId]: optionKey,
      }));
    });
  }, [withUsageTracking]);

  const runSnapshot = useCallback(() => {
    withUsageTracking(() => {
      const scored = scoreConsistencyGapCheck({
        role,
        evaluationBasis,
        responses,
      });

      if (!scored.completed) {
        toast({
          variant: 'destructive',
          title: 'Complete all categories',
          description: `${scored.missingCategoryIds.length} category responses are still missing.`,
        });
        return;
      }

      setResult(scored);
      clearDraft();
    });
  }, [evaluationBasis, responses, role, toast, withUsageTracking]);

  const resetScan = useCallback(() => {
    setResponses({});
    setResult(null);
    setSprocketOutput(null);
    clearDraft();
  }, []);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    const payload = [
      `Strongest Behavior: ${result.strongestBehavior}`,
      `Biggest Consistency Gap: ${result.biggestConsistencyGap}`,
      `Likely Customer Impact: ${result.likelyCustomerImpact}`,
      `Recommended Next Fix: ${result.recommendedNextFix}`,
      `Next Interaction Move: ${result.nextInteractionMove}`,
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Snapshot copied to clipboard.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [result, toast]);

  const handleSaveLocal = useCallback(() => {
    if (!result) return;

    const entry: SavedDiagnostic = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      role,
      evaluationBasis,
      overallScore: result.overallScore,
      strongestBehavior: result.strongestBehavior,
      biggestConsistencyGap: result.biggestConsistencyGap,
      recommendedNextFix: result.recommendedNextFix,
    };

    const next = [entry, ...savedDiagnostics].slice(0, 40);
    setSavedDiagnostics(next);
    writeLocalDiagnostics(next);
    toast({ title: 'Saved locally', description: 'Snapshot saved on this device.' });
  }, [evaluationBasis, result, role, savedDiagnostics, toast]);

  const handleSaveCloud = useCallback(async () => {
    if (!result) return;
    if (!requireFeature(FEATURES.CLOUD_SAVE, 'Unlock paid AutoShop access to sync snapshots across devices.')) return;
    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to save this snapshot.' });
      return;
    }

    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const response = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(role, evaluationBasis, result),
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

    toast({ title: 'Saved to cloud', description: 'Snapshot now syncs across devices.' });
  }, [evaluationBasis, firebaseUser, requireFeature, result, role, toast]);

  const handleRunSprocket = useCallback(() => {
    if (!result) return;
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket for sharper drift diagnosis and corrective coaching.')) return;
    setSprocketOutput(getSprocketConsistencyEnhancement(result));
  }, [requireFeature, result]);

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
          <p className="text-xs text-[#9eb5d3]">Scan completion: {answeredCount}/{CONSISTENCY_CATEGORIES.length}</p>
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

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-2xl text-[#f4f9ff]">Consistency Gap Check</CardTitle>
            <CardDescription className="text-[#9fb5d3]">
              Fast execution diagnostic to find where intended process and live customer behavior are drifting.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[#c8d9f3]">
            <p>Rate each execution category once. This scan is built for live dealership use and finishes in under two minutes.</p>
            <p>Primary output gives one strongest behavior, one biggest gap, one impact, one fix, and one next move.</p>
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-xl text-[#f4f9ff]">Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#95b2d6]">Role</p>
              <div className="grid grid-cols-2 gap-2">
                {CONSISTENCY_ROLES.map((option) => {
                  const selected = role === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => withUsageTracking(() => setRole(option))}
                      className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${optionButtonClass(selected)}`}
                    >
                      {getRoleDisplayLabel(option)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#95b2d6]">Evaluation Basis</p>
              <div className="grid grid-cols-2 gap-2">
                {CONSISTENCY_EVALUATION_BASIS.map((option) => {
                  const selected = evaluationBasis === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => withUsageTracking(() => setEvaluationBasis(option))}
                      className={`rounded-xl border px-3 py-3 text-left text-sm font-semibold transition-colors ${optionButtonClass(selected)}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#2b3e5d] bg-[#0f1b30]">
          <CardHeader>
            <CardTitle className="text-xl text-[#f4f9ff]">Execution Scan</CardTitle>
            <CardDescription className="text-[#9fb5d3]">
              {getRoleDisplayLabel(role)} · {evaluationBasis}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {CONSISTENCY_CATEGORIES.map((category) => (
              <div key={category.id} className="space-y-3 rounded-xl border border-[#2a4262] bg-[#0e1d31] p-3">
                <p className="text-sm font-semibold text-[#e6f1ff]">{category.title}</p>
                <p className="text-xs text-[#9eb6d5]">{category.description}</p>
                <CategoryInput
                  category={category}
                  selectedKey={responses[category.id as ConsistencyCategoryId]}
                  onSelect={selectResponse}
                />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="sticky bottom-3 z-20 rounded-xl border border-[#2d4a6c] bg-[#0d1d33]/95 p-3 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-[#95b2d6]">{answeredCount}/{CONSISTENCY_CATEGORIES.length} categories rated</p>
            {answeredCount < CONSISTENCY_CATEGORIES.length && (
              <p className="text-xs text-[#f6b7b7]">Complete all categories</p>
            )}
          </div>
          <Button className="h-11 w-full bg-[#00d8e5] text-[#06232b] hover:bg-[#39eaf4]" onClick={runSnapshot}>
            Generate Coaching Snapshot
          </Button>
        </div>

        {result?.completed && (
          <>
            <Card className="border-[#2b3e5d] bg-[#0f1b30]">
              <CardHeader>
                <CardTitle className="text-xl text-[#f4f9ff]">Execution Snapshot</CardTitle>
                <CardDescription className="text-[#9fb5d3]">
                  Score {result.overallScore} · {getRoleDisplayLabel(role)} · {evaluationBasis}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-xl border border-[#2c4260] bg-[#0e1d31] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#95b2d6]">Strongest Behavior</p>
                  <p className="mt-1 text-sm text-[#ecf4ff]">{result.strongestBehavior}</p>
                </div>
                <div className="rounded-xl border border-[#8a3b46] bg-[#2a1720] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#f5b8c0]">Biggest Consistency Gap</p>
                  <p className="mt-1 text-sm text-[#ffd4dc]">{result.biggestConsistencyGap}</p>
                </div>
                <div className="rounded-xl border border-[#6a5333] bg-[#2f2415] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#ffdca8]">Likely Customer Impact</p>
                  <p className="mt-1 text-sm text-[#ffe8c9]">{result.likelyCustomerImpact}</p>
                </div>
                <div className="rounded-xl border border-[#2f5f79] bg-[#12263d] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a5e5ff]">Recommended Next Fix</p>
                  <p className="mt-1 text-sm text-[#d7eeff]">{result.recommendedNextFix}</p>
                </div>
                <div className="rounded-xl border border-[#2f5f79] bg-[#12263d] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a5e5ff]">Next Interaction Move</p>
                  <p className="mt-1 text-sm text-[#d7eeff]">{result.nextInteractionMove}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#2b3e5d] bg-[#0f1b30]">
              <CardHeader>
                <CardTitle className="text-lg text-[#f4f9ff]">Consistency Map</CardTitle>
                <CardDescription className="text-[#9fb5d3]">
                  Strong: {result.counts.strong} · Slipping: {result.counts.slipping} · At-risk: {result.counts.atRisk}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.categories.slice().reverse().map((category) => (
                  <div key={category.categoryId} className="rounded-xl border border-[#2c4260] bg-[#0e1d31] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#e8f2ff]">{category.title}</p>
                      <p className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusTone(category.status)}`}>
                        {category.status}
                      </p>
                    </div>
                    <p className="mb-2 text-xs text-[#a7bfdc]">Current rating: {category.selectedLabel}</p>
                    <div className="h-2 rounded-full bg-[#11233a]">
                      <div className={`h-full rounded-full bg-gradient-to-r ${barTone(category.status)}`} style={{ width: `${category.percent}%` }} />
                    </div>
                  </div>
                ))}
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
                  <RotateCcw className="mr-2 h-4 w-4" /> Reset
                </Button>
              </CardContent>
            </Card>

            <FeatureGate
              feature={FEATURES.SPROCKET}
              entitlements={entitlements}
              fallback={() => (
                <Card className="border-[#2f4568] bg-[#0f1c31]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-[#7eeeff]"><Sparkles className="h-4 w-4" /> Sprocket Insight</CardTitle>
                    <CardDescription className="text-[#9fb5d3]">Paid AutoShop unlocks sharper drift diagnosis and coaching precision.</CardDescription>
                  </CardHeader>
                  <CardContent>
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
                      <p><span className="font-semibold text-[#88f3ff]">Pattern diagnosis:</span> {sprocketOutput.patternDiagnosis}</p>
                      <p><span className="font-semibold text-[#88f3ff]">Issue type:</span> {sprocketOutput.issueType}</p>
                      <p><span className="font-semibold text-[#88f3ff]">Corrective action:</span> {sprocketOutput.preciseCorrectiveAction}</p>
                      <p><span className="font-semibold text-[#88f3ff]">Coaching cue:</span> {sprocketOutput.coachingCue}</p>
                      {sprocketOutput.behaviorStandardRewrite && (
                        <p><span className="font-semibold text-[#88f3ff]">Behavior standard:</span> {sprocketOutput.behaviorStandardRewrite}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </FeatureGate>

          </>
        )}

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
                    <p className="text-sm font-semibold text-[#e8f1ff]">
                      {getRoleDisplayLabel(entry.role)} · {entry.evaluationBasis} · Score {entry.overallScore}
                    </p>
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
                  <p className="text-sm text-[#c9d7ee]">Gap: {entry.biggestConsistencyGap}</p>
                  <p className="mt-1 text-sm text-[#c9d7ee]">Next fix: {entry.recommendedNextFix}</p>
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
        contextMessage={upgradeContextMessage || (gateModalType === 'autodrive_cx' ? 'AutoDriveCX unlocks skill-aware consistency personalization.' : undefined)}
        onOpenChange={(open) => {
          if (!open) setGateModalType(null);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

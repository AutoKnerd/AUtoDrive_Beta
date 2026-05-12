'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Cloud, Copy, Lock, RefreshCw, Save, Sparkles, Star, RotateCcw } from 'lucide-react';
import { UpgradeModal } from '@/components/tools/upgrade-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useEntitlements } from '@/hooks/use-entitlements';
import { useToast } from '@/hooks/use-toast';
import { FEATURES, resolvePaidAccess } from '@/lib/tools/entitlements';
import { fetchToolboxEntries, saveToolboxEntry } from '@/lib/tools/toolbox-client';
import {
  clearFullToolHandoff,
  getTempDraft,
  readFullToolHandoff,
  writeTempDraft,
} from '@/lib/tools/toolbox-storage';
import { cn } from '@/lib/utils';
import {
  FIVE_MINUTE_DRILL_FOCUSES,
  FIVE_MINUTE_DRILL_ISSUES,
  FIVE_MINUTE_DRILL_ROLES,
  getFiveMinuteDrillCxInsight,
  getFiveMinuteDrillPlan,
  getFiveMinuteDrillSprocketInsight,
  type FiveMinuteDrillCxInsight,
  type FiveMinuteDrillFocus,
  type FiveMinuteDrillHistorySummary,
  type FiveMinuteDrillInput,
  type FiveMinuteDrillIssue,
  type FiveMinuteDrillPlan,
  type FiveMinuteDrillRole,
  type FiveMinuteDrillSavedEntry,
  type FiveMinuteDrillSprocketInsight,
} from '@/lib/tools/five-minute-drill-builder';
import type { ToolboxSavedEntry } from '@/lib/tools/toolbox';

const TOOL_ID = 'five-minute-drill-builder';
const LOCAL_ENTRIES_KEY = 'fiveMinuteDrillBuilderSavedEntriesV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';

type GateModalType = 'paid' | 'autodrive_cx' | null;

type GeneratedState<T> = {
  signature: string;
  value: T;
};

function normalizeSignaturePart(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function buildSignature(input: FiveMinuteDrillInput, variantSeed: number): string {
  return [
    normalizeSignaturePart(input.role),
    normalizeSignaturePart(input.focus),
    normalizeSignaturePart(input.currentIssue),
    normalizeSignaturePart(input.managerNote),
    normalizeSignaturePart(input.associateName ?? ''),
    `seed:${variantSeed}`,
  ].join('|');
}

function readLocalEntries(): FiveMinuteDrillSavedEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FiveMinuteDrillSavedEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalEntries(entries: FiveMinuteDrillSavedEntry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(entries));
}

function formatCloudPreview(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function buildCloudContent(
  input: FiveMinuteDrillInput,
  plan: FiveMinuteDrillPlan,
  sprocket: FiveMinuteDrillSprocketInsight | null,
  cx: FiveMinuteDrillCxInsight | null,
  favorite: boolean,
  variantSeed: number,
): string {
  const blocks = [
    'FIVE-MINUTE DRILL BUILDER',
    '',
    `Role: ${input.role}`,
    `Coaching focus: ${input.focus}`,
    `Current issue: ${input.currentIssue}`,
    `Manager note: ${input.managerNote.trim() || 'none'}`,
    `Associate name: ${input.associateName?.trim() || 'none'}`,
    `Favorite: ${favorite ? 'yes' : 'no'}`,
    `Variant: ${variantSeed}`,
    '',
    `Drill name: ${plan.drillName}`,
    `Summary: ${plan.summary}`,
    ...plan.stages.map((stage) => `${stage.label}: ${stage.body}`),
    `Coach this way: ${plan.coachThisWay}`,
    `Avoid saying this: ${plan.avoidThis}`,
    `Quick copy: ${plan.quickCopy}`,
    `Next drill: ${plan.nextDrill}`,
    'SCORECARD',
    ...plan.scorecard.map((metric) => `${metric.label}: ${metric.value}/5 - ${metric.note}`),
  ];

  if (sprocket) {
    blocks.push(
      '',
      'SPROCKET INSIGHT',
      `Issue read: ${sprocket.issueRead}`,
      `Drill recommendation: ${sprocket.drillRecommendation}`,
      `Manager language: ${sprocket.managerLanguage}`,
      `Risky phrases: ${sprocket.riskyPhrases.join(', ') || 'none'}`,
      `Next drill: ${sprocket.nextDrill}`,
      `Calm text: ${sprocket.calmText}`,
    );
  }

  if (cx) {
    blocks.push(
      '',
      'AUTODRIVECX COACHING',
      `Has profile: ${cx.hasProfile ? 'yes' : 'no'}`,
      `Focus skill: ${cx.focusSkill}`,
      `Personal note: ${cx.personalNote}`,
      `Coaching notes: ${cx.coachingNotes.map((note) => `${note.label}: ${note.note}`).join(' | ')}`,
    );
  }

  return blocks.join('\n');
}

function buildSavedEntry(args: {
  input: FiveMinuteDrillInput;
  plan: FiveMinuteDrillPlan;
  sprocket: FiveMinuteDrillSprocketInsight | null;
  cx: FiveMinuteDrillCxInsight | null;
  variantSeed: number;
  favorite: boolean;
}): FiveMinuteDrillSavedEntry {
  const signature = buildSignature(args.input, args.variantSeed);
  return {
    id: crypto.randomUUID(),
    signature,
    createdAt: new Date().toISOString(),
    variantSeed: args.variantSeed,
    role: args.input.role,
    focus: args.input.focus,
    currentIssue: args.input.currentIssue,
    managerNote: args.input.managerNote,
    drillName: args.plan.drillName,
    summary: args.plan.summary,
    stages: args.plan.stages,
    coachThisWay: args.plan.coachThisWay,
    avoidThis: args.plan.avoidThis,
    quickCopy: args.plan.quickCopy,
    nextDrill: args.plan.nextDrill,
    scorecard: args.plan.scorecard,
    favorite: args.favorite,
    sprocketInsight: args.sprocket,
    cxInsight: args.cx,
  };
}

function parseSavedEntryPreview(entry: ToolboxSavedEntry): string[] {
  return formatCloudPreview(entry.content);
}

function FieldChip({
  active,
  label,
  hint,
  onClick,
}: {
  active: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-[48px] rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.98]',
        active
          ? 'border-[#9DEE75] bg-[#101b11] text-[#efffe7] shadow-[0_0_0_1px_rgba(157,238,117,0.55),0_0_24px_rgba(157,238,117,0.45),0_0_64px_rgba(157,238,117,0.22)]'
          : 'border-[#4a4456] bg-[#1c2024] text-[#e0e2e9] hover:border-[#d1bcff] hover:bg-[#272a2f]',
      )}
    >
      <div className="font-headline text-sm font-semibold">{label}</div>
      {hint && <div className="mt-1 text-[11px] text-[#ccc3d9]">{hint}</div>}
    </button>
  );
}

const ROLE_META: Record<FiveMinuteDrillRole, { label: string; icon: string; tone: string }> = {
  'Sales Associate': { label: 'Sales Associate', icon: 'store', tone: 'Showroom' },
  'Service Advisor': { label: 'Service Advisor', icon: 'build_circle', tone: 'Service Drive' },
};

export default function FiveMinuteDrillBuilderPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [scenario, setScenario] = useState<FiveMinuteDrillRole>('Sales Associate');
  const [customerEmotion, setCustomerEmotion] = useState<FiveMinuteDrillFocus>('greeting');
  const [desiredOutcome, setDesiredOutcome] = useState<FiveMinuteDrillIssue>('too vague');
  const [consultantNote, setConsultantNote] = useState<string>(() => getTempDraft(TOOL_ID));
  const [variantSeed, setVariantSeed] = useState(0);
  const [savedEntries, setSavedEntries] = useState<FiveMinuteDrillSavedEntry[]>([]);
  const [cloudEntries, setCloudEntries] = useState<ToolboxSavedEntry[]>([]);
  const [draftFavorite, setDraftFavorite] = useState(false);
  const [cloudRefreshTick, setCloudRefreshTick] = useState(0);

  const [sprocketOutput, setSprocketOutput] = useState<GeneratedState<FiveMinuteDrillSprocketInsight> | null>(null);
  const [cxOutput, setCxOutput] = useState<GeneratedState<FiveMinuteDrillCxInsight> | null>(null);

  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  const hasTrackedMeaningfulInteraction = useRef(false);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const guidanceRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);

  const hasPaidAccess = resolvePaidAccess({
    tier: user?.tier,
    subscriptionStatus: user?.subscriptionStatus,
  });
  const hasAutoDriveCX = Boolean(user?.hasAutoDriveCX);

  const { entitlements, registerToolUsage } = useEntitlements({
    isAuthenticated: !!firebaseUser,
    hasPaidAccess,
    hasAutoDriveCX,
  });

  const hasSprocketAccess = entitlements.features[FEATURES.SPROCKET];
  const hasAutoDriveCxAccess = entitlements.features[FEATURES.AUTODRIVE_CX];

  const currentInput = useMemo<FiveMinuteDrillInput>(() => ({
    role: scenario,
    focus: customerEmotion,
    currentIssue: desiredOutcome,
    managerNote: consultantNote,
  }), [consultantNote, customerEmotion, desiredOutcome, scenario]);

  const currentSignature = useMemo(() => buildSignature(currentInput, variantSeed), [currentInput, variantSeed]);
  const plan = useMemo(() => getFiveMinuteDrillPlan(currentInput, variantSeed), [currentInput, variantSeed]);
  const recentHistory = useMemo<FiveMinuteDrillHistorySummary | null>(() => {
    const latest = savedEntries[0];
    if (!latest) return null;
    return {
      lastFocus: latest.focus,
      lastIssue: latest.currentIssue,
      lastSavedAt: latest.createdAt,
      totalSaved: savedEntries.length,
    };
  }, [savedEntries]);
  const currentSprocket = sprocketOutput?.signature === currentSignature ? sprocketOutput.value : null;
  const currentCx = cxOutput?.signature === currentSignature ? cxOutput.value : null;
  const hasStaleInsight = Boolean(sprocketOutput && sprocketOutput.signature !== currentSignature) || Boolean(cxOutput && cxOutput.signature !== currentSignature);
  const favoriteCount = useMemo(() => savedEntries.filter((entry) => entry.favorite).length, [savedEntries]);

  useEffect(() => {
    setSprocketOutput(null);
    setCxOutput(null);
  }, [customerEmotion, desiredOutcome, scenario]);

  const trackMeaningfulInteraction = useCallback(() => {
    if (hasTrackedMeaningfulInteraction.current) return;
    registerToolUsage(TOOL_ID);
    hasTrackedMeaningfulInteraction.current = true;
  }, [registerToolUsage]);

  const openUpgrade = useCallback((_type: GateModalType, message: string) => {
    setUpgradeContextMessage(message);
    setShowUpgradeModal(true);
  }, []);

  const handleUpgrade = useCallback(async () => {
    window.open(TOOLBOX_UPGRADE_URL, '_blank', 'noopener,noreferrer');
    setShowUpgradeModal(false);
  }, []);

  const handleInfo = useCallback(() => {
    toast({
      title: 'Five-Minute Drill Builder',
      description: 'Pick the role, coaching focus, and current issue. Then build a fast drill with a scorecard and manager language.',
    });
  }, [toast]);

  useEffect(() => {
    const draft = getTempDraft(TOOL_ID);
    if (draft) {
      setConsultantNote(draft);
    }

    const handoff = readFullToolHandoff<{ draft?: string }>(TOOL_ID);
    if (handoff?.draft) {
      setConsultantNote(handoff.draft);
    }
    clearFullToolHandoff(TOOL_ID);
  }, []);

  useEffect(() => {
    setSavedEntries(readLocalEntries());
  }, []);

  useEffect(() => {
    writeTempDraft(TOOL_ID, consultantNote);
  }, [consultantNote]);

  useEffect(() => {
    async function loadCloudHistory() {
      if (!firebaseUser || !hasPaidAccess) {
        setCloudEntries([]);
        return;
      }

      setIsCloudLoading(true);
      const idToken = await firebaseUser.getIdToken();
      const result = await fetchToolboxEntries({ idToken, limit: 8 });
      setIsCloudLoading(false);

      if (result.ok) {
        setCloudEntries(result.data.entries);
      } else {
        setCloudEntries([]);
      }
    }

    void loadCloudHistory();
  }, [cloudRefreshTick, firebaseUser, hasPaidAccess]);

  const saveCurrentLocalEntry = useCallback(() => {
    trackMeaningfulInteraction();
    const nextEntry = buildSavedEntry({
      input: currentInput,
      plan,
      sprocket: currentSprocket,
      cx: currentCx,
      variantSeed,
      favorite: draftFavorite,
    });

    const next = [
      nextEntry,
      ...savedEntries.filter((entry) => entry.signature !== nextEntry.signature),
    ].slice(0, 40);

    const carriedFavorite = savedEntries.find((entry) => entry.signature === nextEntry.signature)?.favorite;
    if (carriedFavorite && !nextEntry.favorite) {
      next[0] = { ...next[0], favorite: true };
    }

    setSavedEntries(next);
    writeLocalEntries(next);
    toast({ title: 'Saved locally', description: 'This drill is stored on this device.' });
  }, [currentCx, currentInput, currentSprocket, draftFavorite, plan, savedEntries, toast, trackMeaningfulInteraction, variantSeed]);

  const saveCurrentCloudEntry = useCallback(async () => {
    if (!hasPaidAccess) {
      openUpgrade('paid', 'Unlock cloud sync to save and sync drill coaching across devices.');
      return;
    }

    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to sync this coaching drill.' });
      return;
    }

    trackMeaningfulInteraction();
    setIsCloudSaving(true);

    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(currentInput, plan, currentSprocket, currentCx, draftFavorite, variantSeed),
    });

    setIsCloudSaving(false);

    if (!result.ok) {
      if (result.code === 'PAYMENT_REQUIRED') {
        openUpgrade('paid', 'Paid AutoShop access is required for cloud sync.');
      }
      toast({ variant: 'destructive', title: result.message });
      return;
    }

    setCloudRefreshTick((value) => value + 1);
    toast({ title: 'Synced to cloud', description: 'Five-Minute Drill Builder coaching is saved server-side.' });
  }, [currentCx, currentInput, currentSprocket, draftFavorite, firebaseUser, hasPaidAccess, openUpgrade, plan, toast, trackMeaningfulInteraction, variantSeed]);

  const handleSave = useCallback(() => {
    trackMeaningfulInteraction();
    saveCurrentLocalEntry();
    if (hasPaidAccess && firebaseUser) {
      void saveCurrentCloudEntry();
    }
  }, [firebaseUser, hasPaidAccess, saveCurrentCloudEntry, saveCurrentLocalEntry, trackMeaningfulInteraction]);

  const handleCopy = useCallback(async () => {
    trackMeaningfulInteraction();
    const payload = [
      plan.quickCopy,
      '',
      `Coach this way: ${plan.coachThisWay}`,
      `Avoid: ${plan.avoidThis}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Drill plan copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [plan.avoidThis, plan.coachThisWay, plan.quickCopy, toast, trackMeaningfulInteraction]);

  const handleRunSprocket = useCallback(() => {
    if (!hasSprocketAccess) {
      const message = hasPaidAccess
        ? 'Upgrade to AutoDriveCX to unlock the Sprocket drill recommendation and manager language rewrite.'
        : 'Create a paid AutoShop account to unlock the Sprocket drill recommendation.';
      openUpgrade(hasPaidAccess ? 'autodrive_cx' : 'paid', message);
      return;
    }

    trackMeaningfulInteraction();
    setSprocketOutput({
      signature: currentSignature,
      value: getFiveMinuteDrillSprocketInsight(currentInput, plan, variantSeed),
    });
  }, [currentInput, currentSignature, hasPaidAccess, hasSprocketAccess, openUpgrade, plan, trackMeaningfulInteraction, variantSeed]);

  const handleRunAutoDriveCx = useCallback(() => {
    if (!hasAutoDriveCxAccess) {
      const message = hasPaidAccess
        ? 'Upgrade to AutoDriveCX for personalized tone, pacing, trust, and coaching-history guidance.'
        : 'Create a paid AutoShop account to unlock AutoDriveCX personalized coaching.';
      openUpgrade(hasPaidAccess ? 'autodrive_cx' : 'paid', message);
      return;
    }

    trackMeaningfulInteraction();
    setCxOutput({
      signature: currentSignature,
      value: getFiveMinuteDrillCxInsight(currentInput, plan, user, recentHistory, variantSeed),
    });
  }, [currentInput, currentSignature, hasAutoDriveCxAccess, hasPaidAccess, openUpgrade, plan, recentHistory, trackMeaningfulInteraction, user, variantSeed]);

  const handleRefine = useCallback(() => {
    if (!hasSprocketAccess) {
      handleRunSprocket();
      return;
    }

    handleRunSprocket();
    if (hasAutoDriveCxAccess) {
      handleRunAutoDriveCx();
    }

    toast({
      title: 'Refined',
      description: 'Sprocket coaching has been generated for this drill.',
    });

    window.requestAnimationFrame(() => {
      guidanceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [handleRunAutoDriveCx, handleRunSprocket, hasAutoDriveCxAccess, hasSprocketAccess, toast]);

  const handleRegenerate = useCallback(() => {
    trackMeaningfulInteraction();
    setVariantSeed((value) => value + 1);
    setSprocketOutput(null);
    setCxOutput(null);
    setDraftFavorite(false);
  }, [trackMeaningfulInteraction]);

  const handleReset = useCallback(() => {
    trackMeaningfulInteraction();
    setScenario('Sales Associate');
    setCustomerEmotion('greeting');
    setDesiredOutcome('too vague');
    setConsultantNote('');
    setVariantSeed(0);
    setSprocketOutput(null);
    setCxOutput(null);
    setDraftFavorite(false);
    writeTempDraft(TOOL_ID, '');
  }, [trackMeaningfulInteraction]);

  const handleLoadLocalEntry = useCallback((entry: FiveMinuteDrillSavedEntry) => {
    trackMeaningfulInteraction();
    setScenario(entry.role);
    setCustomerEmotion(entry.focus);
    setDesiredOutcome(entry.currentIssue);
    setConsultantNote(entry.managerNote);
    setVariantSeed(entry.variantSeed);
    setDraftFavorite(Boolean(entry.favorite));
    setSprocketOutput(entry.sprocketInsight ? { signature: entry.signature, value: entry.sprocketInsight } : null);
    setCxOutput(entry.cxInsight ? { signature: entry.signature, value: entry.cxInsight } : null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({ title: 'Loaded', description: 'Saved drill restored.' });
  }, [toast, trackMeaningfulInteraction]);

  const toggleFavorite = useCallback((signature: string) => {
    const next = savedEntries.map((entry) => (
      entry.signature === signature ? { ...entry, favorite: !entry.favorite } : entry
    ));
    setSavedEntries(next);
    writeLocalEntries(next);
  }, [savedEntries]);

  const handleBuild = useCallback(() => {
    trackMeaningfulInteraction();
    setVariantSeed((value) => value + 1);
    setSprocketOutput(null);
    setCxOutput(null);
    toast({ title: 'Drill built', description: 'Your five-minute coaching drill is ready.' });
    window.requestAnimationFrame(() => {
      outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [toast, trackMeaningfulInteraction]);

  const scenarioBadges = [
    `${ROLE_META[scenario].tone} ready`,
    'Fast drill flow',
    hasPaidAccess ? 'Cloud sync ready' : 'Local saves only',
  ];

  return (
    <div className="min-h-screen bg-[#101418] text-[#e0e2e9] pb-40">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[#4a4456] bg-[#1c2024]/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild className="h-10 w-10 rounded-full p-0 text-[#e0e2e9] hover:bg-[#272a2f]">
            <Link href="/autoshop" aria-label="Back to AutoShop">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <span className="font-headline text-lg font-semibold text-[#e0e2e9]">Five-Minute Drill Builder</span>
        </div>
        <button
          type="button"
          onClick={handleInfo}
          className="rounded-full p-2 text-[#e0e2e9] transition-colors hover:bg-[#272a2f]"
          aria-label="How Five-Minute Drill Builder works"
        >
          <span className="material-symbols-outlined">info</span>
        </button>
      </header>

      <main className="mx-auto w-full max-w-md space-y-8 px-6 pt-8">
        <div className="space-y-2">
          <Badge className="rounded-full border border-[#7B2EFF]/40 bg-[#1a122d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9c9ff]">
            Manager coaching drill
          </Badge>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-[#d1bcff]">
            Build a 5-minute coaching drill in under a minute.
          </h1>
          <p className="font-body text-base leading-6 text-[#ccc3d9]">
            Pick the role, focus, and issue. The tool builds a repeatable drill with a scorecard, manager cues, and a second rep.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {scenarioBadges.map((label) => (
              <Badge
                key={label}
                className={cn(
                  'rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
                  label.includes('Cloud')
                    ? 'border-[#2e8cff]/40 bg-[#103055] text-[#bde1ff]'
                    : label.includes('Local')
                      ? 'border-[#7B2EFF]/40 bg-[#1a122d] text-[#d9c9ff]'
                      : 'border-[#9DEE75]/35 bg-[#112111] text-[#bdf2a7]',
                )}
              >
                {label}
              </Badge>
            ))}
          </div>
        </div>

        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="font-headline text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">Select Role</h2>
            <span className="text-xs font-medium text-[#ccc3d9]">1 of 2</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FIVE_MINUTE_DRILL_ROLES.map((item) => {
              const meta = ROLE_META[item];
              const active = scenario === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setScenario(item)}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-all active:scale-[0.98]',
                    active
                      ? 'border-[#9DEE75] bg-[#101b11] shadow-[0_0_0_1px_rgba(157,238,117,0.55),0_0_24px_rgba(157,238,117,0.45),0_0_64px_rgba(157,238,117,0.22)]'
                      : 'border-[#4a4456] bg-[#272a2f] hover:border-[#d1bcff]',
                  )}
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-[#d1bcff] text-[#24005b]">
                    <span className="material-symbols-outlined">{meta.icon}</span>
                  </div>
                  <div className="font-headline text-sm font-semibold text-[#e0e2e9]">{meta.label}</div>
                  <div className="mt-1 text-[11px] text-[#ccc3d9]">{meta.tone}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-headline text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">Coaching Focus</h2>
          <div className="flex flex-wrap gap-2">
            {FIVE_MINUTE_DRILL_FOCUSES.map((item) => (
              <FieldChip
                key={item}
                active={customerEmotion === item}
                label={item}
                hint="Tap to set the drill focus"
                onClick={() => setCustomerEmotion(item)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-headline text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">Current Issue</h2>
          <div className="flex flex-wrap gap-2">
            {FIVE_MINUTE_DRILL_ISSUES.map((item) => (
              <FieldChip
                key={item}
                active={desiredOutcome === item}
                label={item}
                hint="The reason the drill exists"
                onClick={() => setDesiredOutcome(item)}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-headline text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">Manager Note (optional)</h2>
          <Textarea
            value={consultantNote}
            onChange={(event) => setConsultantNote(event.target.value)}
            placeholder="Type the rough coaching language you want sharpened."
            className="min-h-[96px] border-[#4a4456] bg-[#181c20] text-[#e0e2e9] placeholder:text-[#958da2] focus-visible:ring-[#d1bcff]"
          />
        </section>

        <div className="sticky bottom-4 z-40 -mx-1">
          <Button
            type="button"
            onClick={handleBuild}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#d1bcff] px-4 font-headline text-base font-semibold text-[#3d0090] shadow-[0_14px_30px_rgba(209,188,255,0.25)] transition-transform active:scale-[0.98] hover:bg-[#e2d2ff]"
          >
            <Sparkles className="h-4 w-4" />
            Build Drill
          </Button>
        </div>

        <section
          ref={outputRef}
          className="overflow-hidden rounded-xl border border-[#4a4456] bg-[#0b0f13]"
        >
          <div className="space-y-6 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-[#7B2EFF]/40 bg-[#1a122d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9c9ff]">
                5-minute drill
              </Badge>
              {hasStaleInsight && (
                <Badge className="rounded-full border border-[#9DEE75]/35 bg-[#112111] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#bdf2a7]">
                  Refresh needed
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#9DEE75]">Drill Name</div>
              <h2 className="font-headline text-2xl font-semibold text-[#e0e2e9]">{plan.drillName}</h2>
              <p className="text-sm leading-6 text-[#ccc3d9]">{plan.summary}</p>
            </div>

            <div className="grid gap-3">
              {plan.stages.map((stage) => (
                <div key={stage.label} className="rounded-xl border border-[#4a4456] bg-[#181c20] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#d1bcff]">{stage.label}</p>
                    <span className="text-[11px] text-[#ccc3d9]">Coach live</span>
                  </div>
                  <p className="text-sm leading-6 text-[#e0e2e9]">{stage.body}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {plan.scorecard.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-[#4a4456] bg-[#181c20] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">{metric.label}</span>
                    <span className="text-sm font-semibold text-[#e0e2e9]">{metric.value}/5</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#0b0f13]">
                    <div className="h-full bg-[#9DEE75]" style={{ width: `${(metric.value / 5) * 100}%` }} />
                  </div>
                  <p className="text-xs leading-5 text-[#ccc3d9]">{metric.note}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-[#9DEE75]/30 bg-[#112115] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#bdf2a7]">Coach This Way</p>
                <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{plan.coachThisWay}</p>
              </div>
              <div className="rounded-xl border border-[#ffb4ab]/30 bg-[#24070b] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#ffb4ab]">Avoid Saying This</p>
                <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{plan.avoidThis}</p>
              </div>
            </div>

            <div className="rounded-xl bg-[#272a2f] p-4 space-y-2">
              <span className="font-headline text-sm uppercase tracking-[0.05em] text-[#d1bcff]">Next Drill If They Struggle</span>
              <p className="font-body text-sm leading-6 text-[#e0e2e9]">{plan.nextDrill}</p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <button
                type="button"
                onClick={handleCopy}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#4a4456] bg-[#272a2f] font-headline text-sm font-semibold text-[#e0e2e9] transition-colors hover:bg-[#31353a]"
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#4a4456] bg-[#272a2f] font-headline text-sm font-semibold text-[#e0e2e9] transition-colors hover:bg-[#31353a]"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
              <button
                type="button"
                onClick={() => setDraftFavorite((value) => !value)}
                className={cn(
                  'flex h-11 items-center justify-center gap-2 rounded-lg border font-headline text-sm font-semibold transition-colors',
                  draftFavorite
                    ? 'border-[#9DEE75] bg-[#112115] text-[#bdf2a7] shadow-[0_0_0_1px_rgba(157,238,117,0.5),0_0_18px_rgba(157,238,117,0.24)] hover:bg-[#132718]'
                    : 'border-[#4a4456] bg-[#272a2f] text-[#e0e2e9] hover:bg-[#31353a]',
                )}
              >
                <Star className={cn('h-4 w-4', draftFavorite && 'fill-current')} />
                {draftFavorite ? 'Favorited' : 'Favorite'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleRefine}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#d1bcff] font-headline text-sm font-semibold text-[#3d0090] transition-transform active:scale-95 hover:bg-[#e2d2ff]"
            >
              <Sparkles className="h-4 w-4" />
              Refine
            </button>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleRegenerate}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#4a4456] bg-[#181c20] font-headline text-xs font-semibold uppercase tracking-[0.08em] text-[#ccc3d9] transition-colors hover:bg-[#272a2f]"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#4a4456] bg-[#181c20] font-headline text-xs font-semibold uppercase tracking-[0.08em] text-[#ccc3d9] transition-colors hover:bg-[#272a2f]"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>
        </section>

        <section ref={guidanceRef} className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="font-headline text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">Optional Guidance</h2>
            <span className="text-xs font-medium text-[#ccc3d9]">{hasSprocketAccess ? 'Refined view' : 'Locked preview'}</span>
          </div>

          <div className="grid gap-4">
            <Card className="border-[#4a4456] bg-[#181c20]">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-[#e0e2e9]">
                    <Sparkles className="h-4 w-4 text-[#d1bcff]" />
                    Sprocket Insight:
                  </CardTitle>
                  <Badge className="rounded-full border border-[#7B2EFF]/45 bg-[#1a122d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9c9ff]">Paid only</Badge>
                </div>
                <CardDescription className="text-[#ccc3d9]">
                  Rewrites the manager language, explains the issue, and suggests the next drill when a rep gets stuck.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {hasSprocketAccess ? (
                  currentSprocket ? (
                    <div className="space-y-3 rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Issue read</p>
                        <p className="mt-1 text-sm leading-6 text-[#e0e2e9]">{currentSprocket.issueRead}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Drill recommendation</p>
                        <p className="mt-1 text-sm leading-6 text-[#e0e2e9]">{currentSprocket.drillRecommendation}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Manager language</p>
                        <p className="mt-1 text-sm leading-6 text-[#e0e2e9]">{currentSprocket.managerLanguage}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Risky phrases</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {currentSprocket.riskyPhrases.map((phrase) => (
                            <Badge
                              key={phrase}
                              className="rounded-full border border-[#ffb4ab]/30 bg-[#24070b] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffd9d4]"
                            >
                              {phrase}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-[#4a4456] bg-[#181c20] p-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Calmer text</p>
                        <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{currentSprocket.calmText}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">
                      Press Refine to generate the Sprocket version of your drill.
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                      <div className="space-y-2 opacity-40 blur-[7px] select-none">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Issue read</p>
                        <p className="text-sm leading-6 text-[#e0e2e9]">The rep needs a cleaner drill recommendation.</p>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Manager language</p>
                        <p className="text-sm leading-6 text-[#e0e2e9]">Keep the coaching short, positive, and specific.</p>
                      </div>
                    </div>
                    <Button className="h-11 w-full bg-[#9DEE75] text-[#08140c] hover:bg-[#b6f592]" onClick={() => openUpgrade('paid', 'Unlock Sprocket to rewrite the drill language and suggest the next drill.') }>
                      <Lock className="mr-2 h-4 w-4" />
                      Unlock Sprocket
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-[#4a4456] bg-[#181c20]">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-[#e0e2e9]">
                    <Sparkles className="h-4 w-4 text-[#9DEE75]" />
                    AutoDriveCX Coaching
                  </CardTitle>
                  <Badge className="rounded-full border border-[#2e8cff]/40 bg-[#103055] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#bde1ff]">CX aware</Badge>
                </div>
                <CardDescription className="text-[#ccc3d9]">
                  Connects the drill to tone, pacing, clarity, trust, and prior coaching history.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {hasAutoDriveCxAccess ? (
                  currentCx ? (
                    <div className="space-y-3 rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full border border-[#9DEE75]/35 bg-[#112111] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#bdf2a7]">
                          Focus skill: {currentCx.focusSkill}
                        </Badge>
                        <Badge className="rounded-full border border-[#7eeeff]/35 bg-[#112332] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#c8f6ff]">
                          {currentCx.hasProfile ? 'Personalized' : 'General coaching'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">CX note</p>
                        <p className="mt-1 text-sm leading-6 text-[#e0e2e9]">{currentCx.personalNote}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {currentCx.coachingNotes.map((note) => (
                          <div key={note.label} className="rounded-xl border border-[#4a4456] bg-[#181c20] p-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">{note.label}</p>
                            <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{note.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">
                      Press Refine to tailor coaching to the selected CX profile.
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                      <div className="space-y-2 opacity-40 blur-[7px] select-none">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">CX note</p>
                        <p className="text-sm leading-6 text-[#e0e2e9]">Your coaching gets sharper when clarity, pacing, and trust are personalized.</p>
                      </div>
                    </div>
                    <Button className="h-11 w-full bg-[#9DEE75] text-[#08140c] hover:bg-[#b6f592]" onClick={() => openUpgrade('autodrive_cx', 'Upgrade to AutoDriveCX for personalized tone, pacing, trust, and follow-up coaching.') }>
                      <Lock className="mr-2 h-4 w-4" />
                      Unlock AutoDriveCX
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        <section ref={historyRef} className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="font-headline text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">Saved Drills</h2>
            <span className="text-xs font-medium text-[#ccc3d9]">{savedEntries.length} local · {favoriteCount} favorites</span>
          </div>

          <Card className="border-[#4a4456] bg-[#181c20]">
            <CardHeader>
              <CardTitle className="text-lg text-[#e0e2e9]">Local history</CardTitle>
              <CardDescription className="text-[#ccc3d9]">Free users keep saved drills on this device.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {savedEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">
                  No saved drills yet. Hit Save after you like the output.
                </div>
              ) : (
                savedEntries.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#e0e2e9]">{entry.role} · {entry.focus} · {entry.currentIssue}</p>
                        <p className="text-xs text-[#958da2]">{new Date(entry.createdAt).toLocaleDateString()} · Variation {entry.variantSeed + 1}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                          'h-8 px-2 text-xs font-semibold',
                          entry.favorite ? 'text-[#9DEE75] hover:bg-[#132115]' : 'text-[#cdd3e3] hover:bg-[#272a2f]',
                        )}
                        onClick={() => toggleFavorite(entry.signature)}
                      >
                        <Star className={cn('mr-1 h-4 w-4', entry.favorite && 'fill-current')} />
                        {entry.favorite ? 'Favorited' : 'Favorite'}
                      </Button>
                    </div>
                    <p className="text-sm leading-6 text-[#e0e2e9]">{entry.drillName}</p>
                    <p className="mt-1 text-sm leading-6 text-[#ccc3d9]">{entry.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.sprocketInsight && (
                        <Badge className="rounded-full border border-[#7B2EFF]/40 bg-[#1a122d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9c9ff]">
                          Sprocket
                        </Badge>
                      )}
                      {entry.cxInsight && (
                        <Badge className="rounded-full border border-[#2e8cff]/40 bg-[#103055] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#bde1ff]">
                          AutoDriveCX
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 px-2 text-xs font-semibold text-[#cdd3e3] hover:bg-[#272a2f]"
                        onClick={() => handleLoadLocalEntry(entry)}
                      >
                        Load
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-[#4a4456] bg-[#181c20]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-[#e0e2e9]">
                <Cloud className="h-4 w-4 text-[#d1bcff]" />
                Synced history
              </CardTitle>
              <CardDescription className="text-[#ccc3d9]">Paid users can sync saved drills to their account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!hasPaidAccess ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                    <div className="space-y-2 opacity-40 blur-[7px] select-none">
                      <p className="text-sm font-semibold text-[#e0e2e9]">Cloud-synced history unlocks here.</p>
                      <p className="text-sm leading-6 text-[#ccc3d9]">Keep your strongest drills and richer CX notes in your account.</p>
                    </div>
                  </div>
                  <Button className="h-11 w-full bg-[#9DEE75] text-[#08140c] hover:bg-[#b6f592]" onClick={() => openUpgrade('paid', 'Unlock cloud sync and coaching history for Five-Minute Drill Builder.') }>
                    <Lock className="mr-2 h-4 w-4" />
                    Unlock History Sync
                  </Button>
                </div>
              ) : isCloudLoading ? (
                <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">Loading synced history...</div>
              ) : !firebaseUser ? (
                <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">Sign in to see synced coaching history.</div>
              ) : cloudEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">No synced coaching yet. Save a drill to your account.</div>
              ) : (
                cloudEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#e0e2e9]">Synced entry</p>
                      <span className="text-xs text-[#958da2]">{new Date(entry.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="space-y-1 text-sm text-[#e0e2e9]">
                      {parseSavedEntryPreview(entry).map((line) => (
                        <p key={line} className="leading-6">{line}</p>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </main>

      <div className="pointer-events-none fixed inset-0 -z-10 opacity-10">
        <div className="absolute right-[-10%] top-[-10%] h-[50%] w-[80%] rounded-full bg-gradient-to-br from-[#d1bcff] to-transparent blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[50%] w-[80%] rounded-full bg-gradient-to-tr from-[#8bda64] to-transparent blur-[120px]" />
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        contextMessage={upgradeContextMessage}
        onOpenChange={(open) => {
          setShowUpgradeModal(open);
        }}
        onUpgrade={handleUpgrade}
      />
    </div>
  );
}

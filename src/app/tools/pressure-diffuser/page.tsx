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
  PRESSURE_DIFFUSER_EMOTIONS,
  PRESSURE_DIFFUSER_OUTCOMES,
  PRESSURE_DIFFUSER_SCENARIOS,
  getPressureDiffuserCxInsight,
  getPressureDiffuserPlan,
  getPressureDiffuserSprocketInsight,
  type PressureDiffuserCxInsight,
  type PressureDiffuserEmotion,
  type PressureDiffuserInput,
  type PressureDiffuserOutcome,
  type PressureDiffuserPlan,
  type PressureDiffuserSavedEntry,
  type PressureDiffuserScenario,
  type PressureDiffuserSprocketInsight,
} from '@/lib/tools/pressure-diffuser';
import type { ToolboxSavedEntry } from '@/lib/tools/toolbox';

const TOOL_ID = 'pressure-diffuser';
const LOCAL_ENTRIES_KEY = 'pressureDiffuserSavedEntriesV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';

type GateModalType = 'paid' | 'autodrive_cx' | null;

type GeneratedState<T> = {
  signature: string;
  value: T;
};

function normalizeSignaturePart(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function buildSignature(input: PressureDiffuserInput, variantSeed: number): string {
  return [
    normalizeSignaturePart(input.scenario),
    normalizeSignaturePart(input.customerEmotion),
    normalizeSignaturePart(input.desiredOutcome),
    normalizeSignaturePart(input.consultantNote),
    `seed:${variantSeed}`,
  ].join('|');
}

function readLocalEntries(): PressureDiffuserSavedEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PressureDiffuserSavedEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalEntries(entries: PressureDiffuserSavedEntry[]) {
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
  input: PressureDiffuserInput,
  plan: PressureDiffuserPlan,
  sprocket: PressureDiffuserSprocketInsight | null,
  cx: PressureDiffuserCxInsight | null,
  favorite: boolean,
  variantSeed: number,
): string {
  const blocks = [
    'PRESSURE DIFFUSER',
    '',
    `Scenario: ${input.scenario}`,
    `Emotion: ${input.customerEmotion}`,
    `Outcome: ${input.desiredOutcome}`,
    `Consultant Note: ${input.consultantNote.trim() || 'none'}`,
    `Favorite: ${favorite ? 'yes' : 'no'}`,
    `Variant: ${variantSeed}`,
    '',
    `Acknowledge: ${plan.framework.acknowledge}`,
    `Validate: ${plan.framework.validate}`,
    `Clarify: ${plan.framework.clarify}`,
    `Calm next step: ${plan.framework.calmNextStep}`,
    `Say this: ${plan.sayThis}`,
    `Avoid saying this: ${plan.avoidThis}`,
    `Quick copy: ${plan.quickCopy}`,
    `Next best question: ${plan.nextBestQuestion}`,
  ];

  if (sprocket) {
    blocks.push(
      '',
      'SPROCKET INSIGHT',
      `Emotion read: ${sprocket.emotionRead}`,
      `Rewritten response: ${sprocket.rewrittenResponse}`,
      `Risky phrases: ${sprocket.riskyPhrases.join(', ') || 'none'}`,
      `Calm SMS: ${sprocket.calmSms}`,
      `Coaching note: ${sprocket.coachingNote}`,
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
  input: PressureDiffuserInput;
  plan: PressureDiffuserPlan;
  sprocket: PressureDiffuserSprocketInsight | null;
  cx: PressureDiffuserCxInsight | null;
  variantSeed: number;
  favorite: boolean;
}): PressureDiffuserSavedEntry {
  const signature = buildSignature(args.input, args.variantSeed);
  return {
    id: crypto.randomUUID(),
    signature,
    createdAt: new Date().toISOString(),
    variantSeed: args.variantSeed,
    scenario: args.input.scenario,
    customerEmotion: args.input.customerEmotion,
    desiredOutcome: args.input.desiredOutcome,
    consultantNote: args.input.consultantNote,
    framework: args.plan.framework,
    sayThis: args.plan.sayThis,
    avoidThis: args.plan.avoidThis,
    quickCopy: args.plan.quickCopy,
    calmSms: args.plan.calmSms,
    nextBestQuestion: args.plan.nextBestQuestion,
    favorite: args.favorite,
    sprocketInsight: args.sprocket,
    cxInsight: args.cx,
  };
}

function parseSavedEntryPreview(entry: ToolboxSavedEntry): string[] {
  return formatCloudPreview(entry.content);
}

const SCENARIO_META: Record<PressureDiffuserScenario, { label: string; icon: string }> = {
  'price concern': { label: 'Price Concern', icon: 'payments' },
  'wait time': { label: 'Wait Time', icon: 'schedule' },
  'repair cost': { label: 'Repair Cost', icon: 'build_circle' },
  'trade value': { label: 'Trade Value', icon: 'swap_horiz' },
  'availability issue': { label: 'Availability Issue', icon: 'inventory_2' },
  'missed expectation': { label: 'Missed Expectation', icon: 'priority_high' },
  'angry customer': { label: 'Angry Customer', icon: 'sentiment_very_dissatisfied' },
  'confused customer': { label: 'Confused Customer', icon: 'help' },
};

export default function PressureDiffuserPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [scenario, setScenario] = useState<PressureDiffuserScenario>('price concern');
  const [customerEmotion, setCustomerEmotion] = useState<PressureDiffuserEmotion>('frustrated');
  const [desiredOutcome, setDesiredOutcome] = useState<PressureDiffuserOutcome>('reset expectations');
  const [consultantNote, setConsultantNote] = useState<string>(() => getTempDraft(TOOL_ID));
  const [variantSeed, setVariantSeed] = useState(0);
  const [savedEntries, setSavedEntries] = useState<PressureDiffuserSavedEntry[]>([]);
  const [cloudEntries, setCloudEntries] = useState<ToolboxSavedEntry[]>([]);
  const [draftFavorite, setDraftFavorite] = useState(false);
  const [cloudRefreshTick, setCloudRefreshTick] = useState(0);

  const [sprocketOutput, setSprocketOutput] = useState<GeneratedState<PressureDiffuserSprocketInsight> | null>(null);
  const [cxOutput, setCxOutput] = useState<GeneratedState<PressureDiffuserCxInsight> | null>(null);

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

  const currentInput = useMemo<PressureDiffuserInput>(() => ({
    scenario,
    customerEmotion,
    desiredOutcome,
    consultantNote,
  }), [consultantNote, customerEmotion, desiredOutcome, scenario]);

  const currentSignature = useMemo(() => buildSignature(currentInput, variantSeed), [currentInput, variantSeed]);
  const plan = useMemo(() => getPressureDiffuserPlan(currentInput, variantSeed), [currentInput, variantSeed]);
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
      title: 'Pressure Diffuser',
      description: 'Pick the pressure point, mood, and outcome, then generate a calmer response and refine it if you have access.',
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
    toast({ title: 'Saved locally', description: 'This response is stored on this device.' });
  }, [currentCx, currentInput, currentSprocket, draftFavorite, plan, savedEntries, toast, trackMeaningfulInteraction, variantSeed]);

  const saveCurrentCloudEntry = useCallback(async () => {
    if (!hasPaidAccess) {
      openUpgrade('paid', 'Unlock cloud sync to save and sync Pressure Diffuser entries across devices.');
      return;
    }

    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to sync this coaching entry.' });
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
    toast({ title: 'Synced to cloud', description: 'Pressure Diffuser coaching is now saved server-side.' });
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
      `Next best question: ${plan.nextBestQuestion}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Calm response copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [plan.nextBestQuestion, plan.quickCopy, toast, trackMeaningfulInteraction]);

  const handleRunSprocket = useCallback(() => {
    if (!hasSprocketAccess) {
      const message = hasPaidAccess
        ? 'Upgrade to AutoDriveCX to unlock the Sprocket rewrite, emotion read, and calmer next-question guidance.'
        : 'Create a paid AutoShop account to unlock the Sprocket rewrite and deeper coaching.';
      openUpgrade(hasPaidAccess ? 'autodrive_cx' : 'paid', message);
      return;
    }

    trackMeaningfulInteraction();
    setSprocketOutput({
      signature: currentSignature,
      value: getPressureDiffuserSprocketInsight(currentInput, plan, variantSeed),
    });
  }, [currentInput, currentSignature, hasPaidAccess, hasSprocketAccess, openUpgrade, plan, trackMeaningfulInteraction, variantSeed]);

  const handleRunAutoDriveCx = useCallback(() => {
    if (!hasAutoDriveCxAccess) {
      const message = hasPaidAccess
        ? 'Upgrade to AutoDriveCX for personalized tone, pacing, trust, and empathy coaching.'
        : 'Create a paid AutoShop account to unlock AutoDriveCX personalized coaching.';
      openUpgrade(hasPaidAccess ? 'autodrive_cx' : 'paid', message);
      return;
    }

    trackMeaningfulInteraction();
    setCxOutput({
      signature: currentSignature,
      value: getPressureDiffuserCxInsight(currentInput, plan, user, variantSeed),
    });
  }, [currentInput, currentSignature, hasAutoDriveCxAccess, hasPaidAccess, openUpgrade, plan, trackMeaningfulInteraction, user, variantSeed]);

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
      description: 'Sprocket guidance has been generated for this response.',
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
    setScenario('price concern');
    setCustomerEmotion('frustrated');
    setDesiredOutcome('reset expectations');
    setConsultantNote('');
    setVariantSeed(0);
    setSprocketOutput(null);
    setCxOutput(null);
    setDraftFavorite(false);
    writeTempDraft(TOOL_ID, '');
  }, [trackMeaningfulInteraction]);

  const handleLoadLocalEntry = useCallback((entry: PressureDiffuserSavedEntry) => {
    trackMeaningfulInteraction();
    setScenario(entry.scenario);
    setCustomerEmotion(entry.customerEmotion);
    setDesiredOutcome(entry.desiredOutcome);
    setConsultantNote(entry.consultantNote);
    setVariantSeed(entry.variantSeed);
    setDraftFavorite(Boolean(entry.favorite));
    setSprocketOutput(entry.sprocketInsight ? { signature: entry.signature, value: entry.sprocketInsight } : null);
    setCxOutput(entry.cxInsight ? { signature: entry.signature, value: entry.cxInsight } : null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({ title: 'Loaded', description: 'Saved Pressure Diffuser response restored.' });
  }, [toast, trackMeaningfulInteraction]);

  const toggleFavorite = useCallback((signature: string) => {
    const next = savedEntries.map((entry) => (
      entry.signature === signature ? { ...entry, favorite: !entry.favorite } : entry
    ));
    setSavedEntries(next);
    writeLocalEntries(next);
  }, [savedEntries]);

  const updateScenario = useCallback((nextScenario: PressureDiffuserScenario) => {
    trackMeaningfulInteraction();
    setScenario(nextScenario);
  }, [trackMeaningfulInteraction]);

  const updateEmotion = useCallback((nextEmotion: PressureDiffuserEmotion) => {
    trackMeaningfulInteraction();
    setCustomerEmotion(nextEmotion);
  }, [trackMeaningfulInteraction]);

  const updateOutcome = useCallback((nextOutcome: PressureDiffuserOutcome) => {
    trackMeaningfulInteraction();
    setDesiredOutcome(nextOutcome);
  }, [trackMeaningfulInteraction]);

  const handleGenerate = useCallback(() => {
    trackMeaningfulInteraction();
    setVariantSeed((value) => value + 1);
    setSprocketOutput(null);
    setCxOutput(null);
    toast({
      title: 'Calm response generated',
      description: 'The response refreshed for the selected scenario.',
    });
    window.requestAnimationFrame(() => {
      outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [toast, trackMeaningfulInteraction]);

  const scenarioBadges = [
    'Live language',
    'Calm coaching',
    hasPaidAccess ? 'Cloud sync ready' : 'Local saves only',
  ];

  return (
    <div className="min-h-screen bg-[#101418] text-[#e0e2e9] pb-40">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[#4a4456] bg-[#1c2024]/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            asChild
            className="h-10 w-10 rounded-full p-0 text-[#e0e2e9] hover:bg-[#272a2f]"
          >
            <Link href="/autoshop" aria-label="Back to AutoShop">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <span className="font-['Space_Grotesk'] text-xl font-semibold text-[#e0e2e9]">
            Pressure Diffuser
          </span>
        </div>
        <button
          type="button"
          onClick={handleInfo}
          className="rounded-full p-2 text-[#e0e2e9] transition-colors hover:bg-[#272a2f]"
          aria-label="How Pressure Diffuser works"
        >
          <span className="material-symbols-outlined">info</span>
        </button>
      </header>

      <main className="mx-auto w-full max-w-md px-6 pt-10 space-y-10">
        <div className="space-y-2">
          <h1 className="font-['Space_Grotesk'] text-5xl font-bold tracking-tight text-[#d1bcff]">
            Pressure Diffuser
          </h1>
          <p className="font-['Inter'] text-lg leading-6 text-[#ccc3d9]">
            Turn tense moments into calm conversations.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {scenarioBadges.map((label) => (
              <Badge
                key={label}
                className={cn(
                  'rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]',
                  label === 'Cloud sync ready'
                    ? 'border-[#2e8cff]/40 bg-[#103055] text-[#bde1ff]'
                    : label === 'Local saves only'
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
            <h2 className="font-['Space_Grotesk'] text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">
              Select Scenario
            </h2>
            <span className="text-xs font-medium text-[#ccc3d9]">1 of 8</span>
          </div>
          <div className="hide-scrollbar -mx-6 flex gap-4 overflow-x-auto px-6 py-1">
            {PRESSURE_DIFFUSER_SCENARIOS.map((item) => {
              const meta = SCENARIO_META[item];
              const active = scenario === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => updateScenario(item)}
                  className={cn(
                    'min-w-[140px] flex-shrink-0 rounded-xl border p-4 text-left transition-all active:scale-95',
                    active
                      ? 'border-[#9DEE75] bg-[#101b11] shadow-[0_0_0_1px_rgba(157,238,117,0.6),0_0_24px_rgba(157,238,117,0.5),0_0_64px_rgba(157,238,117,0.24)]'
                      : 'border-[#4a4456] bg-[#272a2f] hover:border-[#d1bcff]',
                  )}
                >
                  <div className={cn(
                    'mb-3 flex h-10 w-10 items-center justify-center rounded-md',
                    active ? 'bg-[#d1bcff] text-[#24005b]' : 'bg-[#d1bcff] text-[#24005b]'
                  )}>
                    <span className="material-symbols-outlined">{meta.icon}</span>
                  </div>
                  <span className="font-['Space_Grotesk'] text-sm font-semibold text-[#e0e2e9]">
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-['Space_Grotesk'] text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">
            Customer Emotion
          </h2>
          <div className="flex flex-wrap gap-2">
            {PRESSURE_DIFFUSER_EMOTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => updateEmotion(item)}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-semibold transition-colors active:scale-95',
                  customerEmotion === item
                    ? 'border-[#9DEE75] bg-[#d1bcff] text-[#3d0090] shadow-[0_0_0_1px_rgba(157,238,117,0.6),0_0_18px_rgba(157,238,117,0.32)]'
                    : 'border-[#4a4456] bg-[#1c2024] text-[#ccc3d9] hover:bg-[#272a2f]',
                )}
              >
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-['Space_Grotesk'] text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">
            Desired Outcome
          </h2>
          <div className="flex flex-wrap gap-2">
            {PRESSURE_DIFFUSER_OUTCOMES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => updateOutcome(item)}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-semibold transition-colors active:scale-95',
                  desiredOutcome === item
                    ? 'border-[#9DEE75] bg-[#d1bcff] text-[#3d0090] shadow-[0_0_0_1px_rgba(157,238,117,0.6),0_0_18px_rgba(157,238,117,0.32)]'
                    : 'border-[#4a4456] bg-[#1c2024] text-[#ccc3d9] hover:bg-[#272a2f]',
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-['Space_Grotesk'] text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">
            Additional Context
          </h2>
          <Textarea
            value={consultantNote}
            onChange={(event) => setConsultantNote(event.target.value)}
            placeholder="Any specific details? (e.g. 'Customer is in a hurry for a meeting')"
            className="min-h-[100px] border-[#4a4456] bg-[#181c20] text-[#e0e2e9] placeholder:text-[#958da2] focus-visible:ring-[#d1bcff]"
          />
        </section>

        <div className="py-2">
          <Button
            type="button"
            onClick={handleGenerate}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#d1bcff] px-4 font-['Space_Grotesk'] text-base font-semibold text-[#3d0090] shadow-lg transition-transform active:scale-95 hover:bg-[#e2d2ff]"
          >
            <span className="material-symbols-outlined">auto_awesome</span>
            Generate Calm Response
          </Button>
        </div>

        <section
          ref={outputRef}
          className="overflow-hidden rounded-xl border border-[#4a4456] bg-[#0b0f13]"
        >
          <div className="p-6 space-y-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-[#7B2EFF]/40 bg-[#1a122d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9c9ff]">
                Response framework
              </Badge>
              {hasStaleInsight && (
                <Badge className="rounded-full border border-[#9DEE75]/35 bg-[#112111] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#bdf2a7]">
                  Refresh needed
                </Badge>
              )}
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[#8bda64]">
                <span className="material-symbols-outlined">forum</span>
                <h2 className="font-['Space_Grotesk'] text-sm font-semibold uppercase tracking-[0.05em]">
                  Say This
                </h2>
              </div>
              <blockquote className="border-l-4 border-[#d1bcff] pl-5 font-['Space_Grotesk'] text-xl leading-relaxed text-[#e0e2e9]">
                &quot;{plan.sayThis}&quot;
              </blockquote>
            </div>

            <div className="flex gap-3 rounded-xl border border-[#ffb4ab]/30 bg-[#93000a]/10 p-4">
              <span className="material-symbols-outlined text-[#ffb4ab]">warning</span>
              <div className="space-y-1">
                <span className="font-['Space_Grotesk'] text-sm uppercase tracking-[0.05em] text-[#ffb4ab]">
                  Avoid Saying
                </span>
                <p className="font-['Inter'] text-sm font-medium text-[#e0e2e9]">{plan.avoidThis}</p>
              </div>
            </div>

            <details className="group border-t border-[#4a4456] pt-6">
              <summary className="flex list-none cursor-pointer items-center justify-between">
                <div className="flex items-center gap-2 text-[#ccc3d9]">
                  <span className="material-symbols-outlined text-[#d1bcff]">psychology</span>
                  <span className="font-['Space_Grotesk'] text-sm font-semibold uppercase tracking-[0.05em]">
                    Why this works
                  </span>
                </div>
                <span className="material-symbols-outlined transition-transform group-open:rotate-180">
                  expand_more
                </span>
              </summary>
              <div className="mt-4 rounded-lg bg-[#181c20] p-4 font-['Inter'] text-sm leading-6 text-[#ccc3d9]">
                <p>{plan.coachPrompt}</p>
                {currentCx && (
                  <p className="mt-3 text-[#d1bcff]">
                    {currentCx.personalNote}
                  </p>
                )}
              </div>
            </details>

            <div className="rounded-xl bg-[#272a2f] p-6 space-y-2">
              <span className="font-['Space_Grotesk'] text-sm uppercase tracking-[0.05em] text-[#d1bcff]">
                Next Best Question
              </span>
              <p className="font-['Space_Grotesk'] text-lg text-[#e0e2e9]">
                &quot;{plan.nextBestQuestion}&quot;
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#4a4456] bg-[#272a2f] font-['Space_Grotesk'] text-sm font-semibold text-[#e0e2e9] transition-colors hover:bg-[#31353a]"
              >
                <Copy className="h-4 w-4" />
                Copy
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#4a4456] bg-[#272a2f] font-['Space_Grotesk'] text-sm font-semibold text-[#e0e2e9] transition-colors hover:bg-[#31353a]"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
              <button
                type="button"
                onClick={() => setDraftFavorite((value) => !value)}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-lg border font-['Space_Grotesk'] text-sm font-semibold transition-colors",
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
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#d1bcff] font-['Space_Grotesk'] text-sm font-semibold text-[#3d0090] transition-transform active:scale-95 hover:bg-[#e2d2ff]"
            >
              <Sparkles className="h-4 w-4" />
              Refine
            </button>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleRegenerate}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#4a4456] bg-[#181c20] font-['Space_Grotesk'] text-xs font-semibold uppercase tracking-[0.08em] text-[#ccc3d9] transition-colors hover:bg-[#272a2f]"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#4a4456] bg-[#181c20] font-['Space_Grotesk'] text-xs font-semibold uppercase tracking-[0.08em] text-[#ccc3d9] transition-colors hover:bg-[#272a2f]"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>
        </section>

        <section ref={guidanceRef} className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="font-['Space_Grotesk'] text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">
              Optional Guidance
            </h2>
            <span className="text-xs font-medium text-[#ccc3d9]">
              {hasSprocketAccess ? 'Refined view' : 'Locked preview'}
            </span>
          </div>

          <div className="grid gap-4">
            <Card className="border-[#4a4456] bg-[#181c20]">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-[#e0e2e9]">
                    <Sparkles className="h-4 w-4 text-[#d1bcff]" />
                    Sprocket Insight:
                  </CardTitle>
                  <Badge className="rounded-full border border-[#7B2EFF]/45 bg-[#1a122d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9c9ff]">
                    Paid only
                  </Badge>
                </div>
                <CardDescription className="text-[#ccc3d9]">
                  Rewrites the response, explains the emotion, flags risky phrasing, and suggests the next best question.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {hasSprocketAccess ? (
                  currentSprocket ? (
                    <div className="space-y-3 rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">
                          What they may be feeling
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#e0e2e9]">{currentSprocket.emotionRead}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">
                          Rewritten response
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#e0e2e9]">{currentSprocket.rewrittenResponse}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">
                          Risky phrases
                        </p>
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
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">
                          Better next question
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#e0e2e9]">{currentSprocket.nextBestQuestion}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-[#4a4456] bg-[#181c20] p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Calmer SMS</p>
                          <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{currentSprocket.calmSms}</p>
                        </div>
                        <div className="rounded-xl border border-[#4a4456] bg-[#181c20] p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Coaching note</p>
                          <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{currentSprocket.coachingNote}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">
                      Press Refine to generate the Sprocket rewrite for this response.
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                      <div className="space-y-2 opacity-40 blur-[7px] select-none">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">
                          What they may be feeling
                        </p>
                        <p className="text-sm leading-6 text-[#e0e2e9]">
                          The customer wants control, clarity, and less pressure.
                        </p>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">
                          Rewritten response
                        </p>
                        <p className="text-sm leading-6 text-[#e0e2e9]">
                          I hear you. Let me keep this simple and calm.
                        </p>
                      </div>
                    </div>
                    <Button
                      className="h-11 w-full bg-[#9DEE75] text-[#08140c] hover:bg-[#b6f592]"
                      onClick={() => openUpgrade('paid', 'Unlock Sprocket to rewrite live language and calm pressure faster.')}
                    >
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
                  <Badge className="rounded-full border border-[#2e8cff]/40 bg-[#103055] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#bde1ff]">
                    CX aware
                  </Badge>
                </div>
                <CardDescription className="text-[#ccc3d9]">
                  Connects the response to tone, pacing, trust, empathy, objection handling, and follow-up.
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
                      Press Refine to tailor coaching to your CX profile.
                    </div>
                  )
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                      <div className="space-y-2 opacity-40 blur-[7px] select-none">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">CX note</p>
                        <p className="text-sm leading-6 text-[#e0e2e9]">
                          Tone, pacing, trust, and empathy become more specific with AutoDriveCX.
                        </p>
                      </div>
                    </div>
                    <Button
                      className="h-11 w-full bg-[#9DEE75] text-[#08140c] hover:bg-[#b6f592]"
                      onClick={() => openUpgrade('autodrive_cx', 'Upgrade to AutoDriveCX for personalized tone, pacing, trust, empathy, and follow-up coaching.')}
                    >
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
            <h2 className="font-['Space_Grotesk'] text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">
              Saved Responses
            </h2>
            <span className="text-xs font-medium text-[#ccc3d9]">
              {savedEntries.length} local · {favoriteCount} favorites
            </span>
          </div>

          <Card className="border-[#4a4456] bg-[#181c20]">
            <CardHeader>
              <CardTitle className="text-lg text-[#e0e2e9]">Local history</CardTitle>
              <CardDescription className="text-[#ccc3d9]">
                Free users keep saved responses on this device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {savedEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">
                  No saved responses yet. Hit Save after you like a response.
                </div>
              ) : (
                savedEntries.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#e0e2e9]">
                          {entry.scenario} · {entry.customerEmotion} · {entry.desiredOutcome}
                        </p>
                        <p className="text-xs text-[#958da2]">
                          {new Date(entry.createdAt).toLocaleDateString()} · Variation {entry.variantSeed + 1}
                        </p>
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
                    <p className="text-sm leading-6 text-[#e0e2e9]">{entry.sayThis}</p>
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
              <CardDescription className="text-[#ccc3d9]">
                Paid users can sync saved coaching to their account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!hasPaidAccess ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                    <div className="space-y-2 opacity-40 blur-[7px] select-none">
                      <p className="text-sm font-semibold text-[#e0e2e9]">Cloud-synced history unlocks here.</p>
                      <p className="text-sm leading-6 text-[#ccc3d9]">
                        Keep your strongest coaching moves and richer CX notes in your account.
                      </p>
                    </div>
                  </div>
                  <Button
                    className="h-11 w-full bg-[#9DEE75] text-[#08140c] hover:bg-[#b6f592]"
                    onClick={() => openUpgrade('paid', 'Unlock cloud sync and coaching history for Pressure Diffuser.')}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Unlock History Sync
                  </Button>
                </div>
              ) : isCloudLoading ? (
                <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">
                  Loading synced history...
                </div>
              ) : !firebaseUser ? (
                <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">
                  Sign in to see synced coaching history.
                </div>
              ) : cloudEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">
                  No synced coaching yet. Save a Pressure Diffuser entry to your account.
                </div>
              ) : (
                cloudEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#e0e2e9]">Synced entry</p>
                      <span className="text-xs text-[#958da2]">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
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

      <nav className="fixed bottom-0 z-50 flex h-20 w-full items-center justify-around border-t border-[#4a4456] bg-[#1c2024]/95 px-2 backdrop-blur-lg">
        <Link
          href="/autoshop"
          className="flex flex-col items-center justify-center rounded-xl bg-[#d1bcff] px-4 py-1 text-[#3d0090]"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>handyman</span>
          <span className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.15em]">Tools</span>
        </Link>
        <button
          type="button"
          onClick={() => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="flex flex-col items-center justify-center px-4 py-1 text-[#ccc3d9] transition-colors hover:text-[#d1bcff]"
        >
          <span className="material-symbols-outlined">auto_stories</span>
          <span className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.15em]">Library</span>
        </button>
        <Link
          href="/profile"
          className="flex flex-col items-center justify-center px-4 py-1 text-[#ccc3d9] transition-colors hover:text-[#d1bcff]"
        >
          <span className="material-symbols-outlined">settings</span>
          <span className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.15em]">Settings</span>
        </Link>
      </nav>

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

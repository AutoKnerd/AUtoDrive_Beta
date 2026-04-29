'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Cloud, Copy, Lock, RefreshCw, Save, Sparkles, Star, RotateCcw } from 'lucide-react';
import { Header } from '@/components/layout/header';
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

function actionButtonClass(active = false): string {
  return cn(
    'h-11 min-h-[44px] rounded-xl border px-4 text-sm font-semibold transition-all',
    active
      ? 'border-[#9DEE75] bg-[#9DEE75] text-[#071209] shadow-[0_0_0_1px_rgba(157,238,117,0.32),0_8px_24px_rgba(157,238,117,0.18)]'
      : 'border-[#2b3450] bg-[#11101b] text-[#e8e6f3] hover:border-[#7B2EFF] hover:bg-[#171224] hover:text-white',
  );
}

function ChoiceChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-h-[44px] rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-all',
        active
          ? 'border-[#9DEE75] bg-[#101b11] text-[#efffe7] shadow-[0_0_0_1px_rgba(157,238,117,0.22),0_10px_20px_rgba(157,238,117,0.12)]'
          : 'border-[#2b3450] bg-[#0f1019] text-[#d6d1ea] hover:border-[#7B2EFF]/80 hover:bg-[#171428] hover:text-[#f0ebff]',
      )}
    >
      {label}
    </button>
  );
}

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

  const scenarioBadges = [
    'Live language',
    'Calm coaching',
    hasPaidAccess ? 'Cloud sync ready' : 'Local saves only',
  ];

  return (
    <div className="min-h-screen bg-[#050308] text-[#f3f1fb]">
      <Header />

      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 pb-28 pt-4 md:space-y-6 md:px-6 md:pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            asChild
            className="h-10 gap-2 rounded-full border border-[#2d2449] bg-[#0f0d16] px-3 text-[#d9d0ef] hover:bg-[#171227] hover:text-white"
          >
            <Link href="/autoshop">
              <ChevronLeft className="h-4 w-4" />
              AutoShop
            </Link>
          </Button>
          <div className="flex flex-wrap gap-2">
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

        <section className="space-y-2">
          <Badge className="rounded-full border border-[#7B2EFF]/45 bg-[#1b122f] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d8c8ff]">
            Pressure Diffuser
          </Badge>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-5xl">
            Calm the moment without sounding weak.
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-[#b9c0d8] md:text-base">
            Pick the pressure point, the customer mood, and what you want to do next. The tool builds a calm response framework, then Sprocket and AutoDriveCX add deeper coaching when unlocked.
          </p>
        </section>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-[#2c2b42] bg-[#0d0b14]">
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-sm uppercase tracking-[0.22em] text-[#a9b2ca]">Scenario</CardTitle>
              <CardDescription className="text-[#7f88a2]">Choose the pressure point.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {PRESSURE_DIFFUSER_SCENARIOS.map((item) => (
                  <ChoiceChip
                    key={item}
                    active={scenario === item}
                    label={item}
                    onClick={() => updateScenario(item)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#2c2b42] bg-[#0d0b14]">
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-sm uppercase tracking-[0.22em] text-[#a9b2ca]">Customer mood</CardTitle>
              <CardDescription className="text-[#7f88a2]">Read the room before you speak.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {PRESSURE_DIFFUSER_EMOTIONS.map((item) => (
                  <ChoiceChip
                    key={item}
                    active={customerEmotion === item}
                    label={item}
                    onClick={() => updateEmotion(item)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#2c2b42] bg-[#0d0b14]">
            <CardHeader className="space-y-1 pb-3">
              <CardTitle className="text-sm uppercase tracking-[0.22em] text-[#a9b2ca]">Desired outcome</CardTitle>
              <CardDescription className="text-[#7f88a2]">Pick what the next step should do.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {PRESSURE_DIFFUSER_OUTCOMES.map((item) => (
                  <ChoiceChip
                    key={item}
                    active={desiredOutcome === item}
                    label={item}
                    onClick={() => updateOutcome(item)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[#2c2b42] bg-[#0d0b14]">
          <CardHeader>
            <CardTitle className="text-lg text-white">Your notes</CardTitle>
            <CardDescription className="text-[#97a1bc]">
              Optional. Paste what you were about to say, and we’ll calm it down.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={consultantNote}
              onChange={(event) => setConsultantNote(event.target.value)}
              placeholder="Example: I can check on that, but I need to be honest about the timing."
              className="min-h-[120px] resize-none border-[#2f3754] bg-[#0a0a12] text-[#f6f4ff] placeholder:text-[#6f7690] focus-visible:ring-[#7B2EFF]"
            />
          </CardContent>
        </Card>

        <Card className="border-[#2c2b42] bg-[#0f0d17]">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full border border-[#7B2EFF]/40 bg-[#1b132d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#dbcfff]">
                Response framework
              </Badge>
              {hasStaleInsight && (
                <Badge className="rounded-full border border-[#9DEE75]/35 bg-[#112211] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#c6f5a6]">
                  Refresh needed
                </Badge>
              )}
            </div>
            <CardTitle className="text-2xl font-black tracking-tight text-white">What to say right now</CardTitle>
            <CardDescription className="text-[#a3abc1]">
              The structure stays calm, direct, and easy to say out loud.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              {[
                ['Acknowledge', plan.framework.acknowledge],
                ['Validate', plan.framework.validate],
                ['Clarify', plan.framework.clarify],
                ['Calm next step', plan.framework.calmNextStep],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[#2d3550] bg-[#0b0c14] p-4">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">{label}</p>
                  <p className="text-sm leading-6 text-[#ecf0ff]">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[#2d3550] bg-[#0b0c14] p-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">Quick copy response</p>
                <p className="text-sm leading-6 text-[#ecf0ff]">{plan.quickCopy}</p>
              </div>
              <div className="rounded-2xl border border-[#2d3550] bg-[#0b0c14] p-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">Calm text version</p>
                <p className="text-sm leading-6 text-[#ecf0ff]">{plan.calmSms}</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[#2d3550] bg-[#0b0c14] p-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#d8c8ff]">Say this</p>
                <p className="text-sm leading-6 text-[#ecf0ff]">{plan.sayThis}</p>
              </div>
              <div className="rounded-2xl border border-[#4b2a4f] bg-[#140d18] p-4">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#ffb4d8]">Avoid saying this</p>
                <p className="text-sm leading-6 text-[#f4d8e6]">{plan.avoidThis}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#2d3550] bg-[#0b0c14] p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">Next best question</p>
              <p className="text-sm leading-6 text-[#ecf0ff]">{plan.nextBestQuestion}</p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-[#2d3550] bg-[#0d1220]">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <Sparkles className="h-4 w-4 text-[#7eeeff]" />
                  Sprocket Insight
                </CardTitle>
                <Badge className="rounded-full border border-[#7B2EFF]/40 bg-[#1a122d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9c9ff]">
                  Paid only
                </Badge>
              </div>
              <CardDescription className="text-[#97a1bc]">
                Rewrites the response, explains the emotion, flags risky phrasing, and suggests a better next question.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasSprocketAccess ? (
                <>
                  <Button className="h-11 w-full bg-[#7B2EFF] text-white hover:bg-[#9d19ff]" onClick={handleRunSprocket}>
                    Run Sprocket Insight
                  </Button>
                  {currentSprocket ? (
                    <div className="space-y-3 rounded-2xl border border-[#2e456d] bg-[#0a1321] p-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">What they may be feeling</p>
                        <p className="mt-1 text-sm leading-6 text-[#edf4ff]">{currentSprocket.emotionRead}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">Rewritten response</p>
                        <p className="mt-1 text-sm leading-6 text-[#edf4ff]">{currentSprocket.rewrittenResponse}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">Risky phrases</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {currentSprocket.riskyPhrases.map((phrase) => (
                            <Badge key={phrase} className="rounded-full border border-[#ff9db8]/35 bg-[#25121d] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffd0dc]">
                              {phrase}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">Better next question</p>
                        <p className="mt-1 text-sm leading-6 text-[#edf4ff]">{currentSprocket.nextBestQuestion}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-[#2d3550] bg-[#08101c] p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">Calmer SMS</p>
                          <p className="mt-2 text-sm leading-6 text-[#edf4ff]">{currentSprocket.calmSms}</p>
                        </div>
                        <div className="rounded-xl border border-[#2d3550] bg-[#08101c] p-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">Coaching note</p>
                          <p className="mt-2 text-sm leading-6 text-[#edf4ff]">{currentSprocket.coachingNote}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#2d4568] bg-[#09111e] p-4 text-sm text-[#9db1cf]">
                      Run Sprocket to see a cleaner rewrite and a calmer next question.
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#2d4568] bg-[#09111e] p-4">
                    <div className="space-y-2 opacity-35 blur-[7px] select-none">
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">What they may be feeling</p>
                      <p className="text-sm leading-6 text-[#edf4ff]">The customer wants control, clarity, and less pressure.</p>
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">Rewritten response</p>
                      <p className="text-sm leading-6 text-[#edf4ff]">I hear you. Let me keep this simple and calm.</p>
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

          <Card className="border-[#2d3550] bg-[#0d1220]">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg text-white">
                  <Sparkles className="h-4 w-4 text-[#9DEE75]" />
                  AutoDriveCX Coaching
                </CardTitle>
                <Badge className="rounded-full border border-[#2e8cff]/40 bg-[#103055] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#bde1ff]">
                  CX aware
                </Badge>
              </div>
              <CardDescription className="text-[#97a1bc]">
                Connects the response to your CX traits around tone, pacing, trust, empathy, objection handling, and follow-up.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasAutoDriveCxAccess ? (
                <>
                  <Button className="h-11 w-full bg-[#00c8ff] text-[#041820] hover:bg-[#55dbff]" onClick={handleRunAutoDriveCx}>
                    Run AutoDriveCX Coaching
                  </Button>
                  {currentCx ? (
                    <div className="space-y-3 rounded-2xl border border-[#23466d] bg-[#08111d] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full border border-[#9DEE75]/35 bg-[#112211] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#c6f5a6]">
                          Focus skill: {currentCx.focusSkill}
                        </Badge>
                        <Badge className="rounded-full border border-[#7eeeff]/35 bg-[#112332] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#c8f6ff]">
                          {currentCx.hasProfile ? 'Personalized' : 'General coaching'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">CX note</p>
                        <p className="mt-1 text-sm leading-6 text-[#edf4ff]">{currentCx.personalNote}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {currentCx.coachingNotes.map((note) => (
                          <div key={note.label} className="rounded-xl border border-[#2d3550] bg-[#0a1321] p-3">
                            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">{note.label}</p>
                            <p className="mt-2 text-sm leading-6 text-[#edf4ff]">{note.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-[#2d4568] bg-[#09111e] p-4 text-sm text-[#9db1cf]">
                      Run AutoDriveCX Coaching to see personalized guidance for your current CX traits.
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#23466d] bg-[#08111d] p-4">
                    <div className="space-y-2 opacity-35 blur-[7px] select-none">
                      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#7eeeff]">CX note</p>
                      <p className="text-sm leading-6 text-[#edf4ff]">Your coaching gets sharper when tone, pacing, and trust signals are personalized.</p>
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

        <Card className="border-[#2c2b42] bg-[#0d0b14]">
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="rounded-full border border-[#7B2EFF]/45 bg-[#1b122f] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#dbcfff]">
                Actions
              </Badge>
              <span className="text-xs text-[#8d95af]">
                Copy, save, favorite, regenerate, or reset the current response.
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <Button className={actionButtonClass()} onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button className={actionButtonClass()} onClick={saveCurrentLocalEntry}>
              <Save className="mr-2 h-4 w-4" />
              Save Local
            </Button>
            {hasPaidAccess ? (
              <Button
                className={actionButtonClass()}
                onClick={() => void saveCurrentCloudEntry()}
                disabled={isCloudSaving}
              >
                <Cloud className="mr-2 h-4 w-4" />
                {isCloudSaving ? 'Syncing...' : 'Sync Cloud'}
              </Button>
            ) : (
              <Button
                className={actionButtonClass()}
                onClick={() => openUpgrade('paid', 'Unlock cloud sync to keep Pressure Diffuser coaching in your account.')}
              >
                <Cloud className="mr-2 h-4 w-4" />
                Unlock Sync
              </Button>
            )}
            <Button
              className={actionButtonClass(draftFavorite)}
              onClick={() => setDraftFavorite((value) => !value)}
            >
              <Star className={cn('mr-2 h-4 w-4', draftFavorite && 'fill-current')} />
              {draftFavorite ? 'Favorited' : 'Favorite'}
            </Button>
            <Button className={actionButtonClass()} onClick={handleRegenerate}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </Button>
            <Button className={actionButtonClass()} onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-[#2c2b42] bg-[#0d0b14]">
            <CardHeader>
              <CardTitle className="text-lg text-white">Local coaching history</CardTitle>
              <CardDescription className="text-[#98a0bb]">
                Saved on this device. Free users keep full local access.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {savedEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#2b3450] bg-[#0a0a12] p-4 text-sm text-[#8f96ae]">
                  No local saves yet. Use Save Local after you like a response.
                </div>
              ) : (
                savedEntries.slice(0, 6).map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-[#263250] bg-[#0a0a12] p-4"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#f6f4ff]">
                          {entry.scenario} · {entry.customerEmotion} · {entry.desiredOutcome}
                        </p>
                        <p className="text-xs text-[#8f96ae]">
                          {new Date(entry.createdAt).toLocaleDateString()} · Variation {entry.variantSeed + 1}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                          'h-8 px-2 text-xs font-semibold',
                          entry.favorite ? 'text-[#9DEE75] hover:bg-[#132115]' : 'text-[#b7bfd8] hover:bg-[#131722]',
                        )}
                        onClick={() => toggleFavorite(entry.signature)}
                      >
                        <Star className={cn('mr-1 h-4 w-4', entry.favorite && 'fill-current')} />
                        {entry.favorite ? 'Favorited' : 'Favorite'}
                      </Button>
                    </div>
                    <p className="text-sm leading-6 text-[#dbe1f5]">{entry.sayThis}</p>
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
                        className="h-8 px-2 text-xs font-semibold text-[#c2d3ee] hover:bg-[#131722]"
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

          <Card className="border-[#2c2b42] bg-[#0d0b14]">
            <CardHeader>
              <CardTitle className="text-lg text-white">Synced coaching history</CardTitle>
              <CardDescription className="text-[#98a0bb]">
                Paid users can store and sync coaching history across devices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!hasPaidAccess ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-[#2d4568] bg-[#09111e] p-4">
                    <div className="space-y-2 opacity-40 blur-[7px] select-none">
                      <p className="text-sm font-semibold text-white">Cloud-synced history unlocks here.</p>
                      <p className="text-sm leading-6 text-[#d8e5ff]">Keep your strongest coaching moves and richer CX notes in your account.</p>
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
                <div className="rounded-2xl border border-[#2d4568] bg-[#09111e] p-4 text-sm text-[#9db1cf]">
                  Loading synced history...
                </div>
              ) : !firebaseUser ? (
                <div className="rounded-2xl border border-[#2d4568] bg-[#09111e] p-4 text-sm text-[#9db1cf]">
                  Sign in to see synced coaching history.
                </div>
              ) : cloudEntries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#2b3450] bg-[#0a0a12] p-4 text-sm text-[#8f96ae]">
                  No synced coaching yet. Save a Pressure Diffuser entry to your account.
                </div>
              ) : (
                cloudEntries.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-[#263250] bg-[#0a0a12] p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#f6f4ff]">Synced entry</p>
                      <span className="text-xs text-[#8f96ae]">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-[#dbe1f5]">
                      {parseSavedEntryPreview(entry).map((line) => (
                        <p key={line} className="leading-6">{line}</p>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>

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

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Copy, RefreshCcw, Save, Sparkles, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useEntitlements } from '@/hooks/use-entitlements';
import { useToast } from '@/hooks/use-toast';
import { resolvePaidAccess, FEATURES } from '@/lib/tools/entitlements';
import { saveToolboxEntry } from '@/lib/tools/toolbox-client';
import { getTempDraft, writeTempDraft } from '@/lib/tools/toolbox-storage';
import {
  buildWhatHappensNextPlan,
  COMMON_VAGUE_PHRASES,
  SCENARIO_STARTER_PRESETS,
  WHAT_HAPPENS_NEXT_MODES,
  WHAT_HAPPENS_NEXT_TONES,
  getWhatHappensNextCxInsight,
  getWhatHappensNextSprocketInsight,
  type WhatHappensNextInput,
  type WhatHappensNextMode,
  type WhatHappensNextPreset,
  type WhatHappensNextSavedScript,
  type WhatHappensNextTone,
} from '@/lib/tools/what-happens-next';

const TOOL_ID = 'what-happens-next';
const LOCAL_SCRIPTS_KEY = 'whatHappensNextSavedScriptsV1';

function normalizeText(value: string): string {
  return value.trim();
}

function readLocalScripts(): WhatHappensNextSavedScript[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_SCRIPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WhatHappensNextSavedScript[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalScripts(scripts: WhatHappensNextSavedScript[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SCRIPTS_KEY, JSON.stringify(scripts));
}

function buildCloudContent(input: WhatHappensNextInput, mode: WhatHappensNextMode, script: string): string {
  return [
    'WHAT HAPPENS NEXT',
    '',
    `Current Stage: ${input.currentStage || 'Not provided'}`,
    `Next Step: ${input.nextStep || 'Not provided'}`,
    `Estimated Time: ${input.estimatedTime || 'Not provided'}`,
    `Reason For Step: ${input.reasonForStep || 'Not provided'}`,
    `Reassurance Tone: ${input.reassuranceTone}`,
    `Delay / Complication: ${input.delayOrComplication || 'Not provided'}`,
    `Customer Concern: ${input.customerConcern || 'Not provided'}`,
    `Mode: ${mode}`,
    '',
    script,
  ].join('\n');
}

function signatureFor(input: WhatHappensNextInput, mode: WhatHappensNextMode): string {
  return [
    mode,
    input.currentStage,
    input.nextStep,
    input.estimatedTime,
    input.reasonForStep,
    input.reassuranceTone,
    input.delayOrComplication,
    input.customerConcern,
  ].map((part) => normalizeText(String(part || '')).toLowerCase()).join('::');
}

function applyPreset(preset: WhatHappensNextPreset): WhatHappensNextInput {
  return {
    currentStage: preset.currentStage,
    nextStep: preset.nextStep,
    estimatedTime: preset.estimatedTime,
    reasonForStep: preset.reasonForStep,
    reassuranceTone: preset.reassuranceTone,
    delayOrComplication: preset.delayOrComplication,
    customerConcern: preset.customerConcern,
  };
}

export default function WhatHappensNextPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [currentStage, setCurrentStage] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [reasonForStep, setReasonForStep] = useState('');
  const [reassuranceTone, setReassuranceTone] = useState<WhatHappensNextTone>('Calm');
  const [delayOrComplication, setDelayOrComplication] = useState('');
  const [customerConcern, setCustomerConcern] = useState('');
  const [selectedMode, setSelectedMode] = useState<WhatHappensNextMode>('Warmer');

  const [savedScripts, setSavedScripts] = useState<WhatHappensNextSavedScript[]>([]);
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [variantSeed, setVariantSeed] = useState(0);

  const { entitlements } = useEntitlements({
    isAuthenticated: !!firebaseUser,
    hasPaidAccess: resolvePaidAccess({
      tier: user?.tier,
      subscriptionStatus: user?.subscriptionStatus,
    }),
    hasAutoDriveCX: Boolean(user?.hasAutoDriveCX),
  });

  const hasSprocketAccess = entitlements.features[FEATURES.SPROCKET];
  const hasAutoDriveCxAccess = entitlements.features[FEATURES.AUTODRIVE_CX];
  const canSyncToCloud = entitlements.hasPaidAccess && Boolean(firebaseUser);

  const currentInput = useMemo<WhatHappensNextInput>(() => ({
    currentStage,
    nextStep,
    estimatedTime,
    reasonForStep,
    reassuranceTone,
    delayOrComplication,
    customerConcern,
  }), [currentStage, nextStep, estimatedTime, reasonForStep, reassuranceTone, delayOrComplication, customerConcern]);

  const currentSignature = useMemo(() => signatureFor(currentInput, selectedMode), [currentInput, selectedMode]);

  const plan = useMemo(() => buildWhatHappensNextPlan(currentInput, selectedMode, variantSeed), [currentInput, selectedMode, variantSeed]);
  const sprocketInsight = useMemo(() => (
    hasSprocketAccess ? getWhatHappensNextSprocketInsight(currentInput, plan) : null
  ), [currentInput, hasSprocketAccess, plan]);
  const cxInsight = useMemo(() => (
    hasAutoDriveCxAccess ? getWhatHappensNextCxInsight(currentInput, plan, user) : null
  ), [currentInput, hasAutoDriveCxAccess, plan, user]);

  const favoriteCount = useMemo(
    () => savedScripts.filter((script) => script.favorite).length,
    [savedScripts]
  );

  useEffect(() => {
    setSavedScripts(readLocalScripts());
    const draftRaw = getTempDraft(TOOL_ID);
    if (!draftRaw) return;

    try {
      const draft = JSON.parse(draftRaw) as Partial<WhatHappensNextInput & { selectedMode?: WhatHappensNextMode }>;
      if (draft.currentStage) setCurrentStage(draft.currentStage);
      if (draft.nextStep) setNextStep(draft.nextStep);
      if (draft.estimatedTime) setEstimatedTime(draft.estimatedTime);
      if (draft.reasonForStep) setReasonForStep(draft.reasonForStep);
      if (draft.reassuranceTone && WHAT_HAPPENS_NEXT_TONES.includes(draft.reassuranceTone)) setReassuranceTone(draft.reassuranceTone);
      if (draft.delayOrComplication) setDelayOrComplication(draft.delayOrComplication);
      if (draft.customerConcern) setCustomerConcern(draft.customerConcern);
      if (draft.selectedMode && WHAT_HAPPENS_NEXT_MODES.includes(draft.selectedMode)) setSelectedMode(draft.selectedMode);
    } catch {
      // Ignore malformed drafts and start clean.
    }
  }, []);

  useEffect(() => {
    writeTempDraft(TOOL_ID, JSON.stringify({ ...currentInput, selectedMode }));
  }, [currentInput, selectedMode]);

  const handlePresetSelect = useCallback((preset: WhatHappensNextPreset) => {
    const next = applyPreset(preset);
    setCurrentStage(next.currentStage);
    setNextStep(next.nextStep);
    setEstimatedTime(next.estimatedTime);
    setReasonForStep(next.reasonForStep);
    setReassuranceTone(next.reassuranceTone);
    setDelayOrComplication(next.delayOrComplication);
    setCustomerConcern(next.customerConcern);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(plan.script);
      toast({ title: 'Copied', description: 'Script copied and ready to use.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed', description: 'Try again in a moment.' });
    }
  }, [plan.script, toast]);

  const persistSavedScript = useCallback(async (favorite: boolean) => {
    const script: WhatHappensNextSavedScript = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      signature: currentSignature,
      currentStage: currentInput.currentStage,
      nextStep: currentInput.nextStep,
      estimatedTime: currentInput.estimatedTime,
      reasonForStep: currentInput.reasonForStep,
      reassuranceTone: currentInput.reassuranceTone,
      delayOrComplication: currentInput.delayOrComplication,
      customerConcern: currentInput.customerConcern,
      mode: selectedMode,
      script: plan.script,
      nextHappensLine: plan.nextHappensLine,
      timingLine: plan.timingLine,
      reassuranceLine: plan.reassuranceLine,
      favorite,
    };

    const next = [
      script,
      ...savedScripts.filter((item) => item.signature !== currentSignature),
    ].slice(0, 40);
    setSavedScripts(next);
    writeLocalScripts(next);

    if (!canSyncToCloud) {
      toast({ title: favorite ? 'Saved and favorited' : 'Saved locally', description: 'Stored on this device.' });
      return;
    }

    setIsCloudSaving(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const result = await saveToolboxEntry({
        idToken,
        toolId: TOOL_ID,
        content: buildCloudContent(currentInput, selectedMode, plan.script),
      });

      if (!result.ok) {
        toast({ variant: 'destructive', title: result.message });
        return;
      }

      toast({
        title: favorite ? 'Saved and synced' : 'Saved to cloud',
        description: favorite ? 'This script is favorited and synced across devices.' : 'This script now syncs across devices.',
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: error?.message || 'Could not sync this script.' });
    } finally {
      setIsCloudSaving(false);
    }
  }, [canSyncToCloud, currentInput, currentSignature, firebaseUser, plan.nextHappensLine, plan.reassuranceLine, plan.script, plan.timingLine, savedScripts, selectedMode, toast]);

  const handleSave = useCallback(() => {
    void persistSavedScript(savedScripts.some((item) => item.signature === currentSignature)
      ? savedScripts.find((item) => item.signature === currentSignature)?.favorite ?? false
      : false);
  }, [currentSignature, persistSavedScript, savedScripts]);

  const handleFavorite = useCallback(() => {
    const existing = savedScripts.find((item) => item.signature === currentSignature);
    void persistSavedScript(!existing?.favorite);
  }, [currentSignature, persistSavedScript, savedScripts]);

  const handleRegenerate = useCallback(() => {
    setVariantSeed((current) => current + 1);
  }, []);

  const handleReset = useCallback(() => {
    setCurrentStage('');
    setNextStep('');
    setEstimatedTime('');
    setReasonForStep('');
    setReassuranceTone('Calm');
    setDelayOrComplication('');
    setCustomerConcern('');
    setSelectedMode('Warmer');
    setVariantSeed(0);
    writeTempDraft(TOOL_ID, '');
    toast({ title: 'Reset', description: 'Fields cleared.' });
  }, [toast]);

  const savedOnDeviceLabel = `${savedScripts.length} saved on this device`;

  return (
    <div className="min-h-screen bg-[#09070f] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(175,117,255,0.16),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(91,54,255,0.14),_transparent_30%),linear-gradient(180deg,_#09070f_0%,_#0d1020_48%,_#09070f_100%)]" />

      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#09070f]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/tools" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#c79bff] transition hover:border-[#c79bff]/30 hover:bg-[#c79bff]/10">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#c79bff]">Tool Shop</div>
              <h1 className="font-black tracking-tight text-white text-lg sm:text-xl">What Happens Next... Then What Happens Next</h1>
            </div>
          </div>
          <Badge className="border border-[#c79bff]/25 bg-[#c79bff]/10 text-[#e6d6ff] hover:bg-[#c79bff]/15">Real-time</Badge>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 pb-16 pt-5 sm:px-6">
        <section className="rounded-3xl border border-white/8 bg-white/5 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#c79bff]/20 bg-[#c79bff]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#d8c0ff]">
              <Sparkles className="h-3.5 w-3.5" />
              Fast next-step script builder
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Explain the next dealership step clearly.</h2>
              <p className="max-w-2xl text-sm leading-6 text-[#b8bad3] sm:text-base">
                1. Tap a scenario or type your own situation. 2. Fill in the next step and timing. 3. Pick a mode, then copy the line you want to say.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-[#0d1020]/80 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c79bff]">Step 1</div>
            <p className="mt-2 text-sm leading-6 text-[#d7dbff]">Choose a scenario chip if you want a fast starting point.</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#0d1020]/80 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c79bff]">Step 2</div>
            <p className="mt-2 text-sm leading-6 text-[#d7dbff]">Enter the next step, a time estimate, and any delay or concern.</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-[#0d1020]/80 p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c79bff]">Step 3</div>
            <p className="mt-2 text-sm leading-6 text-[#d7dbff]">Pick a mode, then copy, save, favorite, or regenerate the script.</p>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#a9acd0]">Scenario quick-picks</h3>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c79bff]">One tap</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {SCENARIO_STARTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className="rounded-2xl border border-white/8 bg-[#0d1020]/90 px-4 py-4 text-left transition active:scale-[0.985] hover:border-[#c79bff]/25 hover:bg-[#11162a]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c79bff]">Scenario</div>
                    <div className="mt-1 text-sm font-semibold text-white">{preset.label}</div>
                  </div>
                  <div className="rounded-full border border-[#c79bff]/20 bg-[#c79bff]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d7c7ff]">
                    {preset.estimatedTime}
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-[#aeb3d6]">{preset.nextStep}</p>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-white/8 bg-[#0d1020]/80 p-4">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#a9acd0]">Common vague phrases</div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {COMMON_VAGUE_PHRASES.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className="shrink-0 rounded-full border border-white/8 bg-white/5 px-4 py-2 text-sm font-medium text-[#e4e7ff] transition hover:border-[#c79bff]/30 hover:bg-[#c79bff]/10"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-white/8 bg-[#0c0f1d]/90 text-white shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl font-black tracking-tight">Input fields</CardTitle>
              <CardDescription className="text-[#aeb3d6]">
                Fill only what you know. If something is missing, the tool will still build a clear script.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Current stage</label>
                <Input
                  value={currentStage}
                  onChange={(event) => setCurrentStage(event.target.value)}
                  placeholder="Trade appraisal, finance step, delivery prep..."
                  className="border-white/10 bg-[#11162a] text-white placeholder:text-[#7880a8]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Next step</label>
                <Input
                  value={nextStep}
                  onChange={(event) => setNextStep(event.target.value)}
                  placeholder="Take a quick look at your trade"
                  className="border-white/10 bg-[#11162a] text-white placeholder:text-[#7880a8]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Estimated time</label>
                <Input
                  value={estimatedTime}
                  onChange={(event) => setEstimatedTime(event.target.value)}
                  placeholder="10 to 15 minutes"
                  className="border-white/10 bg-[#11162a] text-white placeholder:text-[#7880a8]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Reassurance tone</label>
                <Select value={reassuranceTone} onValueChange={(value) => setReassuranceTone(value as WhatHappensNextTone)}>
                  <SelectTrigger className="border-white/10 bg-[#11162a] text-white">
                    <SelectValue placeholder="Pick a tone" />
                  </SelectTrigger>
                  <SelectContent className="border-white/10 bg-[#0d1020] text-white">
                    {WHAT_HAPPENS_NEXT_TONES.map((tone) => (
                      <SelectItem key={tone} value={tone}>{tone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Reason for the step</label>
                <Input
                  value={reasonForStep}
                  onChange={(event) => setReasonForStep(event.target.value)}
                  placeholder="So we can confirm the right value before moving forward"
                  className="border-white/10 bg-[#11162a] text-white placeholder:text-[#7880a8]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Delay or complication</label>
                <Input
                  value={delayOrComplication}
                  onChange={(event) => setDelayOrComplication(event.target.value)}
                  placeholder="Waiting on parts, manager approval..."
                  className="border-white/10 bg-[#11162a] text-white placeholder:text-[#7880a8]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Customer concern</label>
                <Input
                  value={customerConcern}
                  onChange={(event) => setCustomerConcern(event.target.value)}
                  placeholder="Needs speed, wants honesty..."
                  className="border-white/10 bg-[#11162a] text-white placeholder:text-[#7880a8]"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/8 bg-[#0c0f1d]/90 text-white shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl font-black tracking-tight">Mode toggles</CardTitle>
              <CardDescription className="text-[#aeb3d6]">
                Tap one mode to change how the same answer is phrased.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                {WHAT_HAPPENS_NEXT_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSelectedMode(mode)}
                    className={`rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition ${
                      selectedMode === mode
                        ? 'border-[#c79bff]/40 bg-[#c79bff]/15 text-white shadow-[0_0_0_1px_rgba(199,155,255,0.14)]'
                        : 'border-white/8 bg-white/5 text-[#b7bddb] hover:border-[#c79bff]/20 hover:bg-[#11162a]'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="rounded-2xl border border-white/8 bg-[#11162a] p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Why this mode</div>
                <p className="text-sm leading-6 text-[#d7dbff]">{plan.modeHint}</p>
              </div>

              <div className="rounded-2xl border border-white/8 bg-[#11162a] p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Quick read</div>
                  <Badge className="border border-[#c79bff]/20 bg-[#c79bff]/10 text-[#e6d6ff]">{selectedMode}</Badge>
                </div>
                <div className="space-y-2 text-sm leading-6 text-[#d9dcf3]">
                  <p><span className="font-semibold text-[#c79bff]">Next step:</span> {plan.nextHappensLine}</p>
                  <p><span className="font-semibold text-[#c79bff]">Timing:</span> {plan.timingLine}</p>
                  <p><span className="font-semibold text-[#c79bff]">Reassurance:</span> {plan.reassuranceLine}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <Card className="border border-[#c79bff]/20 bg-gradient-to-br from-[#171026] via-[#11162a] to-[#0c0f1d] text-white shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-[#c79bff]/20 bg-[#c79bff]/10 text-[#e6d6ff]">Generated script</Badge>
                <Badge className="border border-white/10 bg-white/5 text-[#d7dbff]">{plan.mode}</Badge>
              </div>
              <CardTitle className="text-xl font-black tracking-tight">Say this out loud</CardTitle>
              <CardDescription className="text-[#b6bbdd]">
                The script always includes the next step, the timing, and the reassurance line.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-[#090b14] p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#c79bff]">Full script</p>
                <p className="mt-3 text-lg leading-8 text-white sm:text-xl">{plan.script}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">What happens next</div>
                  <p className="mt-2 text-sm leading-6 text-[#edf0ff]">{plan.nextHappensLine}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">How long</div>
                  <p className="mt-2 text-sm leading-6 text-[#edf0ff]">{plan.timingLine}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Reassurance</div>
                  <p className="mt-2 text-sm leading-6 text-[#edf0ff]">{plan.reassuranceLine}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#11162a] p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Why this works</div>
                <p className="text-sm leading-6 text-[#d7dbff]">{plan.whyItWorks}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-5">
            {sprocketInsight && (
              <Card className="border border-[#c79bff]/20 bg-[#0c0f1d]/90 text-white shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
                <CardHeader className="space-y-2">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#c79bff]/20 bg-[#c79bff]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#e6d6ff]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Sprocket Insight
                  </div>
                  <CardTitle className="text-lg font-black tracking-tight">3-part coaching</CardTitle>
                  <CardDescription className="text-[#aeb3d6]">
                    Cleaner step, why it matters, and a ready-to-say version.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c79bff]">Cleaner step</div>
                    <p className="mt-2 text-sm leading-6 text-[#edf0ff]">{sprocketInsight.cleanerStep}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c79bff]">Why this matters</div>
                    <p className="mt-2 text-sm leading-6 text-[#d3d8f6]">{sprocketInsight.whyThisMatters}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c79bff]">Say this instead</div>
                    <p className="mt-2 text-sm leading-6 text-[#d3d8f6]">{sprocketInsight.sayThisInstead}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sprocketInsight.clarityFocus.map((item) => (
                      <Badge key={item} className="border border-white/10 bg-white/5 text-[#e9ebff]">{item}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {cxInsight && (
              <Card className="border border-white/10 bg-gradient-to-br from-[#12172c] to-[#0c0f1d] text-white shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
                <CardHeader className="space-y-2">
                  <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#d7dbff]">
                    AutoDriveCX
                  </div>
                  <CardTitle className="text-lg font-black tracking-tight">CX-based guidance</CardTitle>
                  <CardDescription className="text-[#aeb3d6]">
                    The tone recommendation adjusts to your current CX profile.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Recommended tone</div>
                    <p className="mt-2 text-sm font-semibold text-white">{cxInsight.recommendedTone}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Recommended mode</div>
                    <p className="mt-2 text-sm font-semibold text-white">{cxInsight.recommendedMode}</p>
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a9acd0]">Why</div>
                    <p className="mt-2 text-sm leading-6 text-[#d7dbff]">{cxInsight.rationale}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cxInsight.focus.map((item) => (
                      <Badge key={item} className="border border-white/10 bg-white/5 text-[#e9ebff]">{item}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {!sprocketInsight && !cxInsight && (
              <Card className="border border-white/8 bg-[#0c0f1d]/90 text-white shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
                <CardHeader>
                  <CardTitle className="text-lg font-black tracking-tight">Optional guidance</CardTitle>
                  <CardDescription className="text-[#aeb3d6]">
                    Paid Sprocket and AutoDriveCX guidance appears here when available.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </section>

        <section className="grid gap-3 rounded-3xl border border-white/8 bg-white/5 p-3 sm:grid-cols-2 xl:grid-cols-5">
          <Button type="button" onClick={handleCopy} variant="secondary" className="h-12 justify-center gap-2 bg-white text-black hover:bg-[#efe6ff]">
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          <Button type="button" onClick={handleSave} className="h-12 justify-center gap-2 bg-[#c79bff] text-[#140b1f] hover:bg-[#d7b8ff]">
            <Save className="h-4 w-4" />
            {isCloudSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button type="button" onClick={handleFavorite} variant="outline" className="h-12 justify-center gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10">
            <Star className="h-4 w-4" />
            Favorite
          </Button>
          <Button type="button" onClick={handleRegenerate} variant="outline" className="h-12 justify-center gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10">
            <RefreshCcw className="h-4 w-4" />
            Regenerate
          </Button>
          <Button type="button" onClick={handleReset} variant="outline" className="h-12 justify-center gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10">
            Reset
          </Button>
        </section>

        <section className="rounded-3xl border border-white/8 bg-[#0c0f1d]/90 p-5 text-white shadow-[0_20px_60px_rgba(0,0,0,0.32)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#a9acd0]">Saved scripts</div>
              <h3 className="mt-1 text-lg font-black tracking-tight">{savedOnDeviceLabel}</h3>
            </div>
            <Badge className="border border-[#c79bff]/20 bg-[#c79bff]/10 text-[#e6d6ff]">{favoriteCount} favorited</Badge>
          </div>

          {savedScripts.length === 0 ? (
            <p className="mt-4 text-sm text-[#aeb3d6]">No saved scripts yet. Save one to keep a local copy on this device.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {savedScripts.slice(0, 6).map((script) => (
                <div key={script.id} className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border border-white/10 bg-white/5 text-[#e9ebff]">{script.mode}</Badge>
                        {script.favorite && (
                          <Badge className="border border-[#c79bff]/20 bg-[#c79bff]/10 text-[#e6d6ff]">Favorite</Badge>
                        )}
                      </div>
                      <p className="text-sm leading-6 text-white">{script.script}</p>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-[#a9acd0]">{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(script.createdAt))}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 border-white/10 bg-white/5 text-white hover:bg-white/10"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(script.script);
                            toast({ title: 'Copied', description: 'Saved script copied.' });
                          } catch {
                            toast({ variant: 'destructive', title: 'Copy failed' });
                          }
                        }}
                      >
                        Copy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={`h-10 border-white/10 ${script.favorite ? 'bg-[#c79bff]/15 text-[#f0e2ff]' : 'bg-white/5 text-white'} hover:bg-white/10`}
                        onClick={() => {
                          const next = savedScripts.map((item) => (
                            item.id === script.id ? { ...item, favorite: !item.favorite } : item
                          ));
                          setSavedScripts(next);
                          writeLocalScripts(next);
                          toast({ title: script.favorite ? 'Removed favorite' : 'Marked favorite' });
                        }}
                      >
                        <Star className={`mr-2 h-4 w-4 ${script.favorite ? 'fill-current' : ''}`} />
                        {script.favorite ? 'Favorited' : 'Favorite'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex justify-center">
          <p className="max-w-2xl text-center text-xs leading-5 text-[#7f85ab]">
            Tip: if you only have a rough estimate, enter a range. The tool will keep the line clear and natural.
          </p>
        </div>
      </main>

    </div>
  );
}

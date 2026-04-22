'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Copy, RefreshCcw, Save, Sparkles, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useEntitlements } from '@/hooks/use-entitlements';
import { resolvePaidAccess, FEATURES } from '@/lib/tools/entitlements';
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
  type WhatHappensNextTone,
} from '@/lib/tools/what-happens-next';

const TOOL_ID = 'what-happens-next';

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
  const router = useRouter();
  const { user, firebaseUser } = useAuth();

  const [currentStage, setCurrentStage] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [reasonForStep, setReasonForStep] = useState('');
  const [reassuranceTone, setReassuranceTone] = useState<WhatHappensNextTone>('Calm');
  const [delayOrComplication, setDelayOrComplication] = useState('');
  const [customerConcern, setCustomerConcern] = useState('');
  const [selectedMode, setSelectedMode] = useState<WhatHappensNextMode>('Warmer');
  const [selectedQuickPickId, setSelectedQuickPickId] = useState<string | null>(null);
  const [guideStage, setGuideStage] = useState<'idle' | 'inputs' | 'modes' | 'output'>('idle');

  const [variantSeed, setVariantSeed] = useState(0);
  const inputCardRef = useRef<HTMLDivElement | null>(null);
  const modeCardRef = useRef<HTMLDivElement | null>(null);
  const outputCardRef = useRef<HTMLDivElement | null>(null);

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
  const selectedIsScenarioPreset = SCENARIO_STARTER_PRESETS.some((preset) => preset.id === selectedQuickPickId);
  const selectedIsVaguePhrase = COMMON_VAGUE_PHRASES.some((preset) => preset.id === selectedQuickPickId);
  const showVaguePhraseCue = selectedIsScenarioPreset && !selectedIsVaguePhrase;
  const showInputGlow = guideStage === 'inputs' && selectedIsVaguePhrase;
  const showModeGlow = guideStage === 'modes';
  const showOutputGlow = guideStage === 'output';

  const currentInput = useMemo<WhatHappensNextInput>(() => ({
    currentStage,
    nextStep,
    estimatedTime,
    reasonForStep,
    reassuranceTone,
    delayOrComplication,
    customerConcern,
  }), [currentStage, nextStep, estimatedTime, reasonForStep, reassuranceTone, delayOrComplication, customerConcern]);

  const plan = useMemo(() => buildWhatHappensNextPlan(currentInput, selectedMode, variantSeed), [currentInput, selectedMode, variantSeed]);
  const sprocketInsight = useMemo(() => (
    hasSprocketAccess ? getWhatHappensNextSprocketInsight(currentInput, plan) : null
  ), [currentInput, hasSprocketAccess, plan]);
  const cxInsight = useMemo(() => (
    hasAutoDriveCxAccess ? getWhatHappensNextCxInsight(currentInput, plan, user) : null
  ), [currentInput, hasAutoDriveCxAccess, plan, user]);

  useEffect(() => {
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

  useEffect(() => {
    const target =
      guideStage === 'inputs'
        ? inputCardRef.current
        : guideStage === 'modes'
          ? modeCardRef.current
          : guideStage === 'output'
            ? outputCardRef.current
            : null;

    if (!target) return;

    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [guideStage]);

  const handlePresetSelect = useCallback((preset: WhatHappensNextPreset) => {
    const next = applyPreset(preset);
    const presetIsVaguePhrase = COMMON_VAGUE_PHRASES.some((item) => item.id === preset.id);
    setSelectedQuickPickId(preset.id);
    setGuideStage(presetIsVaguePhrase ? 'inputs' : 'idle');
    setCurrentStage(next.currentStage);
    setNextStep(next.nextStep);
    setEstimatedTime(next.estimatedTime);
    setReasonForStep(next.reasonForStep);
    setReassuranceTone(next.reassuranceTone);
    setDelayOrComplication(next.delayOrComplication);
    setCustomerConcern(next.customerConcern);
  }, []);

  const handleConfirmVaguePhrase = useCallback(() => {
    if (!selectedIsVaguePhrase) return;
    setGuideStage('modes');
  }, [selectedIsVaguePhrase]);

  const handleModeSelect = useCallback((mode: WhatHappensNextMode) => {
    setSelectedMode(mode);
  }, []);

  const handleConfirmMode = useCallback(() => {
    setGuideStage('output');
  }, []);

  const handleSignupAction = useCallback(() => {
    router.push('/signup');
  }, [router]);

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
    setSelectedQuickPickId(null);
    setGuideStage('idle');
    setVariantSeed(0);
    writeTempDraft(TOOL_ID, '');
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.04),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(255,255,255,0.025),_transparent_24%)]" />

      <header className="sticky top-0 z-40 border-b border-white/8 bg-black/85 backdrop-blur-xl">
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

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#a9acd0]">Scenario quick-picks</h3>
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c79bff]">One tap</span>
          </div>
          <div className="max-h-[340px] space-y-3 overflow-y-auto pr-1 no-scrollbar">
            {SCENARIO_STARTER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={`w-full rounded-2xl px-4 py-4 text-left transition active:scale-[0.985] ${
                  selectedQuickPickId === preset.id
                    ? 'border-[#9DEE75] bg-emerald-400/10 text-white shadow-[0_0_0_1px_rgba(74,222,128,0.22),0_0_24px_rgba(74,222,128,0.10)]'
                    : 'border border-white/8 bg-[#0d1020]/90 hover:border-[#c79bff]/25 hover:bg-[#11162a]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-[11px] font-bold uppercase tracking-[0.22em] ${selectedQuickPickId === preset.id ? 'text-emerald-300' : 'text-[#c79bff]'}`}>Scenario</div>
                    <div className="mt-1 text-sm font-semibold text-white">{preset.label}</div>
                  </div>
                  <div className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                    selectedQuickPickId === preset.id
                      ? 'border-[#9DEE75]/30 bg-emerald-400/10 text-emerald-100'
                      : 'border-[#c79bff]/20 bg-[#c79bff]/10 text-[#d7c7ff]'
                  }`}>
                    {preset.estimatedTime}
                  </div>
                </div>
                <p className={`mt-3 text-sm leading-6 ${selectedQuickPickId === preset.id ? 'text-emerald-50' : 'text-[#aeb3d6]'}`}>{preset.nextStep}</p>
              </button>
            ))}
          </div>

          <div
            className={`rounded-2xl p-4 shadow-[0_0_0_1px_rgba(199,155,255,0.06)] ${
              showVaguePhraseCue
                ? 'border border-[#9DEE75]/25 bg-gradient-to-b from-[#141a10] to-[#0d1020]/85'
                : 'border border-[#c79bff]/24 bg-gradient-to-b from-[#171029] to-[#0d1020]/85'
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] ${showVaguePhraseCue ? 'text-[#dfffc3]' : 'text-[#d7c7ff]'}`}>
                <span className={`h-2 w-2 rounded-full ${showVaguePhraseCue ? 'bg-[#9DEE75] shadow-[0_0_0_4px_rgba(157,238,117,0.14)]' : 'bg-[#c79bff] shadow-[0_0_0_4px_rgba(199,155,255,0.12)]'}`} />
                Common vague phrases
              </div>
              {showVaguePhraseCue ? (
                <div className="rounded-full border border-[#9DEE75]/30 bg-[#9DEE75]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#eaffd6]">
                  Next up
                </div>
              ) : null}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {COMMON_VAGUE_PHRASES.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                  selectedQuickPickId === preset.id
                    ? 'border-[#9DEE75] bg-emerald-400/10 text-white shadow-[0_0_0_1px_rgba(74,222,128,0.2)]'
                    : showVaguePhraseCue
                      ? 'border-white/8 bg-white/5 text-[#e4e7ff] hover:border-[#9DEE75]/45 hover:bg-[#9DEE75]/10'
                      : 'border-white/8 bg-white/5 text-[#e4e7ff] hover:border-[#c79bff]/40 hover:bg-[#c79bff]/12'
                }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <Card ref={inputCardRef} className={`border-white/8 bg-[#0c0f1d]/90 text-white shadow-[0_20px_60px_rgba(0,0,0,0.32)] ${showInputGlow ? 'border-[#9DEE75]/35 shadow-[0_0_0_1px_rgba(157,238,117,0.18),0_0_32px_rgba(157,238,117,0.12),0_20px_60px_rgba(0,0,0,0.32)]' : ''}`}>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl font-black tracking-tight">Input fields</CardTitle>
                {showInputGlow ? (
                  <Badge className="border border-[#9DEE75]/30 bg-[#9DEE75]/10 text-[#eaffd6]">What&apos;s next</Badge>
                ) : null}
              </div>
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
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  type="button"
                  onClick={handleConfirmVaguePhrase}
                  disabled={!selectedIsVaguePhrase}
                  className="h-10 rounded-xl border border-[#9DEE75]/30 bg-[#9DEE75] px-4 text-sm font-bold text-[#041106] shadow-[0_0_0_1px_rgba(157,238,117,0.12),0_8px_18px_rgba(157,238,117,0.18)] transition hover:bg-[#ABF28A] disabled:opacity-50"
                >
                  Confirm
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card ref={modeCardRef} className={`border-white/8 bg-[#0c0f1d]/90 text-white shadow-[0_20px_60px_rgba(0,0,0,0.32)] ${showModeGlow ? 'border-[#9DEE75]/35 shadow-[0_0_0_1px_rgba(157,238,117,0.18),0_0_32px_rgba(157,238,117,0.12),0_20px_60px_rgba(0,0,0,0.32)]' : ''}`}>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-xl font-black tracking-tight">Mode toggles</CardTitle>
                {showModeGlow ? (
                  <Badge className="border border-[#9DEE75]/30 bg-[#9DEE75]/10 text-[#eaffd6]">What&apos;s next</Badge>
                ) : null}
              </div>
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
                    onClick={() => handleModeSelect(mode)}
                    className={`rounded-2xl border px-3 py-3 text-left text-sm font-semibold transition ${
                      selectedMode === mode
                        ? 'border-[#9DEE75]/35 bg-[#9DEE75]/10 text-white shadow-[0_0_0_1px_rgba(157,238,117,0.18),0_0_22px_rgba(157,238,117,0.1)]'
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

              <div className="rounded-2xl border border-[#c79bff]/16 bg-[#0c0f1d] p-4">
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#d7c7ff]">Why this works</div>
                <p className="text-sm leading-6 text-[#e0def8]">{plan.whyItWorks}</p>
              </div>

              <div className="mt-1 flex justify-end">
                  <Button
                    type="button"
                    onClick={handleConfirmMode}
                    className="h-10 rounded-xl border border-[#9DEE75]/30 bg-[#9DEE75] px-4 text-sm font-bold text-[#041106] shadow-[0_0_0_1px_rgba(157,238,117,0.12),0_8px_18px_rgba(157,238,117,0.18)] transition hover:bg-[#ABF28A]"
                  >
                    Confirm
                  </Button>
                </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
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
          </div>

          <div className="space-y-5">
            <Card ref={outputCardRef} className={`border-white/8 bg-[#0c0f1d]/90 text-white shadow-[0_20px_60px_rgba(0,0,0,0.32)] ${showOutputGlow ? 'border-[#9DEE75]/35 shadow-[0_0_0_1px_rgba(157,238,117,0.18),0_0_32px_rgba(157,238,117,0.12),0_20px_60px_rgba(0,0,0,0.32)]' : ''}`}>
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-[#c79bff]/20 bg-[#c79bff]/10 text-[#e6d6ff]">Generated script</Badge>
                  <Badge className="border border-white/10 bg-white/5 text-[#d7dbff]">{plan.mode}</Badge>
                  {showOutputGlow ? (
                    <Badge className="border border-[#9DEE75]/30 bg-[#9DEE75]/10 text-[#eaffd6]">What&apos;s next</Badge>
                  ) : null}
                </div>
                <CardTitle className="text-2xl font-black tracking-tight">Script, Read This Outloud</CardTitle>
                <CardDescription className="text-[#b6bbdd]">
                  The script stays short, direct, and ready to say.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-[#090b14] p-5">
                  <p className="mt-3 text-lg leading-8 text-white sm:text-xl">{plan.script}</p>
                </div>
              </CardContent>
            </Card>

            {!sprocketInsight && !cxInsight && (
              <Card className="border border-[#5ad7ff]/35 bg-[#09131f]/90 text-white shadow-[0_0_0_1px_rgba(90,215,255,0.14),0_0_28px_rgba(90,215,255,0.10),0_20px_60px_rgba(0,0,0,0.32)]">
                <CardHeader>
                  <CardTitle className="text-lg font-black tracking-tight">Sprocket Insight:</CardTitle>
                  <CardDescription className="text-[#aeb3d6]">
                    Unlock Sprocket and AutoDriveCX guidance to get clearer coaching in real time based on your personal CX traits.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Link
                    href="/signup"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-[#5ad7ff]/45 bg-[#5ad7ff]/10 px-4 text-sm font-bold text-[#dff9ff] shadow-[0_0_0_1px_rgba(90,215,255,0.12),0_8px_18px_rgba(90,215,255,0.12)] transition hover:border-[#7ae3ff]/60 hover:bg-[#5ad7ff]/15"
                  >
                    Sign up to unlock guidance
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section className="grid gap-3 rounded-3xl border border-white/8 bg-white/5 p-3 sm:grid-cols-2 xl:grid-cols-5">
          <Button type="button" onClick={handleSignupAction} variant="secondary" className="h-12 justify-center gap-2 border border-[#5ad7ff]/40 bg-white text-black shadow-[0_0_0_1px_rgba(90,215,255,0.14),0_8px_18px_rgba(90,215,255,0.08)] hover:border-[#7ae3ff]/60 hover:bg-[#efe6ff]">
            <Copy className="h-4 w-4" />
            Copy
          </Button>
          <Button type="button" onClick={handleSignupAction} className="h-12 justify-center gap-2 border border-[#5ad7ff]/40 bg-[#c79bff] text-[#140b1f] shadow-[0_0_0_1px_rgba(90,215,255,0.14),0_8px_18px_rgba(90,215,255,0.08)] hover:border-[#7ae3ff]/60 hover:bg-[#d7b8ff]">
            <Save className="h-4 w-4" />
            Save
          </Button>
          <Button type="button" onClick={handleSignupAction} variant="outline" className="h-12 justify-center gap-2 border border-[#5ad7ff]/40 bg-white/5 text-white shadow-[0_0_0_1px_rgba(90,215,255,0.14),0_8px_18px_rgba(90,215,255,0.08)] hover:border-[#7ae3ff]/60 hover:bg-white/10">
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

        <div className="flex justify-center">
          <p className="max-w-2xl text-center text-xs leading-5 text-[#7f85ab]">
            Tip: if you only have a rough estimate, enter a range. The tool will keep the line clear and natural.
          </p>
        </div>
      </main>

    </div>
  );
}

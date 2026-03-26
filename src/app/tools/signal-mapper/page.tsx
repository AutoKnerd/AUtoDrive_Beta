'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/header';
import { EmailGateModal } from '@/components/tools/email-gate-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useEntitlements } from '@/hooks/use-entitlements';
import { useToast } from '@/hooks/use-toast';
import {
  resolvePaidAccess,
  type ToolboxCapturedRole,
} from '@/lib/tools/entitlements';
import {
  captureToolboxUnlockEmail,
} from '@/lib/tools/toolbox-client';
import { clearFullToolHandoff, readFullToolHandoff } from '@/lib/tools/toolbox-storage';
import type { SignalMapperFullPrefill } from '@/lib/tools/signal-mapper-micro';
import {
  Copy,
  RotateCcw,
  Save,
} from 'lucide-react';

type Signal = {
  whatSaid: string;
  whyMatters: string;
  matchingFeature: string;
  howToBringUp: string;
};

type PipelineSnapshot = {
  id: string;
  createdAt: string;
  stage: string;
  customerName: string;
  currentVehicle: string;
  recommendationVehicle: string;
  nextStep: string;
  summary: string;
};

const PIPELINE_STORAGE_KEY = 'signalMapperPipelineV1';

const createEmptySignal = (): Signal => ({
  whatSaid: '',
  whyMatters: '',
  matchingFeature: '',
  howToBringUp: '',
});

const createInitialSignals = () => Array.from({ length: 7 }, createEmptySignal);

const initialCustomerInfo = {
  name: '',
  currentVehicle: '',
  household: '',
  drivingHabits: '',
  mustHaves: '',
  niceToHaves: '',
  concerns: '',
  emotionalTone: '',
  tradeNotes: '',
};

const initialDemoBuilder = {
  top3: '',
  problemSolved: '',
  lifestyleFit: '',
  avoidOverExplaining: '',
};

const initialTestDrive = {
  reaction: '',
  surprise: '',
  remainingConcern: '',
  nextQuestion: '',
};

const initialRecommendation = {
  vehicle: '',
  whyFits: '',
  confidenceStatement: '',
  nextStep: '',
};

const initialSelfCheck = {
  askedEnough: false,
  listened: false,
  usedWordsBack: false,
  personalized: false,
  stayedCalm: false,
  earnedRight: false,
};

const funnelStages = [
  {
    label: '1. Customer Snapshot',
    hint: 'Capture the baseline context',
  },
  {
    label: '2. Needs & Signals',
    hint: 'Map needs and exact wording',
  },
  {
    label: '3. Interpretation',
    hint: 'Define what it means',
  },
  {
    label: '4. Demo Plan',
    hint: 'Plan what to show and highlight',
  },
  {
    label: '5. Recommendation',
    hint: 'Set the next best step',
  },
];

const formatField = (label: string, value: string) => `${label}: ${value.trim() || 'N/A'}`;

export default function SignalMapperPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();

  const [customerInfo, setCustomerInfo] = useState(initialCustomerInfo);
  const [signals, setSignals] = useState<Signal[]>(createInitialSignals);
  const [demoBuilder, setDemoBuilder] = useState(initialDemoBuilder);
  const [testDrive, setTestDrive] = useState(initialTestDrive);
  const [recommendation, setRecommendation] = useState(initialRecommendation);
  const [selfCheck, setSelfCheck] = useState(initialSelfCheck);
  const [activeStage, setActiveStage] = useState(0);
  const [pipelineHistory, setPipelineHistory] = useState<PipelineSnapshot[]>([]);
  const [showEmailGate, setShowEmailGate] = useState(false);
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);

  const {
    entitlements,
    accountProfile,
    usedToolIds,
    setLocalAccountProfile,
    registerToolUsage,
  } = useEntitlements({
    isAuthenticated: !!firebaseUser,
    hasPaidAccess: resolvePaidAccess({
      tier: user?.tier,
      subscriptionStatus: user?.subscriptionStatus,
    }),
    hasAutoDriveCX: Boolean(user?.hasAutoDriveCX),
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PIPELINE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPipelineHistory(parsed as PipelineSnapshot[]);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Could not load saved pipeline',
        description: 'Your current session still works. Saved snapshots were skipped.',
      });
    }
  }, [toast]);

  useEffect(() => {
    const handoff = readFullToolHandoff<{ source?: string; prefill?: SignalMapperFullPrefill }>('signal-mapper');
    const prefill = handoff?.prefill;
    if (!prefill) return;

    setCustomerInfo((current) => ({
      ...current,
      name: current.name || prefill.customerName,
      currentVehicle: current.currentVehicle || prefill.currentVehicle,
      emotionalTone: current.emotionalTone || prefill.emotionalTone,
      concerns: current.concerns || prefill.realConcern || prefill.customerUnsaid,
      mustHaves: current.mustHaves || prefill.tryingToSolve,
      tradeNotes: current.tradeNotes || prefill.notes,
    }));

    setSignals((current) => {
      if (!Array.isArray(current) || current.length === 0) return current;
      const next = [...current];
      next[0] = {
        ...next[0],
        whatSaid: next[0].whatSaid || prefill.customerSaying,
        whyMatters: next[0].whyMatters || prefill.customerUnsaid,
      };
      return next;
    });

    setDemoBuilder((current) => ({
      ...current,
      top3: current.top3 || prefill.whatToShow,
    }));

    setRecommendation((current) => ({
      ...current,
      nextStep: current.nextStep || prefill.whatToSayNext,
    }));

    clearFullToolHandoff('signal-mapper');
  }, []);

  useEffect(() => {
    if (!entitlements.hasAccount && entitlements.usage.toolsUsedCount >= 3 && !usedToolIds.includes('signal-mapper')) {
      return;
    }
    registerToolUsage('signal-mapper');
  }, [entitlements.hasAccount, entitlements.usage.toolsUsedCount, registerToolUsage, usedToolIds]);

  const canOpenTool = entitlements.hasAccount || entitlements.usage.toolsUsedCount < 3 || usedToolIds.includes('signal-mapper');

  const mappedSignalCount = useMemo(
    () => signals.filter((s) => Object.values(s).some((v) => v.trim().length > 0)).length,
    [signals]
  );

  const completedChecklistCount = useMemo(
    () => Object.values(selfCheck).filter(Boolean).length,
    [selfCheck]
  );

  const completionPercent = useMemo(() => {
    let score = 0;
    if (customerInfo.name.trim()) score += 1;
    if (mappedSignalCount >= 5) score += 1;
    if (demoBuilder.top3.trim()) score += 1;
    if (testDrive.reaction.trim()) score += 1;
    if (recommendation.vehicle.trim() && recommendation.nextStep.trim()) score += 1;
    return Math.round((score / 5) * 100);
  }, [customerInfo.name, mappedSignalCount, demoBuilder.top3, testDrive.reaction, recommendation.vehicle, recommendation.nextStep]);

  const buildSummary = () => {
    const signalLines = signals
      .map((s, idx) => {
        if (!Object.values(s).some((v) => v.trim())) return null;
        return [
          `Signal ${idx + 1}`,
          `- ${formatField('What they said', s.whatSaid)}`,
          `- ${formatField('Why it matters', s.whyMatters)}`,
          `- ${formatField('Matching feature', s.matchingFeature)}`,
          `- ${formatField('How to bring it up', s.howToBringUp)}`,
        ].join('\n');
      })
      .filter(Boolean)
      .join('\n\n');

    return [
      'CUSTOMER SIGNAL FUNNEL SUMMARY',
      '',
      `Stage: ${funnelStages[activeStage].label}`,
      `Completion: ${completionPercent}%`,
      '',
      '[Customer Snapshot]',
      formatField('Customer', customerInfo.name),
      formatField('Current vehicle', customerInfo.currentVehicle),
      formatField('Emotional tone', customerInfo.emotionalTone),
      formatField('Household notes', customerInfo.household),
      formatField('Driving habits', customerInfo.drivingHabits),
      formatField('Must-haves', customerInfo.mustHaves),
      formatField('Nice-to-haves', customerInfo.niceToHaves),
      formatField('Concerns', customerInfo.concerns),
      formatField('Trade notes', customerInfo.tradeNotes),
      '',
      '[Key Signals]',
      signalLines || 'No signals captured yet.',
      '',
      '[Demo Plan]',
      formatField('Top 3 first', demoBuilder.top3),
      formatField('Problem solved', demoBuilder.problemSolved),
      formatField('Lifestyle fit', demoBuilder.lifestyleFit),
      formatField('Avoid over-explaining', demoBuilder.avoidOverExplaining),
      '',
      '[Test Drive Debrief]',
      formatField('Reaction', testDrive.reaction),
      formatField('Positive shift', testDrive.surprise),
      formatField('Remaining concern', testDrive.remainingConcern),
      formatField('Best next question', testDrive.nextQuestion),
      '',
      '[Recommendation]',
      formatField('Vehicle', recommendation.vehicle),
      formatField('Why it fits', recommendation.whyFits),
      formatField('Confidence statement', recommendation.confidenceStatement),
      formatField('Next step', recommendation.nextStep),
      '',
      '[Consultant Self-Check]',
      `Completed: ${completedChecklistCount}/6`,
      formatField('Asked enough questions', String(selfCheck.askedEnough)),
      formatField('Listened', String(selfCheck.listened)),
      formatField('Used their words back', String(selfCheck.usedWordsBack)),
      formatField('Personalized the demo', String(selfCheck.personalized)),
      formatField('Stayed calm', String(selfCheck.stayedCalm)),
      formatField('Earned right to present numbers', String(selfCheck.earnedRight)),
    ].join('\n');
  };

  const resetAll = () => {
    setCustomerInfo(initialCustomerInfo);
    setSignals(createInitialSignals());
    setDemoBuilder(initialDemoBuilder);
    setTestDrive(initialTestDrive);
    setRecommendation(initialRecommendation);
    setSelfCheck(initialSelfCheck);
    setActiveStage(0);
  };

  const handleClear = () => {
    resetAll();
    toast({ title: 'Cleared', description: 'Ready for the next customer.' });
  };

  const handleCopySummary = async () => {
    const summary = buildSummary();
    try {
      await navigator.clipboard.writeText(summary);
      toast({ title: 'Copied to clipboard', description: 'Funnel summary is ready to paste anywhere.' });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Clipboard blocked',
        description: 'Copy failed in this browser context. Save a snapshot instead.',
      });
    }
  };

  const handleSaveSnapshot = () => {
    const summary = buildSummary();
    const snapshot: PipelineSnapshot = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      stage: funnelStages[activeStage].label,
      customerName: customerInfo.name.trim() || 'Unnamed customer',
      currentVehicle: customerInfo.currentVehicle.trim(),
      recommendationVehicle: recommendation.vehicle.trim(),
      nextStep: recommendation.nextStep.trim(),
      summary,
    };

    const updated = [snapshot, ...pipelineHistory].slice(0, 20);
    setPipelineHistory(updated);
    localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify(updated));

    toast({
      title: 'Snapshot saved',
      description: 'Your in-app pipeline now tracks this customer without a CRM.',
    });
  };

  const handleCopySnapshot = async (summary: string) => {
    try {
      await navigator.clipboard.writeText(summary);
      toast({ title: 'Snapshot copied', description: 'Use it in email, notes, or text follow-up.' });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Clipboard is unavailable in this browser context.',
      });
    }
  };

  const handleCaptureAccount = async (input: { email: string; role: ToolboxCapturedRole }) => {
    const email = input.email.trim().toLowerCase();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValidEmail) {
      toast({
        variant: 'destructive',
        title: 'Enter a valid email',
      });
      return;
    }

    setIsEmailSubmitting(true);
    try {
      const captureResult = await captureToolboxUnlockEmail({ email, role: input.role });
      if (!captureResult.ok) {
        console.warn('[SignalMapper] account capture failed:', captureResult.message);
      }

      setLocalAccountProfile({ email, role: input.role });
      setShowEmailGate(false);
      toast({
        title: 'Account captured',
        description: 'Signal Mapper is unlocked in your free account mode.',
      });
      registerToolUsage('signal-mapper');
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  const updateSignal = (index: number, field: keyof Signal, value: string) => {
    const newSignals = [...signals];
    newSignals[index] = { ...newSignals[index], [field]: value };
    setSignals(newSignals);
  };

  const handleCustomerInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setCustomerInfo({ ...customerInfo, [e.target.name]: e.target.value });
  };

  const inputClass = 'bg-white/50 dark:bg-[#121111] border-slate-200 dark:border-white/10 dark:text-slate-100 focus-visible:ring-[#00f2ff]/50';

  if (!canOpenTool) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#0a0a0c] font-sans">
        <Header />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 gap-6 items-stretch">
            <Card className="rounded-2xl border-slate-200 dark:border-white/10 shadow-lg bg-gradient-to-br from-white via-[#ecfeff] to-slate-50 dark:from-[#0f1114] dark:via-[#0f1e22] dark:to-[#121111]">
              <CardHeader className="space-y-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#00c5d1]">Free Sales Tool</p>
                <CardTitle className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                  Signal Mapper is ready
                </CardTitle>
                <p className="text-base text-slate-700 dark:text-slate-300 max-w-2xl">
                  You can use up to 3 tools anonymously. Add email + role to continue opening more tools.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  'Standalone tool value stays unlocked.',
                  'No password required at this step.',
                  'Sprocket, cloud save, and history are still paid features.',
                ].map((line) => (
                  <div key={line} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#00c5d1]" />
                    <span>{line}</span>
                  </div>
                ))}
                <Button className="mt-3 w-full bg-[#00f2ff] text-[#121111] hover:bg-[#00f2ff]/90 font-bold" onClick={() => setShowEmailGate(true)}>
                  Create Free Account
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
        <EmailGateModal
          open={showEmailGate}
          loading={isEmailSubmitting}
          defaultEmail={accountProfile?.email || ''}
          defaultRole={accountProfile?.role || 'Sales Consultant'}
          onOpenChange={setShowEmailGate}
          onSubmit={handleCaptureAccount}
        />
      </div>
    );
  }

  const currentStep = funnelStages[activeStage];
  const progressPercent = Math.round(((activeStage + 1) / funnelStages.length) * 100);

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#0a0a0c] font-sans">
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-4 pb-28 md:px-6 md:py-8 md:pb-8">
        <Card className="rounded-2xl border-[#00f2ff]/25 bg-white dark:bg-[#101317]">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Signal Mapper</CardTitle>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {entitlements.hasAccount ? `Account mode (${accountProfile?.role || 'Sales Consultant'})` : 'Anonymous mode'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleClear}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Clear
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopySummary}>
                  <Copy className="mr-2 h-4 w-4" /> Copy Notes
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                <span>
                  Step {activeStage + 1} of {funnelStages.length}
                </span>
                <span>{currentStep.label}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                <div className="h-full bg-[#00f2ff] transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{currentStep.hint}</p>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {activeStage === 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-name">Customer Name</Label>
                  <Input id="customer-name" name="name" value={customerInfo.name} onChange={handleCustomerInfoChange} className={inputClass} placeholder="First and last name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-vehicle">Current Vehicle</Label>
                  <Input id="customer-vehicle" name="currentVehicle" value={customerInfo.currentVehicle} onChange={handleCustomerInfoChange} className={inputClass} placeholder="Year, make, model" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-emotion">Emotional Tone</Label>
                  <Input id="customer-emotion" name="emotionalTone" value={customerInfo.emotionalTone} onChange={handleCustomerInfoChange} className={inputClass} placeholder="Confident, unsure, stressed, excited..." />
                </div>
              </div>
            )}

            {activeStage === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customer-must-haves">Must-Haves</Label>
                  <Textarea id="customer-must-haves" name="mustHaves" value={customerInfo.mustHaves} onChange={handleCustomerInfoChange} className={inputClass} placeholder="What matters most to them?" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-concerns">Concerns / Hesitations</Label>
                  <Textarea id="customer-concerns" name="concerns" value={customerInfo.concerns} onChange={handleCustomerInfoChange} className={inputClass} placeholder="Budget, trust, timing, fit..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signal-0-said">What they said</Label>
                  <Textarea
                    id="signal-0-said"
                    value={signals[0]?.whatSaid || ''}
                    onChange={(e) => updateSignal(0, 'whatSaid', e.target.value)}
                    className={inputClass}
                    placeholder="Capture exact wording."
                  />
                </div>
              </div>
            )}

            {activeStage === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signal-0-why">What it actually means</Label>
                  <Textarea
                    id="signal-0-why"
                    value={signals[0]?.whyMatters || ''}
                    onChange={(e) => updateSignal(0, 'whyMatters', e.target.value)}
                    className={inputClass}
                    placeholder="What is beneath the words?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo-problem">What problem they are solving</Label>
                  <Textarea
                    id="demo-problem"
                    value={demoBuilder.problemSolved}
                    onChange={(e) => setDemoBuilder({ ...demoBuilder, problemSolved: e.target.value })}
                    className={inputClass}
                    placeholder="Define the practical outcome they want."
                  />
                </div>
              </div>
            )}

            {activeStage === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="demo-top3">What to show</Label>
                  <Textarea
                    id="demo-top3"
                    value={demoBuilder.top3}
                    onChange={(e) => setDemoBuilder({ ...demoBuilder, top3: e.target.value })}
                    className={inputClass}
                    placeholder={'1. ...\n2. ...\n3. ...'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo-highlight">What to highlight</Label>
                  <Textarea
                    id="demo-highlight"
                    value={demoBuilder.lifestyleFit}
                    onChange={(e) => setDemoBuilder({ ...demoBuilder, lifestyleFit: e.target.value })}
                    className={inputClass}
                    placeholder="Tie features to their daily reality."
                  />
                </div>
              </div>
            )}

            {activeStage === 4 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recommend-vehicle">Recommended vehicle</Label>
                  <Input
                    id="recommend-vehicle"
                    value={recommendation.vehicle}
                    onChange={(e) => setRecommendation({ ...recommendation, vehicle: e.target.value })}
                    className={inputClass}
                    placeholder="Year, make, model, trim"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recommend-next">Next best step</Label>
                  <Input
                    id="recommend-next"
                    value={recommendation.nextStep}
                    onChange={(e) => setRecommendation({ ...recommendation, nextStep: e.target.value })}
                    className={inputClass}
                    placeholder="Desk, appraisal, worksheet, commitment..."
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 dark:border-white/10 bg-white/70 dark:bg-[#121111]/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg">Pipeline Snapshots</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pipelineHistory.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No saved opportunities yet. Save your first snapshot to track follow-ups without a CRM.
              </p>
            ) : (
              pipelineHistory.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-3 space-y-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.customerName}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                  <p className="text-xs text-slate-700 dark:text-slate-300">Next: {item.nextStep || 'N/A'}</p>
                  <Button size="sm" variant="outline" className="w-full border-slate-300 dark:border-white/10" onClick={() => handleCopySnapshot(item.summary)}>
                    <Copy className="w-3.5 h-3.5 mr-2" /> Copy Snapshot
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-white/10 dark:bg-[#0f1217]/95">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <Button
            variant="outline"
            className="h-12 flex-1 border-slate-300 text-base dark:border-white/10"
            disabled={activeStage === 0}
            onClick={() => setActiveStage((prev) => Math.max(prev - 1, 0))}
          >
            Back
          </Button>

          {activeStage < funnelStages.length - 1 ? (
            <Button
              className="h-12 flex-1 bg-[#00f2ff] text-base font-bold text-[#121111] hover:bg-[#00f2ff]/90"
              onClick={() => setActiveStage((prev) => Math.min(prev + 1, funnelStages.length - 1))}
            >
              Next
            </Button>
          ) : (
            <Button className="h-12 flex-1 bg-[#00f2ff] text-base font-bold text-[#121111] hover:bg-[#00f2ff]/90" onClick={handleSaveSnapshot}>
              <Save className="mr-2 h-4 w-4" /> Save to Pipeline
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

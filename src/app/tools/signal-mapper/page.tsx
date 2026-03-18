'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Zap,
  User,
  CheckCircle2,
  MessageSquare,
  Car,
  Navigation,
  ClipboardCheck,
  Copy,
  RotateCcw,
  Save,
  Target,
  ArrowRight,
  Mail,
  Lock,
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
const EMAIL_GATE_STORAGE_KEY = 'signalMapperEmailUnlockV1';

type UnlockRecord = {
  email: string;
  unlockedAt: string;
};

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
    label: '1. Intake',
    hint: 'Capture customer context',
  },
  {
    label: '2. Signal Map',
    hint: 'Translate what they said',
  },
  {
    label: '3. Demo Plan',
    hint: 'Build a targeted walkthrough',
  },
  {
    label: '4. Test Drive',
    hint: 'Handle concerns and shifts',
  },
  {
    label: '5. Recommendation',
    hint: 'Land next step confidently',
  },
];

const formatField = (label: string, value: string) => `${label}: ${value.trim() || 'N/A'}`;

export default function SignalMapperPage() {
  const { toast } = useToast();

  const [customerInfo, setCustomerInfo] = useState(initialCustomerInfo);
  const [signals, setSignals] = useState<Signal[]>(createInitialSignals);
  const [demoBuilder, setDemoBuilder] = useState(initialDemoBuilder);
  const [testDrive, setTestDrive] = useState(initialTestDrive);
  const [recommendation, setRecommendation] = useState(initialRecommendation);
  const [selfCheck, setSelfCheck] = useState(initialSelfCheck);
  const [activeStage, setActiveStage] = useState(0);
  const [pipelineHistory, setPipelineHistory] = useState<PipelineSnapshot[]>([]);
  const [unlockEmail, setUnlockEmail] = useState('');
  const [unlockRecord, setUnlockRecord] = useState<UnlockRecord | null>(null);

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
    try {
      const raw = localStorage.getItem(EMAIL_GATE_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as UnlockRecord;
      if (parsed?.email) {
        setUnlockRecord(parsed);
        setUnlockEmail(parsed.email);
      }
    } catch {
      localStorage.removeItem(EMAIL_GATE_STORAGE_KEY);
    }
  }, []);

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

  const nextBestAction = useMemo(() => {
    if (!customerInfo.name.trim()) return 'Start with customer name and current vehicle.';
    if (mappedSignalCount < 5) return 'Capture at least 5 meaningful customer signals before demoing.';
    if (!demoBuilder.top3.trim()) return 'Define the top 3 demo moments before the walkaround.';
    if (!testDrive.reaction.trim()) return 'Log test drive reaction to uncover objections.';
    if (!recommendation.vehicle.trim() || !recommendation.nextStep.trim()) return 'Set recommendation and clear next step to move the deal.';
    return 'You are ready to present numbers and move to commitment.';
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

  const handleUnlock = async () => {
    const email = unlockEmail.trim().toLowerCase();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValidEmail) {
      toast({
        variant: 'destructive',
        title: 'Enter a valid email',
        description: 'Please provide a valid email to unlock this tool.',
      });
      return;
    }

    const record: UnlockRecord = {
      email,
      unlockedAt: new Date().toISOString(),
    };
    setUnlockRecord(record);
    localStorage.setItem(EMAIL_GATE_STORAGE_KEY, JSON.stringify(record));
    try {
      await fetch('/api/tools/signal-mapper-unlocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
    } catch (captureError) {
      console.error('[SignalMapper] Failed to capture unlock email:', captureError);
    }
    toast({
      title: 'Tool unlocked',
      description: 'You can now use the Customer Signal Funnel.',
    });
  };

  const handleChangeEmail = () => {
    localStorage.removeItem(EMAIL_GATE_STORAGE_KEY);
    setUnlockRecord(null);
    toast({
      title: 'Email reset',
      description: 'Enter another email to unlock the tool again.',
    });
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
  const sectionTitleClass = 'text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100 mb-6';

  if (!unlockRecord) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#0a0a0c] font-sans">
        <Header />
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_420px] gap-6 items-stretch">
            <Card className="rounded-2xl border-slate-200 dark:border-white/10 shadow-lg bg-gradient-to-br from-white via-[#ecfeff] to-slate-50 dark:from-[#0f1114] dark:via-[#0f1e22] dark:to-[#121111]">
              <CardHeader className="space-y-4">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#00c5d1]">Free Sales Tool</p>
                <CardTitle className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                  Turn customer conversations into deals in under 2 minutes
                </CardTitle>
                <p className="text-base text-slate-700 dark:text-slate-300 max-w-2xl">
                  Use the Customer Signal Funnel to capture needs, map objections, and generate a clean next-step summary without a CRM.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  'Get a guided 5-stage process from intake to recommendation.',
                  'Save local pipeline snapshots you can copy into text or email follow-up.',
                  'Know the next best action instantly with built-in funnel health scoring.',
                ].map((line) => (
                  <div key={line} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <CheckCircle2 className="h-4 w-4 text-[#00c5d1] mt-0.5 shrink-0" />
                    <span>{line}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-[#00f2ff]/30 shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="h-5 w-5 text-[#00c5d1]" /> Enter Email To Unlock Free Tool
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="unlock-email">Work Email</Label>
                  <div className="relative">
                    <Mail className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="unlock-email"
                      type="email"
                      value={unlockEmail}
                      onChange={(e) => setUnlockEmail(e.target.value)}
                      placeholder="you@dealership.com"
                      className="pl-9"
                    />
                  </div>
                </div>
                <Button className="w-full bg-[#00f2ff] text-[#121111] hover:bg-[#00f2ff]/90 font-bold" onClick={() => void handleUnlock()}>
                  Unlock Free Tool
                </Button>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Free access. No credit card. No CRM install required.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-[#0a0a0c] font-sans">
      <Header />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          <Card className="shadow-sm rounded-2xl border-[#00f2ff]/20">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                    Customer Signal Funnel
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg">
                    Guided process from discovery to next step, with a built-in pipeline snapshot so this works even without a CRM.
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Unlocked as {unlockRecord.email}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    className="border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                    onClick={handleClear}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" /> Clear
                  </Button>
                  <Button className="bg-[#00f2ff] text-[#121111] hover:bg-[#00f2ff]/90 font-bold" onClick={handleCopySummary}>
                    <Copy className="w-4 h-4 mr-2" /> Copy Full Notes
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                    onClick={handleChangeEmail}
                  >
                    Change Email
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg rounded-2xl bg-gradient-to-br from-[#00f2ff]/10 via-white to-slate-50 dark:from-[#00f2ff]/10 dark:to-[#121111] border-[#00f2ff]/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-extrabold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-[#00c5d1]" /> Funnel Health
                </span>
                <span className="text-[#00c5d1]">{completionPercent}%</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                <div className="h-full bg-[#00f2ff] transition-all" style={{ width: `${completionPercent}%` }} />
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300">{nextBestAction}</p>
              <Button className="w-full bg-[#121111] text-white hover:bg-black" onClick={handleSaveSnapshot}>
                <Save className="w-4 h-4 mr-2" /> Save Pipeline Snapshot
              </Button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Saved snapshots stay on this device so you can track active opportunities without external tools.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-l-4 border-l-[#00f2ff] bg-gradient-to-r from-[#00f2ff]/5 to-transparent dark:bg-[#00f2ff]/5 shadow-sm rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-[#00f2ff] flex items-center gap-2">
              <Zap className="h-4 w-4" /> Funnel Stages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              {funnelStages.map((stage, idx) => (
                <button
                  key={stage.label}
                  type="button"
                  onClick={() => setActiveStage(idx)}
                  className={`text-left border rounded-xl p-3 transition-colors ${
                    activeStage === idx
                      ? 'bg-[#00f2ff]/20 border-[#00c5d1] text-slate-900 dark:text-white'
                      : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-[#00f2ff]/40'
                  }`}
                >
                  <p className="text-xs font-extrabold tracking-wide">{stage.label}</p>
                  <p className="text-xs mt-1 opacity-80">{stage.hint}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <section>
          <h2 className={sectionTitleClass}>
            <User className="h-5 w-5 text-[#3488ba]" /> Stage 1: Customer Snapshot
          </h2>
          <Card className="shadow-sm dark:bg-[#121111]/80 dark:border-white/5 rounded-2xl overflow-hidden backdrop-blur-md">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="customer-name">Customer Name</Label>
                  <Input
                    id="customer-name"
                    name="name"
                    value={customerInfo.name}
                    onChange={handleCustomerInfoChange}
                    className={inputClass}
                    placeholder="First & Last Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-vehicle">Current Vehicle</Label>
                  <Input
                    id="customer-vehicle"
                    name="currentVehicle"
                    value={customerInfo.currentVehicle}
                    onChange={handleCustomerInfoChange}
                    className={inputClass}
                    placeholder="Year, Make, Model"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-emotion">Emotional Tone</Label>
                  <Input
                    id="customer-emotion"
                    name="emotionalTone"
                    value={customerInfo.emotionalTone}
                    onChange={handleCustomerInfoChange}
                    className={inputClass}
                    placeholder="e.g. Stressed, Excited, Guarded"
                  />
                </div>

                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="customer-household">Household / Family Notes</Label>
                  <Textarea
                    id="customer-household"
                    name="household"
                    value={customerInfo.household}
                    onChange={handleCustomerInfoChange}
                    className={inputClass}
                    placeholder="Who rides in the car? Pets? Kids?"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-driving">Driving Habits</Label>
                  <Textarea
                    id="customer-driving"
                    name="drivingHabits"
                    value={customerInfo.drivingHabits}
                    onChange={handleCustomerInfoChange}
                    className={inputClass}
                    placeholder="Commute length, road trips, mostly city?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-must-haves">Must-Haves</Label>
                  <Textarea
                    id="customer-must-haves"
                    name="mustHaves"
                    value={customerInfo.mustHaves}
                    onChange={handleCustomerInfoChange}
                    className={inputClass}
                    placeholder="Non-negotiables..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-nice-haves">Nice-to-Haves</Label>
                  <Textarea
                    id="customer-nice-haves"
                    name="niceToHaves"
                    value={customerInfo.niceToHaves}
                    onChange={handleCustomerInfoChange}
                    className={inputClass}
                    placeholder="Wants but doesn't need..."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="customer-concerns">Concerns / Hesitations</Label>
                  <Textarea
                    id="customer-concerns"
                    name="concerns"
                    value={customerInfo.concerns}
                    onChange={handleCustomerInfoChange}
                    className={inputClass}
                    placeholder="Budget, size, fuel economy?"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer-trade">Trade Notes</Label>
                  <Textarea
                    id="customer-trade"
                    name="tradeNotes"
                    value={customerInfo.tradeNotes}
                    onChange={handleCustomerInfoChange}
                    className={inputClass}
                    placeholder="Condition, payoff?"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className={sectionTitleClass} style={{ marginBottom: 0 }}>
              <MessageSquare className="h-5 w-5 text-[#00f2ff]" /> Stage 2: Key Customer Signals
            </h2>
            <span className="text-sm font-medium text-slate-500 bg-slate-200 dark:bg-white/10 px-3 py-1 rounded-full">
              {mappedSignalCount}/7 mapped (target 5+)
            </span>
          </div>

          <div className="space-y-4">
            {signals.map((signal, idx) => (
              <Card
                key={idx}
                className="relative shadow-sm dark:bg-[#121111]/80 dark:border-white/5 overflow-hidden transition-all focus-within:ring-1 focus-within:ring-[#00f2ff]/50"
              >
                <div className="absolute top-0 left-0 bottom-0 w-1 md:w-1.5 bg-gradient-to-b from-slate-200 to-slate-100 dark:from-white/10 dark:to-white/5 opacity-50" />
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x border-l border-transparent dark:divide-white/5">
                    <div className="flex-1 p-3 md:p-4 bg-slate-50 dark:bg-white/[0.02]">
                      <Label htmlFor={`signal-${idx}-said`} className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">
                        What they said
                      </Label>
                      <Input
                        id={`signal-${idx}-said`}
                        value={signal.whatSaid}
                        onChange={(e) => updateSignal(idx, 'whatSaid', e.target.value)}
                        className="border-0 bg-transparent shadow-none px-0 h-8 focus-visible:ring-0 rounded-none dark:text-slate-200"
                        placeholder="Their exact words..."
                      />
                    </div>
                    <div className="flex-1 p-3 md:p-4">
                      <Label htmlFor={`signal-${idx}-why`} className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">
                        Why it matters
                      </Label>
                      <Input
                        id={`signal-${idx}-why`}
                        value={signal.whyMatters}
                        onChange={(e) => updateSignal(idx, 'whyMatters', e.target.value)}
                        className="border-0 bg-transparent shadow-none px-0 h-8 focus-visible:ring-0 rounded-none dark:text-slate-200"
                        placeholder="Underlying need..."
                      />
                    </div>
                    <div className="flex-1 p-3 md:p-4">
                      <Label htmlFor={`signal-${idx}-feature`} className="text-[10px] uppercase tracking-wider text-slate-500 mb-1 block">
                        Matching feature
                      </Label>
                      <Input
                        id={`signal-${idx}-feature`}
                        value={signal.matchingFeature}
                        onChange={(e) => updateSignal(idx, 'matchingFeature', e.target.value)}
                        className="border-0 bg-transparent shadow-none px-0 h-8 focus-visible:ring-0 rounded-none dark:text-slate-200"
                        placeholder="Product solution..."
                      />
                    </div>
                    <div className="flex-1 p-3 md:p-4 bg-[#00f2ff]/5">
                      <Label
                        htmlFor={`signal-${idx}-bringup`}
                        className="text-[10px] uppercase tracking-wider text-[#00f2ff] font-bold mb-1 block"
                      >
                        How I will bring it up
                      </Label>
                      <Input
                        id={`signal-${idx}-bringup`}
                        value={signal.howToBringUp}
                        onChange={(e) => updateSignal(idx, 'howToBringUp', e.target.value)}
                        className="border-0 bg-transparent shadow-none px-0 h-8 focus-visible:ring-0 rounded-none dark:text-slate-200 placeholder:text-[#00f2ff]/40"
                        placeholder='"You mentioned earlier..."'
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <h2 className={sectionTitleClass}>
            <Car className="h-5 w-5 text-[#3488ba]" /> Stage 3: Demo Builder
          </h2>
          <Card className="shadow-sm dark:bg-[#121111]/80 dark:border-white/5 rounded-2xl">
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="demo-top3">Top 3 things to show first</Label>
                <Textarea
                  id="demo-top3"
                  value={demoBuilder.top3}
                  onChange={(e) => setDemoBuilder({ ...demoBuilder, top3: e.target.value })}
                  className={inputClass}
                  placeholder={'1. ...\n2. ...\n3. ...'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="demo-problem">What problem this vehicle solves</Label>
                <Textarea
                  id="demo-problem"
                  value={demoBuilder.problemSolved}
                  onChange={(e) => setDemoBuilder({ ...demoBuilder, problemSolved: e.target.value })}
                  className={inputClass}
                  placeholder="Saves gas, fits car seats, more reliable..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="demo-lifestyle">What lifestyle fit to highlight</Label>
                <Textarea
                  id="demo-lifestyle"
                  value={demoBuilder.lifestyleFit}
                  onChange={(e) => setDemoBuilder({ ...demoBuilder, lifestyleFit: e.target.value })}
                  className={inputClass}
                  placeholder="Matches their active weekend routine..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="demo-avoid" className="text-red-500 dark:text-red-400">
                  What to avoid over-explaining
                </Label>
                <Textarea
                  id="demo-avoid"
                  value={demoBuilder.avoidOverExplaining}
                  onChange={(e) => setDemoBuilder({ ...demoBuilder, avoidOverExplaining: e.target.value })}
                  className={inputClass.replace('focus-visible:ring-[#00f2ff]/50', 'focus-visible:ring-red-500/50')}
                  placeholder="Don't bury them in specs they never asked for"
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className={sectionTitleClass}>
            <Navigation className="h-5 w-5 text-[#00f2ff]" /> Stage 4: Test Drive Debrief
          </h2>

          <div className="bg-[#3488ba]/10 border border-[#3488ba]/30 rounded-xl p-5 mb-6 shadow-inner">
            <p className="font-bold text-[#3488ba] dark:text-[#3488ba] text-lg lg:text-xl text-center">
              "How did the test drive feel versus what you expected?"
            </p>
          </div>

          <Card className="shadow-sm dark:bg-[#121111]/80 dark:border-white/5 rounded-2xl">
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="drive-reaction">Customer reaction</Label>
                <Input
                  id="drive-reaction"
                  value={testDrive.reaction}
                  onChange={(e) => setTestDrive({ ...testDrive, reaction: e.target.value })}
                  className={inputClass}
                  placeholder="What was the first thing they said?"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drive-shift">Surprise / positive shift</Label>
                <Input
                  id="drive-shift"
                  value={testDrive.surprise}
                  onChange={(e) => setTestDrive({ ...testDrive, surprise: e.target.value })}
                  className={inputClass}
                  placeholder="They loved the quiet ride..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drive-concern">Remaining concern</Label>
                <Input
                  id="drive-concern"
                  value={testDrive.remainingConcern}
                  onChange={(e) => setTestDrive({ ...testDrive, remainingConcern: e.target.value })}
                  className={inputClass}
                  placeholder="Felt a little big to park..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="drive-next">Best next question</Label>
                <Input
                  id="drive-next"
                  value={testDrive.nextQuestion}
                  onChange={(e) => setTestDrive({ ...testDrive, nextQuestion: e.target.value })}
                  className={inputClass}
                  placeholder='"Is the size something you can get used to?"'
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className={sectionTitleClass}>
            <ClipboardCheck className="h-5 w-5 text-[#00f2ff]" /> Stage 5: Recommendation Summary
          </h2>
          <Card className="shadow-lg border-[#00f2ff]/20 dark:bg-[#121111]/90 rounded-2xl relative overflow-hidden">
            <div className="absolute right-0 top-0 h-full w-1 bg-[#00f2ff]" />
            <CardContent className="p-6 md:p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="recommend-vehicle" className="text-[#00f2ff]">
                    Recommended vehicle
                  </Label>
                  <Input
                    id="recommend-vehicle"
                    value={recommendation.vehicle}
                    onChange={(e) => setRecommendation({ ...recommendation, vehicle: e.target.value })}
                    className={inputClass}
                    placeholder="Year, Make, Model, Trim"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recommend-why">Why it fits this customer</Label>
                  <Input
                    id="recommend-why"
                    value={recommendation.whyFits}
                    onChange={(e) => setRecommendation({ ...recommendation, whyFits: e.target.value })}
                    className={inputClass}
                    placeholder="Solves their X need while keeping their Y want."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="recommend-confidence">Confidence statement I will use</Label>
                  <Textarea
                    id="recommend-confidence"
                    value={recommendation.confidenceStatement}
                    onChange={(e) => setRecommendation({ ...recommendation, confidenceStatement: e.target.value })}
                    className={inputClass}
                    placeholder='"Based on what you told me about your commute and family... this is the right fit for you."'
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="recommend-next">Next best step</Label>
                  <Input
                    id="recommend-next"
                    value={recommendation.nextStep}
                    onChange={(e) => setRecommendation({ ...recommendation, nextStep: e.target.value })}
                    className={inputClass}
                    placeholder="Sit at desk, run trade appraisal, secure commitment..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="pt-2">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
            <Card className="shadow-sm dark:bg-[#121111]/80 dark:border-white/5 rounded-2xl">
              <CardContent className="p-6 space-y-6">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Consultant Self-Check</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left bg-slate-100 dark:bg-white/5 p-6 rounded-3xl">
                  {[
                    { id: 'askedEnough', label: 'I asked enough questions' },
                    { id: 'listened', label: 'I listened without interrupting' },
                    { id: 'usedWordsBack', label: 'I used their words back to them' },
                    { id: 'personalized', label: 'I personalized the demo' },
                    { id: 'stayedCalm', label: 'I slowed down and stayed calm' },
                    { id: 'earnedRight', label: 'I earned the right to present numbers' },
                  ].map((check) => (
                    <div
                      key={check.id}
                      className="flex items-center space-x-3 bg-white dark:bg-[#121111] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-white/5 transition-colors hover:border-[#00f2ff]/30"
                    >
                      <Checkbox
                        id={check.id}
                        checked={selfCheck[check.id as keyof typeof selfCheck]}
                        onCheckedChange={(c) => setSelfCheck({ ...selfCheck, [check.id]: !!c })}
                        className="h-5 w-5 data-[state=checked]:bg-[#00f2ff] data-[state=checked]:text-[#121111]"
                      />
                      <Label htmlFor={check.id} className="cursor-pointer font-medium w-full block">
                        {check.label}
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    className="bg-[#00f2ff] hover:bg-[#00f2ff]/90 text-[#121111] font-bold px-8 py-5 text-base rounded-xl"
                    onClick={handleSaveSnapshot}
                  >
                    Save to Pipeline
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-300 dark:border-white/10"
                    onClick={() => setActiveStage(Math.min(activeStage + 1, funnelStages.length - 1))}
                  >
                    Next Funnel Stage <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
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
                  pipelineHistory.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-3 space-y-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.customerName}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
                      <p className="text-xs text-slate-700 dark:text-slate-300">{item.stage}</p>
                      <p className="text-xs text-slate-700 dark:text-slate-300">Vehicle: {item.recommendationVehicle || 'N/A'}</p>
                      <p className="text-xs text-slate-700 dark:text-slate-300">Next: {item.nextStep || 'N/A'}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-slate-300 dark:border-white/10"
                        onClick={() => handleCopySnapshot(item.summary)}
                      >
                        <Copy className="w-3.5 h-3.5 mr-2" /> Copy Snapshot
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

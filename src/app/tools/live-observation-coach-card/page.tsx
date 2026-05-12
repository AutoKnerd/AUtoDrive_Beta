'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Cloud,
  Copy,
  Lock,
  RefreshCw,
  Save,
  Sparkles,
  Star,
  RotateCcw,
  CheckCircle2,
  MessageSquare,
  Target,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { UpgradeModal } from '@/components/tools/upgrade-modal';
import { useAuth } from '@/hooks/use-auth';
import { useEntitlements } from '@/hooks/use-entitlements';
import { useToast } from '@/hooks/use-toast';
import { FEATURES, resolvePaidAccess } from '@/lib/tools/entitlements';
import { fetchToolboxEntries, saveToolboxEntry } from '@/lib/tools/toolbox-client';
import {
  buildLiveObservationCoachCardCloudContent,
  buildLiveObservationCoachCardHistorySummary,
  buildLiveObservationCoachCardSignature,
  getLiveObservationCoachCardPlan as buildLiveObservationCoachCardPlan,
  getLiveObservationCxInsight as getLiveObservationCoachCardCxInsight,
  getLiveObservationSprocketInsight,
  parseLiveObservationCoachCardCloudContent,
  type LiveObservationCxInsight as LiveObservationCoachCardCxInsight,
  type LiveObservationHistorySummary as LiveObservationCoachCardHistorySummary,
  type LiveObservationPlan as LiveObservationCoachCardPlan,
  type LiveObservationSavedEntry as LiveObservationCoachCardSavedEntry,
  type LiveObservationSprocketInsight as LiveObservationCoachCardSprocketInsight,
  type LiveObservationInput,
  LIVE_OBSERVATION_REACTIONS,
  LIVE_OBSERVATION_ROLES,
} from '@/lib/tools/live-observation-coach-card';
import type { ToolboxSavedEntry } from '@/lib/tools/toolbox';
import { getTempDraft, writeTempDraft } from '@/lib/tools/toolbox-storage';
import { cn } from '@/lib/utils';

const TOOL_ID = 'live-observation-coach-card';
const LOCAL_ENTRIES_KEY = 'liveObservationCoachCardSavedEntriesV1';
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';

type GateModalType = 'paid' | 'autodrive_cx' | null;
type GeneratedState<T> = { signature: string; value: T };

type ObservationStarter = {
  label: string;
  whatHappened: string;
  customerReaction: string;
  associateBehavior: string;
  missedOpportunity: string;
};

const INITIAL_INPUT: LiveObservationInput = {
  role: 'Sales Associate',
  whatHappened: '',
  customerReaction: '',
  associateBehavior: '',
  missedOpportunity: '',
  clarity: 3,
  listening: 3,
  confidence: 3,
  nextStepControl: 3,
  managerNote: '',
  associateName: '',
};

const OBSERVATION_STARTERS: ObservationStarter[] = [
  {
    label: 'Late greeting',
    whatHappened: 'The associate greeted the customer after a short pause and moved straight into business.',
    customerReaction: 'The customer felt guarded and unsure about the tone.',
    associateBehavior: 'The opening felt rushed instead of welcoming.',
    missedOpportunity: 'A warmer first line and one cleaner question would have lowered pressure.',
  },
  {
    label: 'Skipped discovery',
    whatHappened: 'The rep answered quickly before asking enough about the customer’s needs.',
    customerReaction: 'The customer sounded curious but still unclear.',
    associateBehavior: 'The rep moved too fast to the solution.',
    missedOpportunity: 'One better discovery question would have created more trust.',
  },
  {
    label: 'Price pushback',
    whatHappened: 'The customer reacted to the price and the conversation tightened immediately.',
    customerReaction: 'The customer got skeptical and stopped leaning in.',
    associateBehavior: 'The explanation grew longer instead of calmer.',
    missedOpportunity: 'A shorter number explanation and a clearer next step would have helped.',
  },
  {
    label: 'Repair concern',
    whatHappened: 'The service conversation shifted into repair approval and the customer hesitated.',
    customerReaction: 'The customer looked frustrated and wanted a simpler explanation.',
    associateBehavior: 'The advisor leaned into details before the need was clear.',
    missedOpportunity: 'A simpler reason-for-the-repair line would have made approval easier.',
  },
  {
    label: 'Handoff gap',
    whatHappened: 'The conversation moved to another person without a clean bridge.',
    customerReaction: 'The customer looked unsure about who owned the next step.',
    associateBehavior: 'The handoff felt abrupt instead of owned.',
    missedOpportunity: 'Naming the next owner and the next step would have kept momentum.',
  },
  {
    label: 'Follow-up missed',
    whatHappened: 'The live conversation ended without a firm follow-up commitment.',
    customerReaction: 'The customer was open but did not get a clear next touch.',
    associateBehavior: 'The rep left the next step vague.',
    missedOpportunity: 'A cleaner follow-up line and timing would have kept the door open.',
  },
];

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function readDraftState(): { input: LiveObservationInput; variantSeed: number; draftFavorite: boolean } {
  const fallback = {
    input: INITIAL_INPUT,
    variantSeed: 0,
    draftFavorite: false,
  };

  const raw = getTempDraft(TOOL_ID);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<typeof fallback> & { input?: Partial<LiveObservationInput> };
    if (!parsed?.input) return fallback;

    return {
      input: {
        ...INITIAL_INPUT,
        ...parsed.input,
        role: LIVE_OBSERVATION_ROLES.includes(parsed.input.role as (typeof LIVE_OBSERVATION_ROLES)[number])
          ? (parsed.input.role as (typeof LIVE_OBSERVATION_ROLES)[number])
          : INITIAL_INPUT.role,
        clarity: typeof parsed.input.clarity === 'number' ? parsed.input.clarity : INITIAL_INPUT.clarity,
        listening: typeof parsed.input.listening === 'number' ? parsed.input.listening : INITIAL_INPUT.listening,
        confidence: typeof parsed.input.confidence === 'number' ? parsed.input.confidence : INITIAL_INPUT.confidence,
        nextStepControl: typeof parsed.input.nextStepControl === 'number' ? parsed.input.nextStepControl : INITIAL_INPUT.nextStepControl,
      },
      variantSeed: typeof parsed.variantSeed === 'number' ? parsed.variantSeed : 0,
      draftFavorite: Boolean(parsed.draftFavorite),
    };
  } catch {
    return fallback;
  }
}

function readLocalEntries(): LiveObservationCoachCardSavedEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_ENTRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LiveObservationCoachCardSavedEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalEntries(entries: LiveObservationCoachCardSavedEntry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(entries));
}

function buildSignature(input: LiveObservationInput, variantSeed: number): string {
  return buildLiveObservationCoachCardSignature(input, variantSeed);
}

function buildSavedEntry(args: {
  input: LiveObservationInput;
  plan: LiveObservationCoachCardPlan;
  sprocket: LiveObservationCoachCardSprocketInsight | null;
  cx: LiveObservationCoachCardCxInsight | null;
  variantSeed: number;
  favorite: boolean;
}): LiveObservationCoachCardSavedEntry {
  const signature = buildSignature(args.input, args.variantSeed);
  return {
    id: crypto.randomUUID(),
    signature,
    createdAt: new Date().toISOString(),
    variantSeed: args.variantSeed,
    role: args.input.role,
    whatHappened: args.input.whatHappened,
    customerReaction: args.input.customerReaction,
    associateBehavior: args.input.associateBehavior,
    missedOpportunity: args.input.missedOpportunity,
    clarity: args.input.clarity,
    listening: args.input.listening,
    confidence: args.input.confidence,
    nextStepControl: args.input.nextStepControl,
    managerNote: args.input.managerNote,
    associateName: args.input.associateName,
    observationTheme: args.plan.observationTheme,
    coachingHeadline: args.plan.coachingHeadline,
    reinforce: args.plan.reinforce,
    adjust: args.plan.adjust,
    practiceRep: args.plan.practiceRep,
    followUpCommitment: args.plan.followUpCommitment,
    coachThisWay: args.plan.coachThisWay,
    avoidThis: args.plan.avoidThis,
    bestDrill: args.plan.bestDrill,
    summary: args.plan.summary,
    quickCopy: args.plan.quickCopy,
    scorecard: args.plan.scorecard,
    favorite: args.favorite,
    sprocketInsight: args.sprocket,
    cxInsight: args.cx,
  };
}

function formatCloudPreview(content: string): string[] {
  try {
    const parsed = JSON.parse(content) as LiveObservationCoachCardSavedEntry;
    return [
      `${parsed.role} · ${parsed.observationTheme}`,
      parsed.coachingHeadline,
      parsed.reinforce,
      parsed.adjust,
      parsed.followUpCommitment,
    ].filter(Boolean);
  } catch {
    return content.split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 5);
  }
}

function buildCloudContent(entry: LiveObservationCoachCardSavedEntry): string {
  return buildLiveObservationCoachCardCloudContent(entry);
}

function ScorePill({
  value,
  active,
  onClick,
}: {
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition-all active:scale-[0.97]',
        active
          ? 'border-[#9DEE75] bg-[#101b11] text-[#efffe7] shadow-[0_0_0_1px_rgba(157,238,117,0.55),0_0_18px_rgba(157,238,117,0.45),0_0_50px_rgba(157,238,117,0.18)]'
          : 'border-[#4a4456] bg-[#1c2024] text-[#e0e2e9] hover:border-[#d1bcff] hover:bg-[#272a2f]',
      )}
    >
      {value}
    </button>
  );
}

function ChipButton({
  active,
  label,
  onClick,
  compact = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-2 text-sm font-medium transition-all active:scale-[0.98]',
        compact ? 'px-2 py-1 text-xs' : '',
        active
          ? 'border-[#9DEE75] bg-[#101b11] text-[#efffe7] shadow-[0_0_0_1px_rgba(157,238,117,0.55),0_0_18px_rgba(157,238,117,0.35)]'
          : 'border-[#4a4456] bg-[#1c2024] text-[#e0e2e9] hover:border-[#d1bcff] hover:bg-[#272a2f]',
      )}
    >
      {label}
    </button>
  );
}

function FieldCard({
  title,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#d1bcff]">{title}</div>
      <Textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-[92px] border-[#4a4456] bg-[#181c20] text-[#e0e2e9] placeholder:text-[#958da2] focus-visible:ring-[#d1bcff]"
      />
    </div>
  );
}

export default function LiveObservationCoachCardPage() {
  const { toast } = useToast();
  const { user, firebaseUser } = useAuth();
  const [initialDraft] = useState(() => readDraftState());
  const [form, setForm] = useState<LiveObservationInput>(() => initialDraft.input);
  const [variantSeed, setVariantSeed] = useState(() => initialDraft.variantSeed);
  const [draftFavorite, setDraftFavorite] = useState(() => initialDraft.draftFavorite);
  const [savedEntries, setSavedEntries] = useState<LiveObservationCoachCardSavedEntry[]>([]);
  const [cloudEntries, setCloudEntries] = useState<ToolboxSavedEntry[]>([]);
  const [cloudRefreshTick, setCloudRefreshTick] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>();
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [builtSignature, setBuiltSignature] = useState<string | null>(null);
  const [sprocketOutput, setSprocketOutput] = useState<GeneratedState<LiveObservationCoachCardSprocketInsight> | null>(null);
  const [cxOutput, setCxOutput] = useState<GeneratedState<LiveObservationCoachCardCxInsight> | null>(null);

  const outputRef = useRef<HTMLDivElement | null>(null);
  const guidanceRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
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

  const currentInput = useMemo<LiveObservationInput>(() => form, [form]);
  const currentSignature = useMemo(() => buildSignature(currentInput, variantSeed), [currentInput, variantSeed]);
  const plan = useMemo(() => buildLiveObservationCoachCardPlan(currentInput, variantSeed), [currentInput, variantSeed]);
  const builtPlan = builtSignature === currentSignature ? plan : null;
  const currentSprocket = sprocketOutput?.signature === currentSignature ? sprocketOutput.value : null;
  const currentCx = cxOutput?.signature === currentSignature ? cxOutput.value : null;
  const hasStaleInsight = Boolean(sprocketOutput && sprocketOutput.signature !== currentSignature) || Boolean(cxOutput && cxOutput.signature !== currentSignature);

  const parsedCloudEntries = useMemo(() => {
    return cloudEntries
      .map((entry) => parseLiveObservationCoachCardCloudContent(entry.content))
      .filter((entry): entry is LiveObservationCoachCardSavedEntry => Boolean(entry));
  }, [cloudEntries]);

  const historyEntries = useMemo(
    () => {
      const seen = new Set<string>();
      return [...savedEntries, ...parsedCloudEntries].filter((entry) => {
        const key = `${entry.signature}|${entry.createdAt}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    [parsedCloudEntries, savedEntries],
  );

  const historySummary = useMemo<LiveObservationCoachCardHistorySummary | null>(() => {
    if (historyEntries.length === 0) return null;
    return buildLiveObservationCoachCardHistorySummary(historyEntries);
  }, [historyEntries]);

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

  const handleInfo = useCallback(() => {
    toast({
      title: 'Live Observation Coach Card',
      description: 'Capture one live moment, score it fast, and build a five-minute coaching card right away.',
    });
  }, [toast]);

  useEffect(() => {
    setSavedEntries(readLocalEntries());
  }, []);

  useEffect(() => {
    if (!firebaseUser || !hasPaidAccess) {
      setCloudEntries([]);
      return;
    }

    let cancelled = false;
    async function loadCloudHistory() {
      setIsCloudLoading(true);
      const idToken = await firebaseUser.getIdToken();
      const result = await fetchToolboxEntries({ idToken, limit: 8 });
      if (!cancelled) {
        setIsCloudLoading(false);
        setCloudEntries(result.ok ? result.data.entries : []);
      }
    }

    void loadCloudHistory();
    return () => {
      cancelled = true;
    };
  }, [cloudRefreshTick, firebaseUser, hasPaidAccess]);

  useEffect(() => {
    writeTempDraft(TOOL_ID, JSON.stringify({ input: currentInput, variantSeed, draftFavorite }));
  }, [currentInput, draftFavorite, variantSeed]);

  useEffect(() => {
    if (builtSignature !== currentSignature) {
      setSprocketOutput(null);
      setCxOutput(null);
      return;
    }
  }, [builtSignature, currentSignature]);

  const handleCreateCoachCard = useCallback(() => {
    trackMeaningfulInteraction();
    setBuiltSignature(currentSignature);
    toast({ title: 'Coach card ready', description: 'Your live observation card is built.' });
    window.requestAnimationFrame(() => {
      outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [currentSignature, toast, trackMeaningfulInteraction]);

  const buildSavedCard = useCallback(() => buildSavedEntry({
    input: currentInput,
    plan,
    sprocket: currentSprocket,
    cx: currentCx,
    variantSeed,
    favorite: draftFavorite,
  }), [currentCx, currentInput, currentSprocket, draftFavorite, plan, variantSeed]);

  const saveCurrentLocalEntry = useCallback(() => {
    trackMeaningfulInteraction();
    const nextEntry = buildSavedCard();
    const carriedFavorite = savedEntries.find((entry) => entry.signature === nextEntry.signature)?.favorite;
    const next = [
      nextEntry,
      ...savedEntries.filter((entry) => entry.signature !== nextEntry.signature),
    ].slice(0, 40);

    if (carriedFavorite && !nextEntry.favorite) {
      next[0] = { ...next[0], favorite: true };
    }

    setSavedEntries(next);
    writeLocalEntries(next);
    toast({ title: 'Saved locally', description: 'This coach card is stored on this device.' });
  }, [buildSavedCard, savedEntries, toast, trackMeaningfulInteraction]);

  const saveCurrentCloudEntry = useCallback(async () => {
    if (!hasPaidAccess) {
      openUpgrade('paid', 'Unlock cloud sync to save live observation cards across devices.');
      return;
    }

    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Sign in to sync this coach card.' });
      return;
    }

    trackMeaningfulInteraction();
    setIsCloudSaving(true);
    const idToken = await firebaseUser.getIdToken();
    const entry = buildSavedCard();
    const result = await saveToolboxEntry({
      idToken,
      toolId: TOOL_ID,
      content: buildCloudContent(entry),
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
    toast({ title: 'Synced to cloud', description: 'This live observation card is saved server-side.' });
  }, [buildSavedCard, firebaseUser, hasPaidAccess, openUpgrade, toast, trackMeaningfulInteraction]);

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
      `Coach Card: ${plan.coachingHeadline}`,
      `Observed: ${plan.summary}`,
      `Reinforce: ${plan.reinforce}`,
      `Adjust: ${plan.adjust}`,
      `Practice rep: ${plan.practiceRep}`,
      `Commitment: ${plan.followUpCommitment}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(payload);
      toast({ title: 'Copied', description: 'Coach card copied.' });
    } catch {
      toast({ variant: 'destructive', title: 'Copy failed' });
    }
  }, [plan.adjust, plan.coachingHeadline, plan.followUpCommitment, plan.practiceRep, plan.reinforce, plan.summary, toast, trackMeaningfulInteraction]);

  const handleRunSprocket = useCallback(() => {
    if (!hasSprocketAccess) {
      const message = hasPaidAccess
        ? 'Upgrade to AutoDriveCX to unlock Sprocket’s root-cause diagnosis and coach-language rewrite.'
        : 'Create a paid AutoShop account to unlock Sprocket coaching.';
      openUpgrade(hasPaidAccess ? 'autodrive_cx' : 'paid', message);
      return;
    }

    trackMeaningfulInteraction();
    if (builtSignature !== currentSignature) {
      setBuiltSignature(currentSignature);
    }
    setSprocketOutput({
      signature: currentSignature,
      value: getLiveObservationSprocketInsight(currentInput, plan, variantSeed),
    });
  }, [builtSignature, currentInput, currentSignature, hasPaidAccess, hasSprocketAccess, openUpgrade, plan, trackMeaningfulInteraction, variantSeed]);

  const handleRunAutoDriveCx = useCallback(() => {
    if (!hasAutoDriveCxAccess) {
      const message = hasPaidAccess
        ? 'Upgrade to AutoDriveCX for personalized coaching tied to tone, pacing, and trust patterns.'
        : 'Create a paid AutoShop account to unlock AutoDriveCX coaching.';
      openUpgrade(hasPaidAccess ? 'autodrive_cx' : 'paid', message);
      return;
    }

    trackMeaningfulInteraction();
    if (builtSignature !== currentSignature) {
      setBuiltSignature(currentSignature);
    }
    setCxOutput({
      signature: currentSignature,
      value: getLiveObservationCoachCardCxInsight(currentInput, plan, user, historySummary, variantSeed),
    });
  }, [builtSignature, currentInput, currentSignature, hasAutoDriveCxAccess, hasPaidAccess, historySummary, openUpgrade, plan, trackMeaningfulInteraction, user, variantSeed]);

  const handleRegenerate = useCallback(() => {
    trackMeaningfulInteraction();
    setVariantSeed((value) => value + 1);
    setBuiltSignature(null);
    setSprocketOutput(null);
    setCxOutput(null);
    setDraftFavorite(false);
    toast({ title: 'Regenerated', description: 'The card uses a fresh template variation.' });
  }, [toast, trackMeaningfulInteraction]);

  const handleReset = useCallback(() => {
    trackMeaningfulInteraction();
    setForm(INITIAL_INPUT);
    setVariantSeed(0);
    setDraftFavorite(false);
    setBuiltSignature(null);
    setSprocketOutput(null);
    setCxOutput(null);
    writeTempDraft(TOOL_ID, '');
  }, [trackMeaningfulInteraction]);

  const loadSavedEntry = useCallback((entry: LiveObservationCoachCardSavedEntry) => {
    trackMeaningfulInteraction();
    setForm({
      role: entry.role,
      whatHappened: entry.whatHappened,
      customerReaction: entry.customerReaction,
      associateBehavior: entry.associateBehavior,
      missedOpportunity: entry.missedOpportunity,
      clarity: entry.clarity,
      listening: entry.listening,
      confidence: entry.confidence,
      nextStepControl: entry.nextStepControl,
      managerNote: entry.managerNote,
      associateName: entry.associateName,
    });
    setVariantSeed(entry.variantSeed);
    setDraftFavorite(Boolean(entry.favorite));
    setBuiltSignature(entry.signature);
    setSprocketOutput(entry.sprocketInsight ? { signature: entry.signature, value: entry.sprocketInsight } : null);
    setCxOutput(entry.cxInsight ? { signature: entry.signature, value: entry.cxInsight } : null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast({ title: 'Loaded', description: 'Saved coach card restored.' });
  }, [toast, trackMeaningfulInteraction]);

  const toggleFavorite = useCallback((signature: string) => {
    const next = savedEntries.map((entry) => (
      entry.signature === signature ? { ...entry, favorite: !entry.favorite } : entry
    ));
    setSavedEntries(next);
    writeLocalEntries(next);
    if (signature === currentSignature) {
      setDraftFavorite((value) => !value);
    }
  }, [currentSignature, savedEntries]);

  const scenarioBadges = [
    `${form.role} ready`,
    `${plan.observationTheme} theme`,
    hasPaidAccess ? 'Cloud sync ready' : 'Local save only',
  ];

  const outputIsReady = builtSignature === currentSignature;

  return (
    <div className="min-h-screen bg-[#101418] text-[#e0e2e9] pb-40">
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[#4a4456] bg-[#1c2024]/80 px-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild className="h-10 w-10 rounded-full p-0 text-[#e0e2e9] hover:bg-[#272a2f]">
            <Link href="/autoshop" aria-label="Back to AutoShop">
              <ChevronLeft className="h-5 w-5" />
            </Link>
          </Button>
          <span className="font-headline text-lg font-semibold text-[#e0e2e9]">Live Observation Coach Card</span>
        </div>
        <button
          type="button"
          onClick={handleInfo}
          className="rounded-full p-2 text-[#e0e2e9] transition-colors hover:bg-[#272a2f]"
          aria-label="How Live Observation Coach Card works"
        >
          <span className="material-symbols-outlined">info</span>
        </button>
      </header>

      <main className="mx-auto w-full max-w-md space-y-8 px-6 pt-8">
        <div className="space-y-2">
          <Badge className="rounded-full border border-[#7B2EFF]/40 bg-[#1a122d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9c9ff]">
            Manager coaching card
          </Badge>
          <h1 className="font-headline text-4xl font-bold tracking-tight text-[#d1bcff]">
            Turn one live observation into a quick coaching moment.
          </h1>
          <p className="font-body text-base leading-6 text-[#ccc3d9]">
            Capture what you saw, rate the behavior, and build a calm coaching card the manager can use right away.
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
            {LIVE_OBSERVATION_ROLES.map((item) => {
              const active = form.role === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, role: item }))}
                  className={cn(
                    'rounded-xl border p-4 text-left transition-all active:scale-[0.98]',
                    active
                      ? 'border-[#9DEE75] bg-[#101b11] shadow-[0_0_0_1px_rgba(157,238,117,0.55),0_0_24px_rgba(157,238,117,0.45),0_0_64px_rgba(157,238,117,0.22)]'
                      : 'border-[#4a4456] bg-[#272a2f] hover:border-[#d1bcff]',
                  )}
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-[#d1bcff] text-[#24005b]">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="font-headline text-sm font-semibold text-[#e0e2e9]">{item}</div>
                  <div className="mt-1 text-[11px] text-[#ccc3d9]">{item === 'Sales Associate' ? 'Showroom' : 'Service Drive'}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="font-headline text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">Quick Observation Starters</h2>
            <span className="text-xs font-medium text-[#ccc3d9]">Tap to prefill</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {OBSERVATION_STARTERS.map((starter) => (
              <button
                key={starter.label}
                type="button"
                onClick={() => setForm((prev) => ({
                  ...prev,
                  whatHappened: starter.whatHappened,
                  customerReaction: starter.customerReaction,
                  associateBehavior: starter.associateBehavior,
                  missedOpportunity: starter.missedOpportunity,
                }))}
                className="rounded-xl border border-[#4a4456] bg-[#1c2024] px-3 py-3 text-left transition-all hover:border-[#d1bcff] hover:bg-[#272a2f] active:scale-[0.98]"
              >
                <div className="text-sm font-semibold text-[#e0e2e9]">{starter.label}</div>
                <div className="mt-1 text-[11px] text-[#ccc3d9]">Tap to prefill the moment</div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <Card className="border-[#4a4456] bg-[#181c20]">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg text-[#e0e2e9]">
                  <MessageSquare className="h-4 w-4 text-[#d1bcff]" />
                  Capture the live moment
                </CardTitle>
                <Badge className="rounded-full border border-[#7B2EFF]/45 bg-[#1a122d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9c9ff]">
                  Fast fields
                </Badge>
              </div>
              <CardDescription className="text-[#ccc3d9]">
                Keep the notes short. Separate what you saw from what you want to coach.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Primary associate / advisor (optional)</div>
                <Input
                  value={form.associateName}
                  onChange={(event) => setForm((prev) => ({ ...prev, associateName: event.target.value }))}
                  placeholder="Primary associate, advisor, or team"
                  className="border-[#4a4456] bg-[#1c2024] text-[#e0e2e9] placeholder:text-[#958da2] focus-visible:ring-[#d1bcff]"
                />
              </div>

              <FieldCard
                title="What happened?"
                value={form.whatHappened}
                onChange={(value) => setForm((prev) => ({ ...prev, whatHappened: value }))}
                placeholder="Describe the moment you saw."
                rows={3}
              />

              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Customer reaction</div>
                <div className="flex flex-wrap gap-2">
                  {LIVE_OBSERVATION_REACTIONS.map((reaction) => (
                    <ChipButton
                      key={reaction}
                      active={form.customerReaction.toLowerCase() === reaction}
                      label={reaction}
                      onClick={() => setForm((prev) => ({ ...prev, customerReaction: reaction }))}
                      compact
                    />
                  ))}
                </div>
                <Textarea
                  value={form.customerReaction}
                  onChange={(event) => setForm((prev) => ({ ...prev, customerReaction: event.target.value }))}
                  placeholder="If none of the chips fit, type the reaction in a few words."
                  className="min-h-[72px] border-[#4a4456] bg-[#181c20] text-[#e0e2e9] placeholder:text-[#958da2] focus-visible:ring-[#d1bcff]"
                />
              </div>

              <FieldCard
                title="Associate / advisor behavior"
                value={form.associateBehavior}
                onChange={(value) => setForm((prev) => ({ ...prev, associateBehavior: value }))}
                placeholder="What did the associate/advisor actually do?"
                rows={3}
              />

              <FieldCard
                title="Missed opportunity"
                value={form.missedOpportunity}
                onChange={(value) => setForm((prev) => ({ ...prev, missedOpportunity: value }))}
                placeholder="What would have made the moment stronger?"
                rows={3}
              />

              <FieldCard
                title="Manager note (optional)"
                value={form.managerNote}
                onChange={(value) => setForm((prev) => ({ ...prev, managerNote: value }))}
                placeholder="Any coaching language you want sharpened?"
                rows={2}
              />
            </CardContent>
          </Card>

          <Card className="border-[#4a4456] bg-[#181c20]">
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg text-[#e0e2e9]">
                  <Target className="h-4 w-4 text-[#9DEE75]" />
                  Rate the behavior
                </CardTitle>
                <Badge className="rounded-full border border-[#9DEE75]/35 bg-[#112111] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#bdf2a7]">
                  1 to 5
                </Badge>
              </div>
              <CardDescription className="text-[#ccc3d9]">
                Keep it quick. The lowest score will shape the coaching headline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: 'clarity', label: 'Clarity', value: form.clarity, note: 'How clean was the message?' },
                { key: 'listening', label: 'Listening', value: form.listening, note: 'How well did they hear the customer?' },
                { key: 'confidence', label: 'Confidence', value: form.confidence, note: 'How steady was the delivery?' },
                { key: 'nextStepControl', label: 'Next-step control', value: form.nextStepControl, note: 'How clearly did they own the next move?' },
              ].map((metric) => (
                <div key={metric.label} className="space-y-2 rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#e0e2e9]">{metric.label}</div>
                      <div className="text-xs text-[#ccc3d9]">{metric.note}</div>
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d1bcff]">{metric.value}/5</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <ScorePill
                        key={score}
                        value={score}
                        active={metric.value === score}
                        onClick={() => setForm((prev) => ({ ...prev, [metric.key]: score } as LiveObservationInput))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <div className="sticky bottom-4 z-40 -mx-1">
          <Button
            type="button"
            onClick={handleCreateCoachCard}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#d1bcff] px-4 font-headline text-base font-semibold text-[#3d0090] shadow-[0_14px_30px_rgba(209,188,255,0.25)] transition-transform active:scale-[0.98] hover:bg-[#e2d2ff]"
          >
            <Sparkles className="h-4 w-4" />
            Create Coach Card
          </Button>
        </div>

        <section ref={outputRef} className="space-y-4">
          <Card className={cn('border-[#4a4456] bg-[#181c20]', outputIsReady && 'border-[#9DEE75]/45 shadow-[0_0_0_1px_rgba(157,238,117,0.16)]')}>
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg text-[#e0e2e9]">
                  <CheckCircle2 className="h-4 w-4 text-[#9DEE75]" />
                  Coach Card
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className="rounded-full border border-[#7B2EFF]/45 bg-[#1a122d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#d9c9ff]">
                    {form.role}
                  </Badge>
                  <Badge className="rounded-full border border-[#9DEE75]/35 bg-[#112111] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#bdf2a7]">
                    {plan.observationTheme}
                  </Badge>
                </div>
              </div>
              <CardDescription className="text-[#ccc3d9]">
                {outputIsReady
                  ? 'A complete coaching card based on the live moment.'
                  : 'Tap Create Coach Card after capturing the observation.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {outputIsReady && builtPlan ? (
                <>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Observed behavior</p>
                      <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{builtPlan.summary}</p>
                    </div>
                    <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Coaching headline</p>
                      <p className="mt-2 text-base font-semibold leading-6 text-[#e0e2e9]">{builtPlan.coachingHeadline}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-[#9DEE75]/30 bg-[#112115] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#bdf2a7]">Reinforce</p>
                      <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{builtPlan.reinforce}</p>
                    </div>
                    <div className="rounded-xl border border-[#ffb4ab]/30 bg-[#24070b] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#ffb4ab]">Adjust</p>
                      <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{builtPlan.adjust}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Practice rep</p>
                      <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{builtPlan.practiceRep}</p>
                    </div>
                    <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Follow-up commitment</p>
                      <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{builtPlan.followUpCommitment}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-[#9DEE75]/30 bg-[#112115] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#bdf2a7]">Coach this way</p>
                      <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{builtPlan.coachThisWay}</p>
                    </div>
                    <div className="rounded-xl border border-[#ffb4ab]/30 bg-[#24070b] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#ffb4ab]">Avoid this</p>
                      <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{builtPlan.avoidThis}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Quick copy</p>
                    <p className="mt-2 text-sm leading-6 text-[#e0e2e9]">{builtPlan.quickCopy}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {builtPlan.scorecard.map((metric) => (
                      <div key={metric.label} className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">{metric.label}</span>
                          <span className="text-sm font-semibold text-[#e0e2e9]">{metric.value}/5</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#181c20]">
                          <div className="h-full bg-[#9DEE75]" style={{ width: `${(metric.value / 5) * 100}%` }} />
                        </div>
                        <p className="text-xs leading-5 text-[#ccc3d9]">{metric.note}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-[#4a4456] bg-[#0b0f13] p-4 text-sm leading-6 text-[#ccc3d9]">
                  Capture the live moment above, rate the behavior, then tap <span className="text-[#d1bcff] font-semibold">Create Coach Card</span>.
                </div>
              )}

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

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleRegenerate}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#4a4456] bg-[#181c20] font-headline text-xs font-semibold uppercase tracking-[0.08em] text-[#ccc3d9] transition-colors hover:bg-[#272a2f]"
                >
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[#4a4456] bg-[#181c20] font-headline text-xs font-semibold uppercase tracking-[0.08em] text-[#ccc3d9] transition-colors hover:bg-[#272a2f]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section ref={guidanceRef} className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="font-headline text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">Optional Guidance</h2>
            <span className="text-xs font-medium text-[#ccc3d9]">
              {hasSprocketAccess ? 'Refined view' : 'Locked preview'}
            </span>
          </div>

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
                Rewrites manager language, names the likely root cause, and recommends the best drill to pair with the observation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {hasSprocketAccess ? (
                currentSprocket ? (
                  <div className="space-y-3 rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Root cause</p>
                      <p className="mt-1 text-sm leading-6 text-[#e0e2e9]">{currentSprocket.rootCause}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Coach language</p>
                      <p className="mt-1 text-sm leading-6 text-[#e0e2e9]">{currentSprocket.coachingLanguage}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Best drill</p>
                      <p className="mt-1 text-sm leading-6 text-[#e0e2e9]">{currentSprocket.bestDrill}</p>
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
                  <div className="space-y-3">
                    <div className="rounded-xl border border-dashed border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">
                      Tap <span className="text-[#d1bcff] font-semibold">Run Sprocket</span> to get the coaching rewrite.
                    </div>
                    <Button
                      className="h-11 w-full bg-[#9DEE75] text-[#08140c] hover:bg-[#b6f592]"
                      onClick={() => handleRunSprocket()}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Run Sprocket
                    </Button>
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                    <div className="space-y-2 opacity-40 blur-[7px] select-none">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Root cause</p>
                      <p className="text-sm leading-6 text-[#e0e2e9]">Paid coaching rewrites appear here when Sprocket is available.</p>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d1bcff]">Coach language</p>
                      <p className="text-sm leading-6 text-[#e0e2e9]">Unlock clearer manager wording and a stronger next drill.</p>
                    </div>
                  </div>
                  <Button className="h-11 w-full bg-[#9DEE75] text-[#08140c] hover:bg-[#b6f592]" onClick={() => openUpgrade('paid', 'Unlock Sprocket to diagnose the root cause and rewrite the manager coaching language.')}>
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
                Connects the observation to recurring behavior patterns, trust repair, and coaching history.
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
                        {currentCx.trendType === 'trend' ? 'Trend' : 'One-off'}
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
                  <div className="space-y-3">
                    <div className="rounded-xl border border-dashed border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">
                      Tap <span className="text-[#d1bcff] font-semibold">Run AutoDriveCX</span> after building the coach card.
                    </div>
                    <Button
                      className="h-11 w-full bg-[#9DEE75] text-[#08140c] hover:bg-[#b6f592]"
                      onClick={() => handleRunAutoDriveCx()}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Run AutoDriveCX
                    </Button>
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
                  <Button className="h-11 w-full bg-[#9DEE75] text-[#08140c] hover:bg-[#b6f592]" onClick={() => openUpgrade('autodrive_cx', 'Upgrade to AutoDriveCX for personalized tone, pacing, trust, and coaching-history guidance.')}>
                    <Lock className="mr-2 h-4 w-4" />
                    Unlock AutoDriveCX
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section ref={historyRef} className="space-y-4">
          <div className="flex items-end justify-between">
            <h2 className="font-headline text-sm font-semibold uppercase tracking-[0.05em] text-[#d1bcff]">Saved Cards</h2>
            <span className="text-xs font-medium text-[#ccc3d9]">{savedEntries.length} local · {favoriteCount} favorites</span>
          </div>

          <Card className="border-[#4a4456] bg-[#181c20]">
            <CardHeader>
              <CardTitle className="text-lg text-[#e0e2e9]">Local history</CardTitle>
              <CardDescription className="text-[#ccc3d9]">Free users keep saved observation cards on this device.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {savedEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">
                  No saved cards yet. Tap Save after you like the output.
                </div>
              ) : (
                savedEntries.slice(0, 6).map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#e0e2e9]">{entry.role} · {entry.observationTheme}</p>
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
                    <p className="text-sm leading-6 text-[#e0e2e9]">{entry.coachingHeadline}</p>
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
                        onClick={() => loadSavedEntry(entry)}
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
              <CardDescription className="text-[#ccc3d9]">Paid users can sync observation cards to their account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!hasPaidAccess ? (
                <div className="space-y-3">
                  <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                    <div className="space-y-2 opacity-40 blur-[7px] select-none">
                      <p className="text-sm font-semibold text-[#e0e2e9]">Cloud-synced history unlocks here.</p>
                      <p className="text-sm leading-6 text-[#ccc3d9]">Keep your strongest coaching cards and pattern history in your account.</p>
                    </div>
                  </div>
                  <Button className="h-11 w-full bg-[#9DEE75] text-[#08140c] hover:bg-[#b6f592]" onClick={() => openUpgrade('paid', 'Unlock cloud sync and observation-card history for Live Observation Coach Card.')}>
                    <Lock className="mr-2 h-4 w-4" />
                    Unlock History Sync
                  </Button>
                </div>
              ) : isCloudLoading ? (
                <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">Loading synced history...</div>
              ) : !firebaseUser ? (
                <div className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">Sign in to see synced coaching history.</div>
              ) : parsedCloudEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#4a4456] bg-[#0b0f13] p-4 text-sm text-[#ccc3d9]">No synced coaching yet. Save a coach card to your account.</div>
              ) : (
                parsedCloudEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-[#4a4456] bg-[#0b0f13] p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#e0e2e9]">Synced entry</p>
                      <span className="text-xs text-[#958da2]">{new Date(entry.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="space-y-1 text-sm text-[#e0e2e9]">
                      {formatCloudPreview(buildCloudContent(entry)).map((line) => (
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

      {hasStaleInsight && (
        <div className="fixed bottom-24 left-4 right-4 z-40 rounded-xl border border-[#4a4456] bg-[#0b0f13]/95 px-4 py-3 text-sm text-[#ccc3d9] shadow-2xl backdrop-blur">
          Your selected inputs changed. Tap <span className="text-[#d1bcff] font-semibold">Create Coach Card</span> again to rebuild the card.
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-40">
        {isCloudSaving && (
          <Badge className="rounded-full border border-[#7B2EFF]/45 bg-[#1a122d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#d9c9ff]">
            Saving...
          </Badge>
        )}
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

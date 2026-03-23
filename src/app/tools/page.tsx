'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, FolderOpen, Lock, Save } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { EmailGateModal } from '@/components/tools/email-gate-modal';
import { SaveAccountModal } from '@/components/tools/save-account-modal';
import { UpgradeModal } from '@/components/tools/upgrade-modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { hasActiveSubscriptionStatus } from '@/lib/billing/access';
import type { BillingSubscriptionStatus, UserRole } from '@/lib/definitions';
import { cn } from '@/lib/utils';
import { touchAttribution } from '@/lib/consultant-referral';
import {
  canAccessTool,
  ctaForFeaturedTool,
  ctaForToolCard,
  getFeaturedTool,
  isRecentTool,
  TOOLBOX_TOOLS,
  type ToolConfig,
  type ToolboxSavedEntry,
  type ToolboxUserState,
} from '@/lib/tools/toolbox';
import {
  clearFullToolHandoff,
  clearTempDrafts,
  clearUnlockState,
  exportTempDraftsAsEntries,
  getTempDraft,
  writeFullToolHandoff,
  readUnlockState,
  writeTempDraft,
  writeUnlockState,
} from '@/lib/tools/toolbox-storage';
import {
  buildSignalMapperFullPrefillFromMicro,
  buildSignalMapperMicroDraft,
  hasSignalMapperMicroContent,
  parseSignalMapperMicroDraft,
  type SignalMapperMicroDraft,
} from '@/lib/tools/signal-mapper-micro';
import {
  captureToolboxUnlockEmail,
  createToolboxFreeAccount,
  fetchToolboxEntries,
  saveToolboxEntry,
  syncToolboxPaidStatus,
} from '@/lib/tools/toolbox-client';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOOLBOX_DEFAULT_ROLE: UserRole = 'Sales Consultant';
const SECOND_TOOL_PROMPT_DELAY_MS = 6000;
const FEATURED_COMPLETION_DELAY_MS = 45000;
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';

const mainSiteLoginButtonStyle: CSSProperties = {
  fontSize: '12px',
  padding: '12px 20px',
  borderRadius: '5px',
  border: '1px solid rgba(122, 211, 255, 0.3)',
  background: 'linear-gradient(180deg, #46a8df 0%, #2f88c2 100%)',
  color: '#fff',
  fontWeight: 800,
  letterSpacing: '0.12em',
  transition: 'all 0.25s ease',
  boxShadow: '0 6px 14px rgba(28, 130, 189, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
  textShadow: '0 1px 0 rgba(0,0,0,0.22)',
  textDecoration: 'none',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  lineHeight: 1.05,
};

function badgeLabelForTool(tool: ToolConfig, tools: ToolConfig[]): 'Free' | 'Recent' | 'Premium' {
  if (tool.access === 'premium') return 'Premium';
  if (isRecentTool(tool, tools, 3)) return 'Recent';
  return 'Free';
}

function badgeText(label: 'Free' | 'Recent' | 'Premium'): string {
  if (label === 'Premium') return 'Pro Only';
  return label;
}

function buildToolRoute(toolId: string): string | null {
  if (toolId === 'signal-mapper') return '/tools/signal-mapper';
  return null;
}

function deriveNameFromEmail(email: string): string {
  const local = email.split('@')[0] || '';
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'Toolbox Member';

  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolvePaidTier(input: {
  tier?: 'free' | 'pro';
  subscriptionStatus?: BillingSubscriptionStatus | null;
}): boolean {
  if (input.tier === 'pro') return true;
  return hasActiveSubscriptionStatus(input.subscriptionStatus ?? null);
}

export default function ToolsPage() {
  const { toast } = useToast();
  const firebaseAuth = useFirebaseAuth();
  const { user, firebaseUser, loading, login, publicSignup, setUser } = useAuth();

  const [guestUserState, setGuestUserState] = useState<'visitor' | 'email_unlocked'>('visitor');
  const [unlockEmail, setUnlockEmail] = useState('');
  const [activeTool, setActiveTool] = useState<ToolConfig | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [recentEntries, setRecentEntries] = useState<ToolboxSavedEntry[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [showSaveGate, setShowSaveGate] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isAccountSubmitting, setIsAccountSubmitting] = useState(false);
  const [isUpgradeSubmitting, setIsUpgradeSubmitting] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [didAuthBootstrap, setDidAuthBootstrap] = useState(false);
  const [showAccountSuccess, setShowAccountSuccess] = useState(false);

  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [sessionOpenedToolIds, setSessionOpenedToolIds] = useState<string[]>([]);
  const [showSecondToolPrompt, setShowSecondToolPrompt] = useState(false);
  const [dismissedSecondToolPrompt, setDismissedSecondToolPrompt] = useState(false);
  const [showFeaturedCompletionPrompt, setShowFeaturedCompletionPrompt] = useState(false);
  const [dismissedFeaturedCompletionPrompt, setDismissedFeaturedCompletionPrompt] = useState(false);
  const [dismissedReturnBanner, setDismissedReturnBanner] = useState(false);
  const [signalMapperStep, setSignalMapperStep] = useState(0);

  const [activeFilter, setActiveFilter] = useState<'All Tools' | 'Free Tools' | 'Recent Tools' | 'Premium Tools'>('All Tools');
  const filters: Array<'All Tools' | 'Free Tools' | 'Recent Tools' | 'Premium Tools'> = [
    'All Tools', 'Free Tools', 'Recent Tools', 'Premium Tools',
  ];

  const tools = TOOLBOX_TOOLS;
  const featuredTool = useMemo(() => getFeaturedTool(tools), [tools]);
  const isAuthenticated = !!firebaseUser;
  const isPaidUser = resolvePaidTier({
    tier: user?.tier,
    subscriptionStatus: user?.subscriptionStatus,
  });

  const userState: ToolboxUserState = isAuthenticated
    ? (isPaidUser ? 'paid_account' : 'free_account')
    : guestUserState;

  const unlockedToolCount = useMemo(
    () => tools.filter((tool) => canAccessTool(userState, tool, tools)).length,
    [tools, userState]
  );

  const filteredTools = useMemo(() => {
    if (activeFilter === 'All Tools') return tools;
    const targetBadge = activeFilter === 'Free Tools' ? 'Free' : activeFilter === 'Recent Tools' ? 'Recent' : 'Premium';
    return tools.filter((tool) => badgeLabelForTool(tool, tools) === targetBadge);
  }, [tools, activeFilter]);

  const displayName = (user?.name || '').trim().split(/\s+/)[0] || (user?.email || '');
  const featuredCta = ctaForFeaturedTool(userState);
  const activeDraft = activeTool ? drafts[activeTool.id] || '' : '';
  const signalMapperDraft = useMemo(
    () => parseSignalMapperMicroDraft(activeDraft),
    [activeDraft]
  );
  const activeToolId = activeTool?.id ?? null;
  const isWorkspaceMode = !!activeToolId;
  const showReturnVisitBanner = isAuthenticated && !isPaidUser && recentEntries.length > 0 && !dismissedReturnBanner;

  useEffect(() => {
    const unlock = readUnlockState();
    if (unlock) {
      setUnlockEmail(unlock.email);
      if (!isAuthenticated) setGuestUserState('email_unlocked');
    } else if (!isAuthenticated) {
      setGuestUserState('visitor');
    }

    const initialDrafts: Record<string, string> = {};
    tools.forEach((tool) => {
      const draft = getTempDraft(tool.id);
      if (draft) initialDrafts[tool.id] = draft;
    });
    setDrafts(initialDrafts);
  }, [tools, isAuthenticated]);

  useEffect(() => {
    async function loadEntries() {
      if (!firebaseUser) {
        setRecentEntries([]);
        return;
      }

      const idToken = await firebaseUser.getIdToken();
      const result = await fetchToolboxEntries({ idToken, limit: 12 });
      if (result.ok) setRecentEntries(result.data.entries);
    }

    void loadEntries();
  }, [firebaseUser, user?.tier, user?.subscriptionStatus]);

  useEffect(() => {
    async function bootstrapAuthenticatedUser() {
      if (!firebaseUser || didAuthBootstrap) return;

      const localEntries = exportTempDraftsAsEntries();
      const hasUnlockState = !!readUnlockState();
      if (!localEntries.length && !hasUnlockState) {
        setDidAuthBootstrap(true);
        return;
      }

      const idToken = await firebaseUser.getIdToken();
      const result = await createToolboxFreeAccount({ idToken, localEntries });

      if (result.ok) {
        clearUnlockState();
        clearTempDrafts();
        setGuestUserState('visitor');
        setShowAccountSuccess(true);
      }

      setDidAuthBootstrap(true);
    }

    void bootstrapAuthenticatedUser();
  }, [didAuthBootstrap, firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) {
      setDidAuthBootstrap(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (isPaidUser || dismissedSecondToolPrompt || showSecondToolPrompt) return;
    if (!(userState === 'email_unlocked' || userState === 'free_account')) return;
    if (sessionOpenedToolIds.length < 2) return;

    const timer = window.setTimeout(() => {
      setShowSecondToolPrompt(true);
    }, SECOND_TOOL_PROMPT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [dismissedSecondToolPrompt, isPaidUser, sessionOpenedToolIds.length, showSecondToolPrompt, userState]);

  useEffect(() => {
    if (isPaidUser || dismissedFeaturedCompletionPrompt || showFeaturedCompletionPrompt) return;
    if (!activeTool || activeTool.id !== featuredTool.id) return;

    const timer = window.setTimeout(() => {
      setShowFeaturedCompletionPrompt(true);
    }, FEATURED_COMPLETION_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [activeTool, dismissedFeaturedCompletionPrompt, featuredTool.id, isPaidUser, showFeaturedCompletionPrompt]);

  useEffect(() => {
    if (activeTool?.id !== 'signal-mapper') {
      setSignalMapperStep(0);
    }
  }, [activeTool?.id]);

  function formatLastEdited(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  function openTool(tool: ToolConfig) {
    setActiveTool(tool);
    setSessionOpenedToolIds((current) => (current.includes(tool.id) ? current : [...current, tool.id]));
  }

  function maybeOpenTool(tool: ToolConfig) {
    const hasAccess = canAccessTool(userState, tool, tools);

    if (!hasAccess) {
      if (userState === 'visitor') {
        setShowEmailGate(true);
        return;
      }

      if (userState === 'email_unlocked') {
        setShowSaveGate(true);
        return;
      }

      setUpgradeContextMessage(undefined);
      setShowUpgradeModal(true);
      return;
    }

    openTool(tool);
  }

  function handleInlineUpgradeClick(context?: string) {
    if (userState === 'email_unlocked') {
      setShowSaveGate(true);
      return;
    }

    setUpgradeContextMessage(context);
    setShowUpgradeModal(true);
  }

  async function handleUnlockByEmail(email: string) {
    if (!emailRegex.test(email)) {
      toast({ variant: 'destructive', title: 'Enter a valid email' });
      return;
    }

    setIsEmailSubmitting(true);
    const captureResult = await captureToolboxUnlockEmail(email);
    if (!captureResult.ok) {
      console.warn('[Toolbox] unlock email capture failed:', captureResult.message);
    }

    writeUnlockState(email);
    setUnlockEmail(email);
    setGuestUserState('email_unlocked');
    setShowEmailGate(false);
    openTool(featuredTool);
    setIsEmailSubmitting(false);
    touchAttribution('medium', 'email_entered');

    toast({
      title: 'Tool unlocked',
      description: 'You can now use this week\'s tool right away.',
    });
  }

  async function handleCreateFreeAccount(password: string) {
    if (!unlockEmail) {
      toast({ variant: 'destructive', title: 'Email required before account setup.' });
      return;
    }

    setIsAccountSubmitting(true);

    try {
      const name = deriveNameFromEmail(unlockEmail);

      try {
        await publicSignup(name, unlockEmail, password, TOOLBOX_DEFAULT_ROLE);
      } catch (signupError: any) {
        const message = String(signupError?.message || '').toLowerCase();
        if (message.includes('already in use')) {
          await login(unlockEmail, password);
        } else {
          throw signupError;
        }
      }

      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        throw new Error('Account was created, but authentication did not complete. Please try signing in.');
      }

      const idToken = await currentUser.getIdToken(true);
      const localEntries = exportTempDraftsAsEntries();
      const accountResult = await createToolboxFreeAccount({ idToken, localEntries });

      if (!accountResult.ok) {
        throw new Error(accountResult.message);
      }

      clearUnlockState();
      clearTempDrafts();
      setGuestUserState('visitor');
      setShowSaveGate(false);

      if (user) {
        setUser({
          ...user,
          tier: accountResult.data.tier,
          toolAccessLevel: accountResult.data.toolAccessLevel,
        });
      }

      const entriesResult = await fetchToolboxEntries({ idToken, limit: 12 });
      if (entriesResult.ok) {
        setRecentEntries(entriesResult.data.entries);
      }

      setShowAccountSuccess(true);
      touchAttribution('strong', 'signup_completed');

      toast({
        title: 'Free account created',
        description: 'You are signed in and your tool work is now saved to your AutoDrive account.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Could not create account',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setIsAccountSubmitting(false);
    }
  }

  async function handleUpgrade() {
    if (!firebaseUser || !isAuthenticated) {
      setShowUpgradeModal(false);
      setShowSaveGate(true);
      return;
    }

    if (isPaidUser) {
      setShowUpgradeModal(false);
      return;
    }

    console.info('[Toolbox] unlock_click', { source: 'upgrade_modal', state: userState });
    setIsUpgradeSubmitting(true);
    window.open(TOOLBOX_UPGRADE_URL, '_blank', 'noopener,noreferrer');
    toast({
      title: 'Complete payment to unlock Pro',
      description: 'Finish checkout, then return here. We will unlock tools as soon as payment is confirmed.',
    });
    setIsUpgradeSubmitting(false);
  }

  useEffect(() => {
    if (!showUpgradeModal || !firebaseUser || isPaidUser) return;
    const currentUser = firebaseUser;

    let cancelled = false;

    async function syncPaidStatus() {
      const idToken = await currentUser.getIdToken(true);
      const result = await syncToolboxPaidStatus({ idToken });
      if (!result.ok || cancelled) return;
      if (!result.data.isPaid) return;

      if (user) {
        setUser({
          ...user,
          tier: result.data.tier,
          toolAccessLevel: result.data.toolAccessLevel,
        });
      }

      console.info('[Toolbox] upgrade_confirmed', { state: userState });
      setShowUpgradeModal(false);
      setUpgradeContextMessage(undefined);
      toast({ title: 'Upgrade complete', description: 'All tools are now unlocked on this account.' });
    }

    console.info('[Toolbox] paywall_open', { state: userState });
    void syncPaidStatus();
    const interval = window.setInterval(() => {
      void syncPaidStatus();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [firebaseUser, isPaidUser, showUpgradeModal, toast, user, userState, setUser]);

  async function handleSaveCurrentWork() {
    if (!activeTool) return;

    const content = (drafts[activeTool.id] || '').trim();
    if (!content) {
      toast({
        variant: 'destructive',
        title: 'Add a quick note first',
        description: 'Write at least one line before saving.',
      });
      return;
    }

    if (userState === 'visitor') {
      setShowEmailGate(true);
      return;
    }

    if (userState === 'email_unlocked') {
      setShowSaveGate(true);
      return;
    }

    if (!firebaseUser) {
      toast({ variant: 'destructive', title: 'Sign in required before saving.' });
      return;
    }

    setIsSavingEntry(true);
    const idToken = await firebaseUser.getIdToken();
    const result = await saveToolboxEntry({
      idToken,
      toolId: activeTool.id,
      content,
    });

    if (!result.ok) {
      setIsSavingEntry(false);

      if (result.code === 'SAVE_LIMIT') {
        setUpgradeContextMessage('You\'re building momentum. Don\'t lose it.');
        setShowUpgradeModal(true);
      }

      toast({ variant: 'destructive', title: result.message });
      return;
    }

    setRecentEntries((current) => [result.data.entry, ...current].slice(0, 12));
    setIsSavingEntry(false);

    if (!isPaidUser && activeTool.id === featuredTool.id) {
      setShowFeaturedCompletionPrompt(true);
    }

    toast({ title: 'Saved', description: 'Your note is now available in recent work.' });
  }

  function handleDraftChange(toolId: string, value: string) {
    setDrafts((current) => ({ ...current, [toolId]: value }));

    if (userState === 'email_unlocked' || userState === 'visitor') {
      writeTempDraft(toolId, value);
    }
  }

  function handleSignalMapperFieldChange(field: keyof SignalMapperMicroDraft, value: string) {
    if (!activeTool || activeTool.id !== 'signal-mapper') return;
    const nextDraft = buildSignalMapperMicroDraft({
      ...signalMapperDraft,
      [field]: value,
    });
    handleDraftChange(activeTool.id, nextDraft);
  }

  function goSignalMapperStep(delta: number) {
    setSignalMapperStep((current) => Math.min(4, Math.max(0, current + delta)));
  }

  function handleOpenFullTool(tool: ToolConfig) {
    if (!tool.hasFullVersion) return;
    const route = buildToolRoute(tool.id);
    if (!route) return;

    clearFullToolHandoff(tool.id);
    if (tool.id === 'signal-mapper') {
      const parsed = parseSignalMapperMicroDraft(drafts[tool.id] || '');
      if (hasSignalMapperMicroContent(parsed)) {
        writeFullToolHandoff(tool.id, {
          source: 'tools_micro',
          prefill: buildSignalMapperFullPrefillFromMicro(parsed),
        });
      }
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070d18] pb-24 text-[#d9e3f5]">
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-[#76ff8f]/[0.07] blur-3xl" />
      <div className="relative z-10">
        <Header />

        {!loading && !isAuthenticated && (
          <div className="pointer-events-none absolute right-4 top-3 z-40 flex items-center gap-2 md:right-6">
            <a
              href="https://app.autodrivecx.com/login"
              className="pointer-events-auto uppercase tracking-[0.08em] hover:brightness-110"
              style={mainSiteLoginButtonStyle}
            >
              LOG IN
            </a>
          </div>
        )}

        <main className="mx-auto w-full max-w-6xl space-y-10 p-4 md:space-y-12 md:p-8 lg:px-12 lg:py-14">
          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#76ff8f]/30 bg-[#111b2d] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9bffac]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#76ff8f]" />
                New tool drops every week
              </div>
            </div>

            <div className="space-y-2">
              {!loading && user && (
                <p className="text-sm font-medium text-[#c8d8f1]">Welcome back{displayName ? `, ${displayName}` : ''}.</p>
              )}
              <h1 className="text-3xl font-semibold tracking-tight text-[#f6fbff] md:text-4xl">
                One tool a week. Better conversations. More deals.
              </h1>
              <p className="max-w-3xl text-base text-[#a7b7d1] md:text-lg">
                Build a CX system you actually use, not one you forget.
              </p>
              <p className="text-sm text-[#a7b7d1]/70">Takes less than 5 minutes to run.</p>
              <p className="text-sm text-[#9db0cb]">
                {isAuthenticated ? `You've unlocked ${unlockedToolCount} tools.` : 'Pick up where you left off.'}
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => maybeOpenTool(featuredTool)}
              className="border-[#2f415f] bg-[#0d1728] text-[#e8f1ff] hover:bg-[#12203a]"
            >
              Start This Week's Tool
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </section>

          {showReturnVisitBanner && (
            <section>
              <Card className="border-[#2b3e5d] bg-[#101d31]">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-[#dbe7fb]">Pick up where you left off, or unlock the full system.</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="bg-[#172845] text-[#eaf2ff] hover:bg-[#22375a]" onClick={() => handleInlineUpgradeClick()}>
                      Unlock Full Access
                    </Button>
                    <Button size="sm" variant="ghost" className="text-[#9eb3d1] hover:bg-[#13233b]" onClick={() => setDismissedReturnBanner(true)}>
                      Dismiss
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {showAccountSuccess && (
            <section>
              <Card className="border-[#2b3e5d] bg-[#101d31]">
                <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-[#f5f9ff]">You're all set</p>
                    <p className="text-sm text-[#a9bbd8]">
                      Your work is saved. You can pick up where you left off anytime.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-[#2f415f] bg-[#0d1728] text-[#e8f1ff] hover:bg-[#12203a]"
                    onClick={() => setShowAccountSuccess(false)}
                  >
                    Back to Tools
                  </Button>
                </CardContent>
              </Card>
            </section>
          )}

          <div className="transition-all duration-200">
            {!isWorkspaceMode ? (
              <div className="space-y-10">
                <section>
                  <Card className="overflow-hidden border-[#2b3e5d] bg-[#0f1b30] shadow-[0_0_0_1px_rgba(118,255,143,0.08)]">
                    <CardHeader className="space-y-4 border-b border-[#203352] bg-[#121f36]">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6f89af]">This Week's Tool</p>
                        <CardTitle className="text-3xl font-semibold tracking-tight text-[#f5f9ff] md:text-4xl">
                          {featuredTool.name}
                        </CardTitle>
                        <p className="max-w-2xl text-base text-[#a9bbd8]">{featuredTool.description}</p>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <Button
                        size="lg"
                        className="h-11 bg-[#76ff8f] px-6 font-semibold text-[#0d1d11] hover:bg-[#92ffa7]"
                        onClick={() => maybeOpenTool(featuredTool)}
                      >
                        {featuredCta}
                      </Button>
                    </CardContent>
                  </Card>
                </section>

                <section className="space-y-5">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {filters.map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setActiveFilter(filter)}
                        className={cn(
                          'whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold tracking-wide transition-all duration-200',
                          activeFilter === filter
                            ? 'border-[#76ff8f]/45 bg-[#76ff8f]/12 text-[#b4ffbf]'
                            : 'border-[#2c3e5c] bg-[#0f1a2d] text-[#a4b6d2] hover:-translate-y-0.5 hover:border-[#3c5278] hover:text-[#d8e4f8]'
                        )}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>

                  {activeFilter === 'Recent Tools' && (
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#90a8cc]">Recently Added</p>
                  )}

                  {showSecondToolPrompt && !dismissedSecondToolPrompt && !isPaidUser && (
                    <Card className="border-[#2b3e5d] bg-[#101d31]">
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-[#dbe7fb]">Want access to every tool? Unlock the full toolbox.</p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="bg-[#172845] text-[#eaf2ff] hover:bg-[#22375a]" onClick={() => handleInlineUpgradeClick()}>
                            Unlock Full Access
                          </Button>
                          <Button size="sm" variant="ghost" className="text-[#9eb3d1] hover:bg-[#13233b]" onClick={() => setDismissedSecondToolPrompt(true)}>
                            Dismiss
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredTools.map((tool) => {
                      const hasAccess = canAccessTool(userState, tool, tools);
                      const ctaLabel = ctaForToolCard(tool, hasAccess);
                      const badge = badgeLabelForTool(tool, tools);
                      const displayBadge = badge === 'Recent' ? 'Free' : badge;
                      const isPremiumLocked = tool.access === 'premium' && !hasAccess;

                      return (
                        <Card
                          key={tool.id}
                          className={cn(
                            'group relative overflow-hidden border-[#263b5a] bg-[#0d192c] transition-all duration-200',
                            hasAccess ? 'hover:-translate-y-1 hover:border-[#37507a]' : ''
                          )}
                        >
                          <CardHeader className={cn('space-y-3', isPremiumLocked && 'opacity-55 blur-[0.6px]')}>
                            <Badge
                              variant="outline"
                              className={cn(
                                'w-fit border text-[11px] font-semibold tracking-wide',
                                displayBadge === 'Premium'
                                  ? 'border-[#6f89af] bg-[#233652] text-[#c4d4eb]'
                                  : 'border-[#2f4a70] bg-[#13233b] text-[#9eb2d3]'
                              )}
                            >
                              {badgeText(displayBadge)}
                            </Badge>
                            <CardTitle className="text-xl font-semibold text-[#f2f8ff]">{tool.name}</CardTitle>
                          </CardHeader>

                          <CardContent className={cn('pb-6', isPremiumLocked && 'opacity-55 blur-[0.6px]')}>
                            <p className="min-h-12 text-sm leading-relaxed text-[#a7b7d1]">{tool.description}</p>
                            <Button
                              className="mt-5 w-full bg-[#172845] text-[#eaf2ff] hover:bg-[#22375a]"
                              onClick={() => maybeOpenTool(tool)}
                            >
                              {ctaLabel}
                            </Button>
                          </CardContent>

                          {isPremiumLocked && (
                            <>
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a1220]/62 backdrop-blur-[1px]">
                                <Lock className="h-4 w-4 text-[#9db0cb]" />
                                <p className="text-sm font-medium text-[#d8e3f5]">Pro Only</p>
                                <p className="px-4 text-center text-xs text-[#9fb0c9]">Unlock full toolbox access</p>
                                <Button
                                  size="sm"
                                  className="bg-[#76ff8f] text-[#0e1f12] hover:bg-[#92ffa7]"
                                  onClick={() => maybeOpenTool(tool)}
                                >
                                  Unlock Toolbox
                                </Button>
                              </div>
                              <div className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 rounded-md border border-[#304466] bg-[#0b1629] px-2 py-1 text-[10px] text-[#d6e4fb] md:block md:opacity-0 md:transition-opacity md:duration-200 group-hover:opacity-100">
                                Unlock this and every tool with Pro
                              </div>
                            </>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                </section>
              </div>
            ) : (
              <section className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="space-y-3 md:sticky md:top-20 md:h-fit">
                  <Card className="border-[#263b5a] bg-[#0d192c]">
                    <CardHeader className="border-b border-[#203352] bg-[#111f35] py-4">
                      <CardTitle className="flex items-center justify-between text-base text-[#edf5ff]">
                        <span>Toolbox</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#9eb3d1] hover:bg-[#1a2d49]"
                          onClick={() => setActiveTool(null)}
                        >
                          Back to Toolbox
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="hidden space-y-2 p-3 md:block">
                      {tools.map((tool) => {
                        const hasAccess = canAccessTool(userState, tool, tools);
                        return (
                          <button
                            key={tool.id}
                            type="button"
                            onClick={() => maybeOpenTool(tool)}
                            className={cn(
                              'w-full rounded-md border px-3 py-2 text-left transition-colors',
                              activeToolId === tool.id
                                ? 'border-[#76ff8f]/50 bg-[#14273e] text-[#e9f5ff]'
                                : 'border-[#2a3f5f] bg-[#0a1527] text-[#b4c7e3] hover:bg-[#12203a]',
                              !hasAccess && 'opacity-80'
                            )}
                          >
                            <p className="text-sm font-medium">{tool.name}</p>
                            <p className="text-[11px] text-[#8ea2c1]">{tool.access === 'premium' ? 'Pro Only' : 'Free'}</p>
                          </button>
                        );
                      })}
                    </CardContent>
                    <CardContent className="space-y-3 p-3 md:hidden">
                      <select
                        className="w-full rounded-md border border-[#2a3f5f] bg-[#0a1527] px-3 py-2 text-sm text-[#d8e6fb]"
                        value={activeToolId || ''}
                        onChange={(event) => {
                          const selected = tools.find((tool) => tool.id === event.target.value);
                          if (selected) maybeOpenTool(selected);
                        }}
                      >
                        {tools.map((tool) => (
                          <option key={tool.id} value={tool.id}>
                            {tool.name} {tool.access === 'premium' ? '(Pro Only)' : '(Free)'}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="outline"
                        className="w-full border-[#2f445f] bg-transparent text-[#dbe7fb] hover:bg-[#1a2d49]"
                        onClick={() => setActiveTool(null)}
                      >
                        Back to Toolbox
                      </Button>
                    </CardContent>
                  </Card>
                </aside>

                <div className="space-y-5">
                  {activeTool && (
                    <Card className="overflow-hidden border-[#263b5a] bg-[#0d192c]">
                      <CardHeader className="border-b border-[#203352] bg-[#111f35]">
                        <CardTitle className="flex items-center justify-between text-xl text-[#edf5ff]">
                          <span>{activeTool.name}</span>
                          {activeTool.hasFullVersion && buildToolRoute(activeTool.id) && (
                            <Button asChild variant="outline" size="sm" className="border-[#2f445f] bg-transparent text-[#dbe7fb] hover:bg-[#1a2d49]">
                              <Link href={buildToolRoute(activeTool.id) || '#'} onClick={() => handleOpenFullTool(activeTool)}>
                                Open Full Tool
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          )}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="space-y-4 pt-5">
                        {activeTool.id === 'signal-mapper' ? (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[#9eb3d1]">
                                <span>
                                  Step {signalMapperStep + 1} of 5
                                </span>
                                <span>{Math.round(((signalMapperStep + 1) / 5) * 100)}%</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-[#102036]">
                                <div className="h-full bg-[#76ff8f] transition-all" style={{ width: `${Math.round(((signalMapperStep + 1) / 5) * 100)}%` }} />
                              </div>
                            </div>

                            <Card className="border-[#2a3f5f] bg-[#0a1527]">
                              <CardContent className="space-y-4 p-4 md:p-5">
                                {signalMapperStep === 0 && (
                                  <div className="space-y-4">
                                    <p className="text-sm font-semibold text-[#edf5ff]">Customer Snapshot</p>
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-[#9eb3d1]">Customer Name</p>
                                      <Textarea
                                        value={signalMapperDraft.customerName}
                                        onChange={(event) => handleSignalMapperFieldChange('customerName', event.target.value)}
                                        className="min-h-14 border-[#2c3f5f] bg-[#081323] text-[#d9e3f5] placeholder:text-[#6f84a7]"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-[#9eb3d1]">Current Vehicle</p>
                                      <Textarea
                                        value={signalMapperDraft.currentVehicle}
                                        onChange={(event) => handleSignalMapperFieldChange('currentVehicle', event.target.value)}
                                        className="min-h-14 border-[#2c3f5f] bg-[#081323] text-[#d9e3f5] placeholder:text-[#6f84a7]"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-[#9eb3d1]">Emotional Tone</p>
                                      <Textarea
                                        value={signalMapperDraft.emotionalTone}
                                        onChange={(event) => handleSignalMapperFieldChange('emotionalTone', event.target.value)}
                                        className="min-h-14 border-[#2c3f5f] bg-[#081323] text-[#d9e3f5] placeholder:text-[#6f84a7]"
                                      />
                                    </div>
                                  </div>
                                )}

                                {signalMapperStep === 1 && (
                                  <div className="space-y-4">
                                    <p className="text-sm font-semibold text-[#edf5ff]">Signals</p>
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-[#9eb3d1]">What are they saying?</p>
                                      <Textarea
                                        value={signalMapperDraft.saying}
                                        onChange={(event) => handleSignalMapperFieldChange('saying', event.target.value)}
                                        className="min-h-20 border-[#2c3f5f] bg-[#081323] text-[#d9e3f5] placeholder:text-[#6f84a7]"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-[#9eb3d1]">What are they not saying?</p>
                                      <Textarea
                                        value={signalMapperDraft.unsaid}
                                        onChange={(event) => handleSignalMapperFieldChange('unsaid', event.target.value)}
                                        className="min-h-20 border-[#2c3f5f] bg-[#081323] text-[#d9e3f5] placeholder:text-[#6f84a7]"
                                      />
                                    </div>
                                  </div>
                                )}

                                {signalMapperStep === 2 && (
                                  <div className="space-y-4">
                                    <p className="text-sm font-semibold text-[#edf5ff]">Interpretation</p>
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-[#9eb3d1]">What's the real concern?</p>
                                      <Textarea
                                        value={signalMapperDraft.concern}
                                        onChange={(event) => handleSignalMapperFieldChange('concern', event.target.value)}
                                        className="min-h-20 border-[#2c3f5f] bg-[#081323] text-[#d9e3f5] placeholder:text-[#6f84a7]"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-[#9eb3d1]">What are they trying to solve?</p>
                                      <Textarea
                                        value={signalMapperDraft.solving}
                                        onChange={(event) => handleSignalMapperFieldChange('solving', event.target.value)}
                                        className="min-h-20 border-[#2c3f5f] bg-[#081323] text-[#d9e3f5] placeholder:text-[#6f84a7]"
                                      />
                                    </div>
                                  </div>
                                )}

                                {signalMapperStep === 3 && (
                                  <div className="space-y-4">
                                    <p className="text-sm font-semibold text-[#edf5ff]">Action Plan</p>
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-[#9eb3d1]">What should I show?</p>
                                      <Textarea
                                        value={signalMapperDraft.show}
                                        onChange={(event) => handleSignalMapperFieldChange('show', event.target.value)}
                                        className="min-h-20 border-[#2c3f5f] bg-[#081323] text-[#d9e3f5] placeholder:text-[#6f84a7]"
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <p className="text-xs font-medium text-[#9eb3d1]">What should I say next?</p>
                                      <Textarea
                                        value={signalMapperDraft.sayNext}
                                        onChange={(event) => handleSignalMapperFieldChange('sayNext', event.target.value)}
                                        className="min-h-20 border-[#2c3f5f] bg-[#081323] text-[#d9e3f5] placeholder:text-[#6f84a7]"
                                      />
                                    </div>
                                  </div>
                                )}

                                {signalMapperStep === 4 && (
                                  <div className="space-y-2">
                                    <p className="text-sm font-semibold text-[#edf5ff]">Wrap-Up</p>
                                    <p className="text-sm text-[#a7b7d1]">Your Working Notes</p>
                                    <Textarea
                                      value={signalMapperDraft.notes}
                                      onChange={(event) => handleSignalMapperFieldChange('notes', event.target.value)}
                                      placeholder="Capture extra context, objections, and wording that worked."
                                      className="min-h-28 border-[#2c3f5f] bg-[#081323] text-[#d9e3f5] placeholder:text-[#6f84a7]"
                                    />
                                  </div>
                                )}
                              </CardContent>
                            </Card>

                            <div className="sticky bottom-0 z-10 border-t border-[#223857] bg-[#0d192c]/95 p-3 backdrop-blur">
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  className="h-11 flex-1 border-[#2f445f] bg-transparent text-[#dbe7fb] hover:bg-[#1a2d49]"
                                  disabled={signalMapperStep === 0}
                                  onClick={() => goSignalMapperStep(-1)}
                                >
                                  Back
                                </Button>
                                {signalMapperStep < 4 ? (
                                  <Button
                                    className="h-11 flex-1 bg-[#172845] text-[#eaf2ff] hover:bg-[#22375a]"
                                    onClick={() => goSignalMapperStep(1)}
                                  >
                                    Next
                                  </Button>
                                ) : (
                                  <Button
                                    className="h-11 flex-1 bg-[#76ff8f] text-[#0d1d11] hover:bg-[#92ffa7]"
                                    onClick={handleSaveCurrentWork}
                                    disabled={isSavingEntry}
                                  >
                                    {isSavingEntry ? 'Saving...' : 'Save My Work'}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-[#f6fbff]">Your Working Notes</p>
                            <p className="text-sm text-[#a7b7d1]">Use this while you run the tool. Save it when you're ready.</p>

                            <Textarea
                              value={activeDraft}
                              onChange={(event) => handleDraftChange(activeTool.id, event.target.value)}
                              placeholder="Start building your playbook for this tool..."
                              className="min-h-40 border-[#2c3f5f] bg-[#0a1527] text-[#d9e3f5] placeholder:text-[#6f84a7]"
                            />
                          </>
                        )}

                        {activeTool.id !== 'signal-mapper' && (
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-[#f6fbff]">Don't lose your work.</p>
                              <p className="text-xs text-[#9db0cb]">
                                Create a free account to save your progress and come back anytime.
                              </p>
                            </div>

                            <Button
                              onClick={handleSaveCurrentWork}
                              disabled={isSavingEntry}
                              className="bg-[#76ff8f] font-semibold text-[#0d1d11] hover:bg-[#92ffa7]"
                            >
                              <Save className="mr-2 h-4 w-4" />
                              {isSavingEntry ? 'Saving...' : 'Save My Work'}
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {showSecondToolPrompt && !dismissedSecondToolPrompt && !isPaidUser && (
                    <Card className="border-[#2b3e5d] bg-[#101d31]">
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-[#dbe7fb]">Want access to every tool? Unlock the full toolbox.</p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="bg-[#172845] text-[#eaf2ff] hover:bg-[#22375a]" onClick={() => handleInlineUpgradeClick()}>
                            Unlock Full Access
                          </Button>
                          <Button size="sm" variant="ghost" className="text-[#9eb3d1] hover:bg-[#13233b]" onClick={() => setDismissedSecondToolPrompt(true)}>
                            Dismiss
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {activeTool && showFeaturedCompletionPrompt && !dismissedFeaturedCompletionPrompt && !isPaidUser && activeTool.id === featuredTool.id && (
                    <Card className="border-[#2b3e5d] bg-[#101d31]">
                      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-[#dbe7fb]">You've started building your system. Keep going.</p>
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="bg-[#172845] text-[#eaf2ff] hover:bg-[#22375a]" onClick={() => handleInlineUpgradeClick()}>
                            Unlock Full Access
                          </Button>
                          <Button size="sm" variant="ghost" className="text-[#9eb3d1] hover:bg-[#13233b]" onClick={() => setDismissedFeaturedCompletionPrompt(true)}>
                            Dismiss
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </section>
            )}
          </div>

          <section>
            <Card className="overflow-hidden border-[#263b5a] bg-[#0d192c]">
              <CardHeader className="border-b border-[#203352] bg-[#111f35]">
                <CardTitle className="flex items-center gap-2 text-lg text-[#edf5ff]">
                  <FolderOpen className="h-4 w-4 text-[#9eb3d1]" />
                  Your Saved Work
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5">
                {recentEntries.length === 0 ? (
                  <p className="text-sm text-[#a7b7d1]">Nothing saved yet. Start with this week's tool.</p>
                ) : (
                  <div className="space-y-3">
                    {recentEntries.map((entry) => {
                      const tool = tools.find((t) => t.id === entry.toolId);
                      return (
                        <div
                          key={entry.id}
                          className="flex flex-col gap-3 rounded-xl border border-[#2a3f5f] bg-[#0a1527] p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-[#e7f0ff]">{tool?.name || entry.toolId}</p>
                            <p className="text-xs text-[#9eb3d1]">Last edited {formatLastEdited(entry.createdAt)}</p>
                          </div>
                          <Button
                            size="sm"
                            className="bg-[#172845] text-[#eaf2ff] hover:bg-[#22375a]"
                            onClick={() => {
                              if (tool) setActiveTool(tool);
                              setDrafts((current) => ({ ...current, [entry.toolId]: entry.content }));
                            }}
                          >
                            Continue
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </main>

        <EmailGateModal
          open={showEmailGate}
          loading={isEmailSubmitting}
          defaultEmail={unlockEmail}
          onOpenChange={setShowEmailGate}
          onSubmit={handleUnlockByEmail}
        />

        <SaveAccountModal
          open={showSaveGate}
          email={unlockEmail}
          loading={isAccountSubmitting}
          onOpenChange={setShowSaveGate}
          onSubmit={handleCreateFreeAccount}
        />

        <UpgradeModal
          open={showUpgradeModal}
          loading={isUpgradeSubmitting}
          contextMessage={upgradeContextMessage}
          onOpenChange={(open) => {
            setShowUpgradeModal(open);
            if (!open) setUpgradeContextMessage(undefined);
          }}
          onUpgrade={handleUpgrade}
        />
      </div>
    </div>
  );
}

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
  clearTempDrafts,
  clearUnlockState,
  exportTempDraftsAsEntries,
  getTempDraft,
  readUnlockState,
  writeTempDraft,
  writeUnlockState,
} from '@/lib/tools/toolbox-storage';
import {
  captureToolboxUnlockEmail,
  createToolboxFreeAccount,
  fetchToolboxEntries,
  saveToolboxEntry,
  upgradeToolboxAccount,
} from '@/lib/tools/toolbox-client';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOOLBOX_DEFAULT_ROLE: UserRole = 'Sales Consultant';
const SECOND_TOOL_PROMPT_DELAY_MS = 6000;
const FEATURED_COMPLETION_DELAY_MS = 45000;

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
  const [forceProTier, setForceProTier] = useState(false);
  const [showAccountSuccess, setShowAccountSuccess] = useState(false);

  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [sessionOpenedToolIds, setSessionOpenedToolIds] = useState<string[]>([]);
  const [showSecondToolPrompt, setShowSecondToolPrompt] = useState(false);
  const [dismissedSecondToolPrompt, setDismissedSecondToolPrompt] = useState(false);
  const [showFeaturedCompletionPrompt, setShowFeaturedCompletionPrompt] = useState(false);
  const [dismissedFeaturedCompletionPrompt, setDismissedFeaturedCompletionPrompt] = useState(false);
  const [dismissedReturnBanner, setDismissedReturnBanner] = useState(false);

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
  }) || forceProTier;

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
      setForceProTier(false);
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
    if (!firebaseUser) {
      toast({ title: 'Sign in required', description: 'Sign in first to upgrade your toolbox access.' });
      return;
    }

    setIsUpgradeSubmitting(true);

    try {
      const idToken = await firebaseUser.getIdToken(true);
      const result = await upgradeToolboxAccount({ idToken });
      if (!result.ok) throw new Error(result.message);

      if (user) {
        setUser({
          ...user,
          tier: 'pro',
          toolAccessLevel: result.data.toolAccessLevel,
        });
      }
      setForceProTier(true);
      setShowUpgradeModal(false);
      setUpgradeContextMessage(undefined);

      toast({ title: 'Upgrade complete', description: 'All tools are now unlocked on this account.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upgrade failed',
        description: error?.message || 'Please try again.',
      });
    } finally {
      setIsUpgradeSubmitting(false);
    }
  }

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

          {activeTool && (
            <section className="grid gap-5">
              <Card className="overflow-hidden border-[#263b5a] bg-[#0d192c]">
                <CardHeader className="border-b border-[#203352] bg-[#111f35]">
                  <CardTitle className="flex items-center justify-between text-xl text-[#edf5ff]">
                    <span>{activeTool.name}</span>
                    {buildToolRoute(activeTool.id) && (
                      <Button asChild variant="outline" size="sm" className="border-[#2f445f] bg-transparent text-[#dbe7fb] hover:bg-[#1a2d49]">
                        <Link href={buildToolRoute(activeTool.id) || '#'}>
                          Open Full Tool
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 pt-5">
                  <p className="text-sm font-semibold text-[#f6fbff]">Your Working Notes</p>
                  <p className="text-sm text-[#a7b7d1]">Use this while you run the tool. Save it when you're ready.</p>

                  <Textarea
                    value={activeDraft}
                    onChange={(event) => handleDraftChange(activeTool.id, event.target.value)}
                    placeholder="Start building your playbook for this tool..."
                    className="min-h-40 border-[#2c3f5f] bg-[#0a1527] text-[#d9e3f5] placeholder:text-[#6f84a7]"
                  />

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
                </CardContent>
              </Card>

              {showFeaturedCompletionPrompt && !dismissedFeaturedCompletionPrompt && !isPaidUser && activeTool.id === featuredTool.id && (
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
            </section>
          )}

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

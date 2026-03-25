'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronDown, CheckCircle2, Clock, FolderOpen, HelpCircle, Lock, Save, SlidersHorizontal, Sparkles, Zap } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { EmailGateModal } from '@/components/tools/email-gate-modal';
import { UpgradeModal } from '@/components/tools/upgrade-modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useEntitlements } from '@/hooks/use-entitlements';
import { cn } from '@/lib/utils';
import { useThemeMode } from '@/context/theme-provider';
import { touchAttribution } from '@/lib/consultant-referral';
import './tools-theme.css';
import {
  canAccessTool,
  ctaForFeaturedTool,
  ctaForToolCard,
  getFeaturedTool,
  isRecentTool,
  TOOL_INTENT_OPTIONS,
  TOOLBOX_TOOLS,
  type ToolIntentTag,
  type ToolConfig,
  type ToolboxSavedEntry,
} from '@/lib/tools/toolbox';
import {
  listRecommendationEvents,
  trackRecommendationEvent,
  type RecommendationEvent,
  clearFullToolHandoff,
  clearTempDrafts,
  exportTempDraftsAsEntries,
  getTempDraft,
  writeFullToolHandoff,
  writeTempDraft,
} from '@/lib/tools/toolbox-storage';
import { FEATURES, resolvePaidAccess, type ToolboxCapturedRole, type ToolboxFeatureKey } from '@/lib/tools/entitlements';
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
  fetchToolboxEntitlements,
  fetchToolboxEntries,
  saveToolboxEntry,
  syncToolboxPaidStatus,
  trackRecommendationEventServer,
} from '@/lib/tools/toolbox-client';
import { getRecommendedTools } from '@/lib/tools/recommendation';
import { allRoles, type UserRole } from '@/lib/definitions';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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

function badgeText(label: 'Premium'): string {
  if (label === 'Premium') return 'Advanced';
  return label;
}

function ctaLabelForTool(tool: ToolConfig, canAccess: boolean): string {
  return 'Run Tool';
}

const TAG_ACCENT_COLORS: Record<string, string> = {
  'Fast Win': '#76ff8f', // Soft Green
  'High Impact': '#4dabf7', // Soft Blue
  'Stuck Deal Fix': '#ff6b6b', // Soft Red
  'Customer Saver': '#ff6b6b', // Map Customer Saver to Red
  'Manager Move': '#ae3ec9', // Soft Purple
  'Confidence Builder': '#15aabf', // Soft Teal
  'Momentum Booster': '#ff922b', // Soft Orange
};

function getToolAccentColor(tool: ToolConfig): string {
  const tag = getToolConfidenceTag(tool);
  return TAG_ACCENT_COLORS[tag] || '#76ff8f';
}

function buildToolRoute(toolId: string): string | null {
  if (toolId === 'pickup-experience-designer') return '/tools/pickup-experience-designer';
  if (toolId === 'repair-trust-builder') return '/tools/repair-trust-builder';
  if (toolId === 'wait-experience-coach') return '/tools/wait-experience-coach';
  if (toolId === 'pressure-drop-planner') return '/tools/pressure-drop-planner';
  if (toolId === 'clarity-check-builder') return '/tools/clarity-check-builder';
  if (toolId === 'first-impression-calibrator') return '/tools/first-impression-calibrator';
  if (toolId === 'consistency-gap-check') return '/tools/consistency-gap-check';
  if (toolId === 'inventory-substitution-guide') return '/tools/inventory-substitution-guide';
  if (toolId === 'special-order-confidence-builder') return '/tools/special-order-confidence-builder';
  if (toolId === 'parts-objection-defuser') return '/tools/parts-objection-defuser';
  if (toolId === 'mpi-conversation-designer') return '/tools/mpi-conversation-designer';
  if (toolId === 'upsell-timing-advisor') return '/tools/upsell-timing-advisor';
  if (toolId === 'waiter-update-flow') return '/tools/waiter-update-flow';
  if (toolId === 'be-back-conversion-planner') return '/tools/be-back-conversion-planner';
  if (toolId === 'walkaround-path-builder') return '/tools/walkaround-path-builder';
  if (toolId === 'payment-comfort-mapper') return '/tools/payment-comfort-mapper';
  if (toolId === 'buyer-temperature-tracker') return '/tools/buyer-temperature-tracker';
  if (toolId === 'gross-protection-strategist') return '/tools/gross-protection-strategist';
  if (toolId === 'team-coaching-converter') return '/tools/team-coaching-converter';
  if (toolId === 'desk-conversation') return '/tools/desk-conversation';
  if (toolId === 'declined-work-recovery') return '/tools/declined-work-recovery';
  if (toolId === 'status-update') return '/tools/status-update';
  if (toolId === 'repair-approval') return '/tools/repair-approval';
  if (toolId === 'test-drive-debrief') return '/tools/test-drive-debrief';
  if (toolId === 'trade-value-bridge') return '/tools/trade-value-bridge';
  if (toolId === 'commitment-ladder') return '/tools/commitment-ladder';
  if (toolId === 'next-move-engine') return '/tools/next-move-engine';
  if (toolId === 'objection-reframe') return '/tools/objection-reframe';
  if (toolId === 'follow-up-cadence') return '/tools/follow-up-cadence';
  if (toolId === 'handoff-script') return '/tools/handoff-script';
  if (toolId === 'deal-recovery') return '/tools/deal-recovery';
  if (toolId === 'loyalty-loop') return '/tools/loyalty-loop';
  if (toolId === 'signal-mapper') return '/tools/signal-mapper';
  if (toolId === 'price-presentation') return '/tools/price-presentation';
  if (toolId === 'consistency-leak-finder') return '/tools/consistency-leak-finder';
  return null;
}

const SCENARIO_GROUPS = [
  { label: 'Move deals forward', categories: ['Deal Flow'] },
  { label: 'Handle objections fast', categories: ['Objections'] },
  { label: 'Reconnect & recover deals', categories: ['Follow-Up'] },
  { label: 'Present numbers clearly', categories: ['Pricing'] },
  { label: 'Improve customer experience', categories: ['CX / Process'] },
  { label: 'Lead and coach your team', categories: ['Manager Tools'] },
] as const;

const QUICK_DIAGNOSIS_OPTIONS = [
  { label: 'Customer said "I need to think about it"', filter: 'Objections', description: 'Break the stall' },
  { label: 'Deal slowed down', filter: 'Deal Flow', description: 'Get the deal moving again' },
  { label: 'Objection came up', filter: 'Objections', description: 'Handle the objection' },
  { label: 'I’m presenting numbers', filter: 'Pricing', description: 'Present numbers cleanly' },
  { label: 'I need to follow up', filter: 'Follow-Up', description: 'Re-engage this customer' },
  { label: 'I don’t know what to do next', filter: 'all', description: 'Tell me what to do' },
] as const;

const TOOL_INTENT_ACTIONS: Record<ToolIntentTag, string> = {
  'Move a deal forward': 'Push this deal forward',
  'Handle an objection': 'Break through an objection',
  'Follow up': 'Reconnect with a customer',
  'Present numbers': 'Deliver numbers with confidence',
  'Recover a stalled deal': 'Revive a dead deal',
  'Improve consistency': 'Get more consistent',
  'Coach the team': 'Coach my team now',
};

const TOOL_CONTENT_UPGRADES: Record<string, { triggers: string[]; tag: string; authorityLabel: string; roleDescription: string; bestUsedWhen?: string[] }> = {
  'pickup-experience-designer': {
    bestUsedWhen: ['Delivery day is approaching', 'Customer feels unsure about next steps', 'You want to create a strong final impression'],
    triggers: ['Customer is asking "what happens next?"', 'Delivery feels rushed or unclear', 'You want to turn this into a referral moment'],
    tag: 'Confidence Builder',
    authorityLabel: 'Top Performer Move',
    roleDescription: 'Spotlight: Perfect Delivery'
  },
  'consistency-gap-check': {
    bestUsedWhen: ['Performance feels inconsistent across reps', 'Customer experience varies too much', 'You’re not sure where breakdowns are happening'],
    triggers: ['Reps are skipping steps', 'Customers ask the same questions twice', 'Follow-up feels uneven or unreliable'],
    tag: 'Stuck Deal Fix',
    authorityLabel: 'Most Likely Next Move',
    roleDescription: 'Behavior Diagnosis'
  },
  'team-coaching-converter': {
    bestUsedWhen: ['You observed a rep struggle in a live interaction', 'You need to turn a moment into a coaching opportunity', 'You want fast, actionable coaching'],
    triggers: ['A rep stumbled through an objection', 'A conversation felt flat or unclear', 'You’re not sure what feedback to give'],
    tag: 'Manager Move',
    authorityLabel: 'Performance Accelerator',
    roleDescription: 'Actionable Coaching'
  },
  'desk-conversation': {
    bestUsedWhen: ['You’re stepping into a deal mid-conversation', 'A deal is getting complex or stuck', 'You need a clear plan before engaging'],
    triggers: ['Customer is hesitating at numbers', 'Trade or financing is complicating the deal', 'Rep needs support closing'],
    tag: 'High Impact',
    authorityLabel: 'Best Next Step',
    roleDescription: 'Live Deal Support'
  },
  'repair-trust-builder': {
    triggers: ['Customer is skeptical of MPI', 'High repair estimate needs explaining', 'Building long-term loyalty'],
    tag: 'Stuck Deal Fix',
    authorityLabel: 'Most Likely Next Move',
    roleDescription: 'Trust Architecture'
  },
  'clarity-check-builder': {
    triggers: ['Paperwork is getting complex', 'Customer missed a detail in the contract', 'Verifying all terms are clear'],
    tag: 'Customer Saver',
    authorityLabel: 'Best Next Step',
    roleDescription: 'Clarity Audit'
  },
  'price-presentation': {
    triggers: ['First pencil is being delivered', 'Opening the gross discussion', 'Handling money questions early'],
    tag: 'Momentum Booster',
    authorityLabel: 'Top Performer Move',
    roleDescription: 'Premium Presentation'
  },
};

function getToolBestUsedWhen(tool: ToolConfig): string[] {
  return TOOL_CONTENT_UPGRADES[tool.id]?.bestUsedWhen || [tool.recommendedWhen[0] || 'Handling a deal move.'];
}

function getToolTriggers(tool: ToolConfig): string[] {
  return TOOL_CONTENT_UPGRADES[tool.id]?.triggers || [
    'Momentum has stalled',
    'Customer needs clarity',
    'Next steps are unclear',
  ];
}

function getToolConfidenceTag(tool: ToolConfig): string {
  if (TOOL_CONTENT_UPGRADES[tool.id]?.tag) return TOOL_CONTENT_UPGRADES[tool.id]!.tag;
  if (tool.access === 'premium') return 'High Impact';
  return 'Fast Win';
}

function getToolAuthorityLabel(tool: ToolConfig): string {
  return TOOL_CONTENT_UPGRADES[tool.id]?.authorityLabel || 'Best Next Step';
}

function getToolRoleDescription(tool: ToolConfig): string {
  return TOOL_CONTENT_UPGRADES[tool.id]?.roleDescription || 'Optimization Tool';
}

export default function ToolsPage() {
  const { toast } = useToast();
  const { user, firebaseUser, loading, setUser } = useAuth();
  const { resolvedTheme } = useThemeMode();
  const [activeTool, setActiveTool] = useState<ToolConfig | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [recentEntries, setRecentEntries] = useState<ToolboxSavedEntry[]>([]);

  const [showEmailGate, setShowEmailGate] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [, setPendingGateFeature] = useState<ToolboxFeatureKey | null>(null);
  const [pendingToolToOpen, setPendingToolToOpen] = useState<ToolConfig | null>(null);

  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [isUpgradeSubmitting, setIsUpgradeSubmitting] = useState(false);
  const [isSavingEntry, setIsSavingEntry] = useState(false);
  const [didAuthBootstrap, setDidAuthBootstrap] = useState(false);
  const [showAccountSuccess, setShowAccountSuccess] = useState(false);
  const [sprocketLayerOutput, setSprocketLayerOutput] = useState<null | {
    diagnosis: string;
    rewrite: string;
    nextSteps: string[];
    coaching: string;
    prioritization: string;
  }>(null);
  const [cxLayerOutput, setCxLayerOutput] = useState<null | {
    insight: string;
    personalization: string;
    focus: string[];
  }>(null);
  const [isRunningSprocketLayer, setIsRunningSprocketLayer] = useState(false);
  const [isRunningCxLayer, setIsRunningCxLayer] = useState(false);

  const [upgradeContextMessage, setUpgradeContextMessage] = useState<string | undefined>(undefined);
  const [sessionOpenedToolIds, setSessionOpenedToolIds] = useState<string[]>([]);
  const [showSecondToolPrompt, setShowSecondToolPrompt] = useState(false);
  const [dismissedSecondToolPrompt, setDismissedSecondToolPrompt] = useState(false);
  const [showFeaturedCompletionPrompt, setShowFeaturedCompletionPrompt] = useState(false);
  const [dismissedFeaturedCompletionPrompt, setDismissedFeaturedCompletionPrompt] = useState(false);
  const [dismissedReturnBanner, setDismissedReturnBanner] = useState(false);
  const [recommendationEvents, setRecommendationEvents] = useState<RecommendationEvent[]>([]);
  const [recommendationRefresh, setRecommendationRefresh] = useState(0);
  const shownRecommendationIdsRef = useRef<Set<string>>(new Set());
  const previousRecommendationIdsRef = useRef<string[]>([]);
  const interactedRecommendationIdsRef = useRef<Set<string>>(new Set());

  const [didTouchRoleFilter, setDidTouchRoleFilter] = useState(false);
  const [selectedIntentFilter, setSelectedIntentFilter] = useState<ToolIntentTag | null>(null);
  const [isDesktopFilterUI, setIsDesktopFilterUI] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [appliedAccessFilter, setAppliedAccessFilter] = useState<'available' | 'all' | 'free' | 'premium'>('available');
  const [appliedCategoryFilters, setAppliedCategoryFilters] = useState<Array<'Deal Flow' | 'Objections' | 'Follow-Up' | 'Pricing' | 'CX / Process' | 'Manager Tools'>>([]);
  const [appliedRoleFilter, setAppliedRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [appliedSortBy, setAppliedSortBy] = useState<'recommended' | 'recent' | 'popular'>('recommended');
  const [draftAccessFilter, setDraftAccessFilter] = useState<'available' | 'all' | 'free' | 'premium'>('available');
  const [draftCategoryFilters, setDraftCategoryFilters] = useState<Array<'Deal Flow' | 'Objections' | 'Follow-Up' | 'Pricing' | 'CX / Process' | 'Manager Tools'>>([]);
  const [draftRoleFilter, setDraftRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [draftSortBy, setDraftSortBy] = useState<'recommended' | 'recent' | 'popular'>('recommended');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAllToolsExpanded, setIsAllToolsExpanded] = useState(false);
  const [diagnosisFeedback, setDiagnosisFeedback] = useState<string | null>(null);
  const categoryFilters: Array<'Deal Flow' | 'Objections' | 'Follow-Up' | 'Pricing' | 'CX / Process' | 'Manager Tools'> = [
    'Deal Flow', 'Objections', 'Follow-Up', 'Pricing', 'CX / Process', 'Manager Tools',
  ];

  const tools = TOOLBOX_TOOLS;
  const featuredTool = useMemo(() => getFeaturedTool(tools), [tools]);
  const isAuthenticated = !!firebaseUser;
  const isPaidUser = resolvePaidAccess({
    tier: user?.tier,
    subscriptionStatus: user?.subscriptionStatus,
  });
  const hasAutoDriveCX = Boolean(user?.hasAutoDriveCX);

  const {
    entitlements,
    setServerEntitlements,
    accountProfile,
    usedToolIds,
    setLocalAccountProfile,
    registerToolUsage,
    clearLocalEntitlements,
    refreshLocalEntitlements,
    checkFeature,
  } = useEntitlements({
    isAuthenticated,
    hasPaidAccess: isPaidUser,
    hasAutoDriveCX,
  });

  const unlockedToolCount = useMemo(
    () => (entitlements.hasAccount ? tools.length : Math.min(3, tools.length)),
    [entitlements.hasAccount, tools.length]
  );

  const visibleTools = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = tools.filter((tool) => {
      const isToolAvailable = canOpenTool(tool);
      if (appliedAccessFilter === 'available' && !isToolAvailable) return false;
      if (appliedAccessFilter === 'free' && tool.access !== 'free') return false;
      if (appliedAccessFilter === 'premium' && tool.access !== 'premium') return false;

      if (appliedCategoryFilters.length > 0 && !(appliedCategoryFilters as any[]).includes(tool.category)) return false;

      if (appliedRoleFilter !== 'ALL') {
        const roleMatch = tool.primaryRoles.includes(appliedRoleFilter) || tool.secondaryRoles.includes(appliedRoleFilter);
        if (!roleMatch) return false;
      }

      if (selectedIntentFilter && !tool.intentTags.includes(selectedIntentFilter)) return false;

      if (!normalizedQuery) return true;
      const searchCorpus = [
        tool.name,
        tool.title,
        tool.description,
        tool.category,
        ...tool.skillTags,
        ...tool.intentTags,
        ...tool.recommendedWhen,
      ].join(' ').toLowerCase();

      return searchCorpus.includes(normalizedQuery);
    });

    if (appliedRoleFilter === 'ALL') return filtered;

    return [...filtered].sort((a, b) => {
      const aPrimary = a.primaryRoles.includes(appliedRoleFilter) ? 1 : 0;
      const bPrimary = b.primaryRoles.includes(appliedRoleFilter) ? 1 : 0;
      return bPrimary - aPrimary;
    });
  }, [appliedAccessFilter, appliedCategoryFilters, appliedRoleFilter, searchQuery, selectedIntentFilter, tools]);

  const displayName = (user?.name || '').trim().split(/\s+/)[0] || (user?.email || '');
  const featuredCta = ctaForFeaturedTool();
  const activeDraft = activeTool ? drafts[activeTool.id] || '' : '';
  const signalMapperDraft = useMemo(
    () => parseSignalMapperMicroDraft(activeDraft),
    [activeDraft]
  );
  const activeToolId = activeTool?.id ?? null;
  const isWorkspaceMode = !!activeToolId;
  const isConsistencyWorkspace = activeToolId === 'consistency-leak-finder';
  const embeddedTheme = resolvedTheme === 'light' ? 'light' : 'dark';
  const accountEmail = accountProfile?.email || '';
  const accountRole = accountProfile?.role || 'Sales Consultant';
  const historyGate = checkFeature(FEATURES.HISTORY);
  const showReturnVisitBanner = isAuthenticated && !isPaidUser && recentEntries.length > 0 && !dismissedReturnBanner;

  const accessibleToolIds = useMemo(() => {
    return tools
      .filter((tool) => {
        if (canAccessTool(entitlements)) return true;
        return !entitlements.hasAccount && usedToolIds.includes(tool.id);
      })
      .map((tool) => tool.id);
  }, [entitlements, tools, usedToolIds]);

  const recommendationResult = useMemo(() => {
    const completedIds = Array.from(new Set(recentEntries.map((entry) => entry.toolId)));
    const openedIds = sessionOpenedToolIds.length > 0 ? sessionOpenedToolIds : usedToolIds;
    const lastOpenedTool = [...openedIds].reverse().find((toolId) => tools.some((tool) => tool.id === toolId));
    const lastCategoryUsed = tools.find((tool) => tool.id === lastOpenedTool)?.category || null;

    return getRecommendedTools({
      tools,
      accessibleToolIds,
      hasAccount: entitlements.hasAccount,
      hasAutoDriveCX: entitlements.hasAutoDriveCX,
      role: (user?.role || accountProfile?.role || null),
      selectedIntent: selectedIntentFilter,
      recentOpenedToolIds: openedIds,
      recentCompletedToolIds: completedIds,
      savedToolIds: completedIds,
      lastCategoryUsed,
      cxSignals: hasAutoDriveCX ? {
        skillGaps: [
          ...(Number(user?.stats?.trust ?? 0) > 0 && Number(user?.stats?.trust ?? 0) < 60 ? ['trust'] : []),
          ...(Number(user?.stats?.listening ?? 0) > 0 && Number(user?.stats?.listening ?? 0) < 60 ? ['listening'] : []),
          ...(Number(user?.stats?.followUp ?? 0) > 0 && Number(user?.stats?.followUp ?? 0) < 60 ? ['follow-up'] : []),
          ...(Number(user?.stats?.closing ?? 0) > 0 && Number(user?.stats?.closing ?? 0) < 60 ? ['closing'] : []),
        ],
        coachingSignals: [],
        performanceWeaknesses: [],
      } : null,
      recommendationEvents,
    });
  }, [accessibleToolIds, accountProfile?.role, entitlements.hasAccount, entitlements.hasAutoDriveCX, hasAutoDriveCX, recentEntries, recommendationEvents, selectedIntentFilter, sessionOpenedToolIds, tools, usedToolIds, user?.role, user?.stats?.closing, user?.stats?.followUp, user?.stats?.listening, user?.stats?.trust]);

  const recommendedPrimaryTool = useMemo(
    () => tools.find((tool) => tool.id === recommendationResult.recommendations[0]?.toolId) || null,
    [recommendationResult.recommendations, tools]
  );
  const recommendedSecondaryTools = useMemo(
    () => recommendationResult.recommendations.slice(1).map((row) => ({
      recommendation: row,
      tool: tools.find((tool) => tool.id === row.toolId) || null,
    })).filter((row) => !!row.tool),
    [recommendationResult.recommendations, tools]
  );
  const recommendedToolIdSet = useMemo(
    () => new Set(recommendationResult.recommendations.map((row) => row.toolId)),
    [recommendationResult.recommendations]
  );
  const gridTools = useMemo(() => {
    const byRecommendation = (a: ToolConfig, b: ToolConfig) => {
      const aRecommended = recommendedToolIdSet.has(a.id) ? 1 : 0;
      const bRecommended = recommendedToolIdSet.has(b.id) ? 1 : 0;
      return bRecommended - aRecommended;
    };

    const byRecency = (a: ToolConfig, b: ToolConfig) => {
      const aRecent = isRecentTool(a, tools, 4) ? 1 : 0;
      const bRecent = isRecentTool(b, tools, 4) ? 1 : 0;
      if (aRecent !== bRecent) return bRecent - aRecent;
      return byRecommendation(a, b);
    };

    const byPopularity = (a: ToolConfig, b: ToolConfig) => {
      const aPopularity = (a.recommendedWhen?.length || 0) + (a.skillTags?.length || 0);
      const bPopularity = (b.recommendedWhen?.length || 0) + (b.skillTags?.length || 0);
      if (aPopularity !== bPopularity) return bPopularity - aPopularity;
      return byRecommendation(a, b);
    };

    const sorted = [...visibleTools];
    if (appliedSortBy === 'recent') return sorted.sort(byRecency);
    if (appliedSortBy === 'popular') return sorted.sort(byPopularity);
    return sorted.sort(byRecommendation);
  }, [appliedSortBy, recommendedToolIdSet, tools, visibleTools]);

  const useRightNowTools = useMemo(() => {
    const list = [
      featuredTool,
      recommendedPrimaryTool,
      ...recommendedSecondaryTools.slice(0, 2).map((r) => r.tool),
    ].filter((t): t is ToolConfig => !!t);
    const seen = new Set<string>();
    return list.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    }).slice(0, 4);
  }, [featuredTool, recommendedPrimaryTool, recommendedSecondaryTools]);

  const recentToolNameForReason = useMemo(() => {
    const recentId = [...sessionOpenedToolIds, ...usedToolIds].reverse().find((id) => tools.some((tool) => tool.id === id));
    return recentId ? (tools.find((tool) => tool.id === recentId)?.name || null) : null;
  }, [sessionOpenedToolIds, usedToolIds, tools]);

  function formatRecommendationReason(
    recommendation: (typeof recommendationResult.recommendations)[number],
    slot: 'primary' | 'backup1' | 'backup2'
  ): string {
    const roleLabel = (user?.role || accountRole || 'Sales Consultant') === 'manager'
      ? 'Sales Manager'
      : (user?.role || accountRole || 'Sales Consultant');
    const intentLabel = selectedIntentFilter ? selectedIntentFilter.toLowerCase() : null;
    if (slot === 'primary') {
      if (intentLabel) return `Built for ${roleLabel}s handling ${intentLabel}.`;
      return `Built for ${roleLabel} workflows that need clearer next steps.`;
    }

    if (slot === 'backup1') {
      if (recentToolNameForReason) return `Strong next step after ${recentToolNameForReason}.`;
      return 'Builds naturally on your recent tool activity.';
    }

    if (intentLabel) return `Useful when teams need support around ${intentLabel}.`;
    return 'Helps recover momentum when deals stall.';
  }


  useEffect(() => {
    const initialDrafts: Record<string, string> = {};
    tools.forEach((tool) => {
      const draft = getTempDraft(tool.id);
      if (draft) initialDrafts[tool.id] = draft;
    });
    setDrafts(initialDrafts);
  }, [tools]);

  useEffect(() => {
    setRecommendationEvents(listRecommendationEvents());
  }, []);

  useEffect(() => {
    if (didTouchRoleFilter) return;
    const defaultRole = user?.role || accountProfile?.role;
    if (!defaultRole) return;
    setAppliedRoleFilter(defaultRole);
    setDraftRoleFilter(defaultRole);
  }, [accountProfile?.role, didTouchRoleFilter, user?.role]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncLayout = () => setIsDesktopFilterUI(window.matchMedia('(min-width: 768px)').matches);
    syncLayout();
    window.addEventListener('resize', syncLayout);
    return () => window.removeEventListener('resize', syncLayout);
  }, []);

  useEffect(() => {
    async function loadEntries() {
      const historyGate = checkFeature(FEATURES.HISTORY);
      if (!firebaseUser || !historyGate.allowed) {
        setRecentEntries([]);
        return;
      }

      const idToken = await firebaseUser.getIdToken();
      const result = await fetchToolboxEntries({ idToken, limit: 12 });
      if (result.ok) {
        setRecentEntries(result.data.entries);
      } else {
        setRecentEntries([]);
      }
    }

    void loadEntries();
  }, [checkFeature, firebaseUser, user?.tier, user?.subscriptionStatus]);

  useEffect(() => {
    async function bootstrapAuthenticatedUser() {
      if (!firebaseUser || didAuthBootstrap) return;

      const localEntries = exportTempDraftsAsEntries();
      const hasLocalAccount = !!accountProfile;
      const hasLocalUsage = entitlements.usage.toolsUsedCount > 0;
      if (!localEntries.length && !hasLocalAccount && !hasLocalUsage) {
        setDidAuthBootstrap(true);
        return;
      }

      const idToken = await firebaseUser.getIdToken();
      const result = await createToolboxFreeAccount({
        idToken,
        localEntries,
        toolsUsedCount: entitlements.usage.toolsUsedCount,
        accountProfile,
      });

      if (result.ok) {
        if (result.data.entitlements) {
          setServerEntitlements(result.data.entitlements);
        }
        clearTempDrafts();
        clearLocalEntitlements();
        setShowAccountSuccess(true);
      }

      setDidAuthBootstrap(true);
    }

    void bootstrapAuthenticatedUser();
  }, [accountProfile, clearLocalEntitlements, didAuthBootstrap, entitlements.usage.toolsUsedCount, firebaseUser, setServerEntitlements]);

  useEffect(() => {
    async function hydrateServerEntitlements() {
      if (!firebaseUser) return;
      const idToken = await firebaseUser.getIdToken();
      const result = await fetchToolboxEntitlements({ idToken });
      if (!result.ok) return;
      setServerEntitlements(result.data.entitlements);
    }

    void hydrateServerEntitlements();
  }, [firebaseUser, setServerEntitlements, user?.tier, user?.subscriptionStatus, user?.hasAutoDriveCX]);

  useEffect(() => {
    if (!firebaseUser) {
      setDidAuthBootstrap(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    if (isPaidUser || dismissedSecondToolPrompt || showSecondToolPrompt) return;
    if (!entitlements.hasAccount) return;
    if (sessionOpenedToolIds.length < 2) return;

    const timer = window.setTimeout(() => {
      setShowSecondToolPrompt(true);
    }, SECOND_TOOL_PROMPT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [dismissedSecondToolPrompt, entitlements.hasAccount, isPaidUser, sessionOpenedToolIds.length, showSecondToolPrompt]);

  useEffect(() => {
    if (isPaidUser || dismissedFeaturedCompletionPrompt || showFeaturedCompletionPrompt) return;
    if (!activeTool || activeTool.id !== featuredTool.id) return;

    const timer = window.setTimeout(() => {
      setShowFeaturedCompletionPrompt(true);
    }, FEATURED_COMPLETION_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [activeTool, dismissedFeaturedCompletionPrompt, featuredTool.id, isPaidUser, showFeaturedCompletionPrompt]);

  useEffect(() => {
    setSprocketLayerOutput(null);
    setCxLayerOutput(null);
  }, [activeToolId]);

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

  async function logRecommendationEvent(
    type: 'recommended_tool_shown' | 'recommended_tool_clicked' | 'recommended_tool_dismissed' | 'recommended_tool_ignored',
    toolId: string,
    metadata?: Record<string, string | number | boolean>
  ) {
    const localEvent = trackRecommendationEvent({
      type,
      toolId,
      role: user?.role || accountRole,
      mode: recommendationResult.mode,
      intent: selectedIntentFilter || undefined,
      metadata,
    });
    if (localEvent) {
      setRecommendationEvents((current) => [...current, localEvent].slice(-300));
    }

    if (!firebaseUser) return;
    const idToken = await firebaseUser.getIdToken();
    await trackRecommendationEventServer({
      idToken,
      type,
      toolId,
      role: user?.role || accountRole,
      mode: recommendationResult.mode,
      intent: selectedIntentFilter || undefined,
      metadata,
      createdAt: localEvent?.createdAt,
    });
  }

  useEffect(() => {
    const currentIds = recommendationResult.recommendations.map((row) => row.toolId);
    if (!currentIds.length) return;

    const previousIds = previousRecommendationIdsRef.current;
    previousIds.forEach((toolId) => {
      if (!currentIds.includes(toolId) && !interactedRecommendationIdsRef.current.has(toolId)) {
        void logRecommendationEvent('recommended_tool_ignored', toolId, { source: 'recommendation_rotation' });
      }
    });

    recommendationResult.recommendations.forEach((row, index) => {
      const key = `${row.toolId}:${recommendationResult.mode}:${selectedIntentFilter || 'none'}`;
      if (shownRecommendationIdsRef.current.has(key)) return;
      shownRecommendationIdsRef.current.add(key);
      void logRecommendationEvent('recommended_tool_shown', row.toolId, { rank: index + 1, score: row.score });
    });

    previousRecommendationIdsRef.current = currentIds;
  }, [recommendationRefresh, recommendationResult, selectedIntentFilter]);

  function openTool(tool: ToolConfig) {
    setActiveTool(tool);
    setSessionOpenedToolIds((current) => (current.includes(tool.id) ? current : [...current, tool.id]));
    registerToolUsage(tool.id);
  }

  function openToolExperience(tool: ToolConfig) {
    const route = buildToolRoute(tool.id);
    if (route) {
      registerToolUsage(tool.id);
      window.location.assign(route);
      return;
    }

    openTool(tool);
  }

  function canOpenTool(tool: ToolConfig): boolean {
    if (canAccessTool(entitlements)) return true;
    return !entitlements.hasAccount && usedToolIds.includes(tool.id);
  }

  function requireFeature(feature: ToolboxFeatureKey, contextMessage?: string, pendingTool?: ToolConfig): boolean {
    const gate = checkFeature(feature);
    if (gate.allowed) return true;

    if (gate.gate === 'account') {
      setPendingGateFeature(feature);
      if (pendingTool) setPendingToolToOpen(pendingTool);
      setShowEmailGate(true);
      return false;
    }

    setPendingGateFeature(feature);
    setUpgradeContextMessage(contextMessage || gate.message);
    setShowUpgradeModal(true);
    return false;
  }

  function maybeOpenTool(tool: ToolConfig) {
    if (!canOpenTool(tool)) {
      requireFeature(FEATURES.TOOL_ACCESS, undefined, tool);
      return;
    }

    openToolExperience(tool);
  }

  function openRecommendedTool(tool: ToolConfig) {
    interactedRecommendationIdsRef.current.add(tool.id);
    const rec = recommendationResult.recommendations.find((row) => row.toolId === tool.id);
    void logRecommendationEvent('recommended_tool_clicked', tool.id, { score: rec?.score || 0 });
    setRecommendationRefresh((current) => current + 1);
    maybeOpenTool(tool);
  }

  function dismissRecommendedTool(toolId: string) {
    interactedRecommendationIdsRef.current.add(toolId);
    void logRecommendationEvent('recommended_tool_dismissed', toolId, { source: 'tool_shop_recommendation_card' });
    setRecommendationRefresh((current) => current + 1);
  }

  function handleOpenFiltersPanel(nextOpen: boolean) {
    setIsFilterPanelOpen(nextOpen);
    if (!nextOpen) return;
    setDraftAccessFilter(appliedAccessFilter);
    setDraftCategoryFilters(appliedCategoryFilters);
    setDraftRoleFilter(appliedRoleFilter);
    setDraftSortBy(appliedSortBy);
  }

  function handleApplyFilters() {
    setAppliedAccessFilter(draftAccessFilter);
    setAppliedCategoryFilters(draftCategoryFilters);
    setAppliedRoleFilter(draftRoleFilter);
    setAppliedSortBy(draftSortBy);
    if (draftRoleFilter !== 'ALL') {
      setDidTouchRoleFilter(true);
    }
    setIsFilterPanelOpen(false);
  }

  function handleClearFilters() {
    const defaultRole = (user?.role || accountProfile?.role || 'ALL') as UserRole | 'ALL';
    setDraftAccessFilter('available');
    setDraftCategoryFilters([]);
    setDraftRoleFilter(defaultRole);
    setDraftSortBy('recommended');
    setAppliedAccessFilter('available');
    setAppliedCategoryFilters([]);
    setAppliedRoleFilter(defaultRole);
    setAppliedSortBy('recommended');
    setDidTouchRoleFilter(false);
    setSelectedIntentFilter(null);
    setSearchQuery('');
    setIsFilterPanelOpen(false);
  }

  function toggleDraftCategory(category: 'Deal Flow' | 'Objections' | 'Follow-Up' | 'Pricing' | 'CX / Process' | 'Manager Tools') {
    setDraftCategoryFilters((current) => (
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    ));
  }

  function handleInlineUpgradeClick(context?: string) {
    requireFeature(FEATURES.SPROCKET, context);
  }

  async function handleUnlockByEmail(input: { email: string; role: ToolboxCapturedRole }) {
    const email = input.email.trim().toLowerCase();
    if (!emailRegex.test(email)) {
      toast({ variant: 'destructive', title: 'Enter a valid email' });
      return;
    }

    setIsEmailSubmitting(true);
    const captureResult = await captureToolboxUnlockEmail({ email, role: input.role });
    if (!captureResult.ok) {
      console.warn('[Toolbox] unlock email capture failed:', captureResult.message);
    }

    setLocalAccountProfile({ email, role: input.role });
    refreshLocalEntitlements();
    setShowEmailGate(false);
    touchAttribution('medium', 'email_role_captured');

    const queuedTool = pendingToolToOpen;
    setPendingToolToOpen(null);
    setPendingGateFeature(null);
    if (queuedTool) {
      openToolExperience(queuedTool);
    } else if (!activeTool) {
      openToolExperience(featuredTool);
    }

    setIsEmailSubmitting(false);

    toast({
      title: 'Account captured',
      description: 'You now have unlimited standalone tool access.',
    });
  }

  async function handleUpgrade() {
    if (isPaidUser) {
      setShowUpgradeModal(false);
      return;
    }

    console.info('[Toolbox] unlock_click', { source: 'upgrade_modal', state: entitlements });
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
      if (result.data.entitlements) {
        setServerEntitlements(result.data.entitlements);
      }

      if (user) {
        setUser({
          ...user,
          tier: result.data.tier,
          toolAccessLevel: result.data.toolAccessLevel,
        });
      }

      console.info('[Toolbox] upgrade_confirmed', { entitlements });
      setShowUpgradeModal(false);
      setUpgradeContextMessage(undefined);
      toast({ title: 'Upgrade complete', description: 'All tools are now unlocked on this account.' });
    }

    console.info('[Toolbox] paywall_open', { entitlements });
    void syncPaidStatus();
    const interval = window.setInterval(() => {
      void syncPaidStatus();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [entitlements, firebaseUser, isPaidUser, setServerEntitlements, showUpgradeModal, toast, user, setUser]);

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

    if (!requireFeature(FEATURES.CLOUD_SAVE)) {
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

      if (result.code === 'SAVE_LIMIT' || result.code === 'PAYMENT_REQUIRED') {
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

    if (!entitlements.hasPaidAccess) {
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
    } else {
      writeFullToolHandoff(tool.id, {
        source: 'tools_micro',
        draft: drafts[tool.id] || '',
      });
    }
  }

  function buildSprocketLayerOutput(input: string) {
    const normalized = input.trim();
    const lowConfidence = /(maybe|not sure|i think|probably|guess)/i.test(normalized);
    const priceFriction = /(price|payment|budget|cost)/i.test(normalized);
    const trustFriction = /(trust|concern|hesitat|nervous|unsure)/i.test(normalized);

    const diagnosis = trustFriction
      ? 'Trust friction is the main blocker. The customer language suggests low certainty before commitment.'
      : priceFriction
        ? 'Price framing is the blocker. The message needs stronger value sequencing before numbers.'
        : 'Clarity is the blocker. The next step needs to be explicit and time-bound.';

    const rewrite = lowConfidence
      ? 'Based on what matters most to you, here is the clearest next step: we will review your top priority first, then confirm if this solves it before moving forward.'
      : 'Here is the next step: we align on your top priority, confirm fit, then move to the simplest path forward.';

    return {
      diagnosis,
      rewrite,
      nextSteps: [
        'Confirm the customer priority in one sentence.',
        'Ask for agreement before moving to details.',
        'Set one explicit time-bound follow-up.',
      ],
      coaching: 'Lead with clarity, then confirmation, then commitment. Avoid jumping to details before alignment.',
      prioritization: trustFriction ? 'Priority: trust -> clarity -> close' : 'Priority: clarity -> value -> close',
    };
  }

  function buildCxLayerOutput(input: string) {
    const normalized = input.trim().toLowerCase();
    const followUpGap = /(follow|later|tomorrow|next week)/.test(normalized);
    const listeningGap = /(i told|already said|again)/.test(normalized);

    return {
      insight: followUpGap
        ? 'Pattern trend: follow-up timing drift is reducing momentum.'
        : 'Pattern trend: next-step clarity is the highest leverage behavior.',
      personalization: listeningGap
        ? 'Personalized coaching: mirror customer language once before advancing the conversation.'
        : 'Personalized coaching: tighten next-step statements to one action and one time.',
      focus: [
        followUpGap ? 'Follow-up reliability' : 'Next-step precision',
        listeningGap ? 'Listening effectiveness' : 'Tone and pacing consistency',
        'Trust-building micro-commitments',
      ],
    };
  }

  async function handleRunSprocketLayer() {
    if (!requireFeature(FEATURES.SPROCKET, 'Unlock Sprocket to enhance this output.')) return;
    const source = activeDraft.trim();
    if (!source) {
      toast({ variant: 'destructive', title: 'Add notes first', description: 'Capture a few lines before running Sprocket.' });
      return;
    }

    setIsRunningSprocketLayer(true);
    setTimeout(() => {
      setSprocketLayerOutput(buildSprocketLayerOutput(source));
      setIsRunningSprocketLayer(false);
    }, 350);
  }

  async function handleRunAutoDriveCxLayer() {
    if (!requireFeature(FEATURES.AUTODRIVE_CX, 'Upgrade to AutoDriveCX for personalized coaching insights.')) return;
    const source = activeDraft.trim();
    if (!source) {
      toast({ variant: 'destructive', title: 'Add notes first', description: 'Capture a few lines before running AutoDriveCX insights.' });
      return;
    }

    setIsRunningCxLayer(true);
    setTimeout(() => {
      setCxLayerOutput(buildCxLayerOutput(source));
      setIsRunningCxLayer(false);
    }, 350);
  }

  const filterPanelContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#90a8cc]">Access</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'available', label: 'Available' },
            { value: 'all', label: 'All' },
            { value: 'free', label: 'Free Only' },
            { value: 'premium', label: 'Premium Only' },
          ] as const).map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setDraftAccessFilter(entry.value)}
              className={cn(
                'rounded-md border px-3 py-2 text-xs font-semibold',
                draftAccessFilter === entry.value
                  ? 'border-[#76ff8f]/45 bg-[#76ff8f]/12 text-[#b4ffbf]'
                  : 'border-[#2c3e5c] bg-[#0f1a2d] text-[#a4b6d2]'
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#90a8cc]">Category</p>
        <div className="flex flex-wrap gap-2">
          {categoryFilters.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => toggleDraftCategory(category)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[11px] font-semibold',
                draftCategoryFilters.includes(category)
                  ? 'border-[#76ff8f]/45 bg-[#76ff8f]/12 text-[#b4ffbf]'
                  : 'border-[#2c3e5c] bg-[#0f1a2d] text-[#a4b6d2]'
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#90a8cc]">Role</p>
        <Select value={draftRoleFilter} onValueChange={(value) => setDraftRoleFilter(value as UserRole | 'ALL')}>
          <SelectTrigger className="h-9 border-[#2c3e5c] bg-[#0f1a2d] text-[#eaf2ff]">
            <span className="text-xs">
              {draftRoleFilter === 'ALL' ? 'All Roles' : draftRoleFilter === 'manager' ? 'Sales Manager' : draftRoleFilter}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            {allRoles.map((role) => (
              <SelectItem key={role} value={role}>
                {role === 'manager' ? 'Sales Manager' : role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#90a8cc]">Sort</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: 'recommended', label: 'Recommended' },
            { value: 'recent', label: 'Recent' },
            { value: 'popular', label: 'Popular' },
          ] as const).map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setDraftSortBy(entry.value)}
              className={cn(
                'rounded-md border px-2 py-2 text-[11px] font-semibold',
                draftSortBy === entry.value
                  ? 'border-[#76ff8f]/45 bg-[#76ff8f]/12 text-[#b4ffbf]'
                  : 'border-[#2c3e5c] bg-[#0f1a2d] text-[#a4b6d2]'
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <Button type="button" variant="ghost" className="text-[#9eb3d1] hover:bg-[#13233b]" onClick={handleClearFilters}>
          Clear
        </Button>
        <Button type="button" className="bg-[#76ff8f] text-[#0d1d11] hover:bg-[#92ffa7]" onClick={handleApplyFilters}>
          Apply
        </Button>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'relative min-h-screen overflow-hidden bg-[#070d18] pb-24 text-[#d9e3f5]',
        resolvedTheme === 'light' && 'tools-theme-light'
      )}
    >
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

        <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:space-y-8 md:p-6 lg:p-8">
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#76ff8f]/30 bg-[#111b2d] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9bffac]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#76ff8f]" />
                New tool drops every week
              </div>
            </div>

            <div className="space-y-1">
              {!loading && user && (
                <p className="text-xs font-medium text-[#c8d8f1]">Welcome back{displayName ? `, ${displayName}` : ''}.</p>
              )}
              <h1 className="text-2xl font-semibold tracking-tight text-[#f6fbff] md:text-4xl">
                Build a CX system you actually use.
              </h1>
              <p className="text-sm text-[#9db0cb]">
                Not sure what to do next? <span className="text-[#9bffac] font-medium">Start here.</span>
              </p>
              <p className="text-[11px] text-[#6f84a7] font-medium leading-none">
                Pick a situation, we’ll guide the next move.
              </p>
            </div>

            {/* QUICK DIAGNOSIS BAR */}
            <div className="rounded-xl border border-[#2b3e5d] bg-[#0c1729]/80 p-1 backdrop-blur shadow-xl">
              <div className="flex flex-col gap-1 p-2">
                <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-[#6f84a7]">
                  What’s happening right now?
                </p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {QUICK_DIAGNOSIS_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => {
                        const categories = categoryFilters as string[];
                        if (opt.filter !== 'all' && categories.includes(opt.filter)) {
                          setAppliedCategoryFilters([opt.filter as any]);
                          setAppliedRoleFilter('ALL');
                          const feedbackMap: Record<string, string> = {
                            'Objections': 'Tools to break through this objection',
                            'Deal Flow': 'Best tools to regain momentum',
                            'Pricing': 'Presentation tools for this deal',
                            'Follow-Up': 'Here’s how to reconnect this deal',
                          };
                          setDiagnosisFeedback(feedbackMap[opt.filter] || `Best next steps for this situation`);
                        } else {
                          setDiagnosisFeedback('Best next steps for this situation');
                        }
                        setIsAllToolsExpanded(true);
                        document.getElementById('all-tools-anchor')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="flex items-center gap-3 rounded-lg border border-transparent bg-[#111b2d] p-3 text-left transition-all hover:border-[#37507a] hover:bg-[#15243f] active:scale-[0.98]"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1a2d49] text-[#76ff8f]">
                        {opt.filter === 'all' ? <HelpCircle className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#e8f1ff]">{opt.label}</p>
                        <p className="text-[10px] text-[#9db0cb]">{opt.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => maybeOpenTool(featuredTool)}
              className="h-10 border-[#2f415f] bg-[#0d1728] text-xs text-[#e8f1ff] transition-all hover:bg-[#12203a] active:scale-[0.95]"
            >
              Run This Week's Featured Tool
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
              <div className="space-y-8">
                {/* 1. Continue where you left off */}
                {recentEntries.length > 0 && historyGate.allowed && (
                  <section className="space-y-4">
                    <p className="px-1 text-xs font-bold uppercase tracking-[0.2em] text-[#6484b3]">
                      Continue Work
                    </p>
                    <div className="divide-y divide-[#1a2d49] rounded-xl border border-[#1a2d49] bg-[#0a1527] overflow-hidden">
                      {recentEntries.slice(0, 3).map((entry) => {
                        const tool = tools.find((t) => t.id === entry.toolId);
                        return (
                          <div
                            key={entry.id}
                            className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-[#111f35]"
                          >
                            <div className="min-w-0 flex-1 flex items-center gap-3">
                              <div className="h-2 w-2 rounded-full bg-[#76ff8f] shrink-0 animate-pulse" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-[#e1ecff]">{tool?.name || entry.toolId}</p>
                                <p className="text-[10px] text-[#6f84a7] font-medium tracking-wide">
                                  OPENED {formatLastEdited(entry.createdAt).toUpperCase()}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 shrink-0 text-[11px] font-black uppercase tracking-widest text-[#76ff8f] hover:bg-[#1a2d49] active:scale-95 transition-transform"
                              onClick={() => {
                                if (tool) setActiveTool(tool);
                                setDrafts((current) => ({ ...current, [entry.toolId]: entry.content }));
                              }}
                            >
                              Run Tool
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 2. Use Right Now */}
                <section className="space-y-6 pt-2">
                  <p className="px-1 text-xs font-bold uppercase tracking-[0.25em] text-[#76ff8f]">
                    Essential Moves — Use Right Now
                  </p>
                  <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide md:grid md:grid-cols-2 md:overflow-visible">
                    {useRightNowTools.map((tool) => {
                      const hasAccess = canOpenTool(tool);
                      const accentColor = getToolAccentColor(tool);
                      return (
                        <Card
                          key={tool.id}
                          className={cn(
                            'group relative min-w-[300px] shrink-0 overflow-hidden border-[#2b3e5d] bg-[#0f1b30] transition-all duration-300 md:min-w-0',
                            'shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-opacity-50 hover:border-opacity-100',
                            hasAccess && 'hover:bg-[#15243f] hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.25)]'
                          )}
                        >
                          {/* Intensity Strip */}
                          <div 
                            className="absolute left-0 top-0 h-full w-[3px]" 
                            style={{ backgroundColor: accentColor, opacity: 0.4 }} 
                          />
                          
                          <CardHeader className="space-y-2 p-5 pb-3">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9bffac]">
                                {getToolAuthorityLabel(tool)}
                              </p>
                              <Badge 
                                className="bg-[#070d18] text-white border-none text-[8px] uppercase tracking-widest font-black h-5 px-2"
                                style={{ borderLeft: `2px solid ${accentColor}` }}
                              >
                                {getToolConfidenceTag(tool)}
                              </Badge>
                            </div>
                            <div className="pt-1">
                              <CardTitle className="text-xl font-black text-white leading-tight tracking-tight">
                                {tool.name}
                              </CardTitle>
                              <p className="text-[11px] font-bold text-[#6f84a7] uppercase tracking-[0.1em] mt-1.5 flex items-center gap-2">
                                <span className="h-1 w-1 rounded-full" style={{ backgroundColor: accentColor }} />
                                {getToolRoleDescription(tool)}
                              </p>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4 p-5 pt-0">
                            <div className="space-y-2.5">
                              <p className="text-[10px] font-medium uppercase tracking-widest text-[#6f84a7]">
                                Best used when:
                              </p>
                              <ul className="space-y-1.5">
                                {getToolBestUsedWhen(tool).map((item, i) => (
                                  <li key={i} className="flex items-start gap-2.5 text-[11px] font-bold text-[#e1ecff] leading-tight">
                                    <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-[#76ff8f]" />
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div className="rounded-lg bg-[#070d18]/70 p-4 border border-[#1a2d49] shadow-inner">
                              <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[#6f84a7]/80 mb-3 flex items-center gap-2">
                                <Sparkles className="h-3 w-3 text-[#76ff8f]/60" />
                                Context Triggers:
                              </p>
                              <ul className="space-y-2">
                                {getToolTriggers(tool).map((trigger, i) => (
                                  <li key={i} className="text-[10px] font-bold text-[#a9bbd8] leading-snug flex items-start gap-2 italic">
                                    <span>“</span>{trigger}<span>”</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <p className="line-clamp-2 text-[12px] font-medium leading-relaxed text-[#869bbd]">{tool.description}</p>
                            
                            <div className="flex items-center justify-between gap-4 pt-2">
                              <Badge variant="outline" className="border-[#2a3f5f] bg-transparent px-2.5 py-0.5 text-[9px] font-black uppercase tracking-tighter text-[#8ea2c1]">
                                {tool.category}
                              </Badge>
                              <Button
                                size="sm"
                                className="h-10 grow bg-[#172845] text-[12px] font-black uppercase tracking-widest text-white hover:bg-[#22375a] active:scale-[0.97] transition-all"
                                onClick={() => maybeOpenTool(tool)}
                              >
                                Run Tool
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>

                {/* 3. Quick Action Navigation */}
                <section className="space-y-3">
                  <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#90a8cc]">
                    What do you need right now?
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {TOOL_INTENT_OPTIONS.map((intent) => (
                      <button
                        key={intent}
                        onClick={() => {
                          const isTogglingOff = selectedIntentFilter === intent;
                          setSelectedIntentFilter((prev) => (isTogglingOff ? null : intent));
                          setIsAllToolsExpanded(true);
                          setDiagnosisFeedback(isTogglingOff ? null : `Showing tools to help you ${TOOL_INTENT_ACTIONS[intent].toLowerCase()}`);
                        }}
                        className={cn(
                          'shrink-0 rounded-full border px-4 py-2 text-[11px] font-semibold tracking-wide transition-all active:scale-[0.95]',
                          selectedIntentFilter === intent
                            ? 'border-[#76ff8f]/45 bg-[#76ff8f]/12 text-[#b4ffbf]'
                            : 'border-[#2f466a] bg-[#0e1a30] text-[#a4b6d2] hover:bg-[#15243f]'
                        )}
                      >
                        {TOOL_INTENT_ACTIONS[intent]}
                      </button>
                    ))}
                  </div>
                </section>

                {/* 4. Browse All Tools (Collapsed Entry) */}
                <section className="pt-2" id="all-tools-anchor">
                  {diagnosisFeedback && (
                    <div className="mb-4 px-1 animate-in fade-in slide-in-from-left-4 duration-500">
                      <p className="text-sm font-black text-[#76ff8f] flex items-center gap-3 tracking-wide">
                        <CheckCircle2 className="h-4 w-4" />
                        {diagnosisFeedback.toUpperCase()}
                      </p>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsAllToolsExpanded(!isAllToolsExpanded)}
                    className="flex w-full items-center justify-between rounded-xl border border-[#253956] bg-gradient-to-r from-[#0d182b] to-[#0c1729] p-6 text-left text-sm font-bold text-[#f5f9ff] transition-all hover:border-[#3d5a8a] hover:from-[#11213a] active:scale-[0.99] group shadow-lg"
                  >
                     <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1a2d49] text-[#76ff8f] shadow-inner group-hover:scale-110 transition-transform">
                        <FolderOpen className="h-5 w-5" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-base tracking-tight">Explore All Tools <span className="text-[#6484b3] font-medium ml-1">({tools.length})</span></span>
                        <p className="text-[11px] text-[#6f84a7] font-bold uppercase tracking-widest group-hover:text-[#9bffac] transition-colors">
                          Search or jump to the exact move you need
                        </p>
                      </div>
                    </div>
                    <ArrowRight className={cn('h-5 w-5 transition-transform duration-300', isAllToolsExpanded && 'rotate-90')} />
                  </button>

                  {isAllToolsExpanded && (
                    <div className="mt-8 space-y-10 animate-in fade-in slide-in-from-top-4 duration-300">
                      {/* Expanded Top Bar */}
                      <div className="sticky top-[64px] z-30 flex items-center gap-2 rounded-lg bg-[#070d18]/95 p-2 backdrop-blur md:top-[76px]">
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search tools, keywords, skills"
                          className="h-10 border-[#2c3e5c] bg-[#0f1a2d] text-[#eaf2ff] placeholder:text-[#6f84a7]"
                        />
                        {isDesktopFilterUI ? (
                          <Popover open={isFilterPanelOpen} onOpenChange={handleOpenFiltersPanel}>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="h-10 shrink-0 border-[#2f466a] bg-[#0f1a2d] text-[#d8e4f8]">
                                <SlidersHorizontal className="mr-2 h-4 w-4" />
                                Filter
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-[360px] border-[#2f466a] bg-[#0e1a30] text-[#dbe7fb]">
                              {filterPanelContent}
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Sheet open={isFilterPanelOpen} onOpenChange={handleOpenFiltersPanel}>
                            <SheetTrigger asChild>
                              <Button variant="outline" className="h-10 shrink-0 border-[#2f466a] bg-[#0f1a2d] text-[#d8e4f8]">
                                <SlidersHorizontal className="mr-2 h-4 w-4" />
                                Filter
                              </Button>
                            </SheetTrigger>
                            <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto border-[#2f466a] bg-[#0e1a30] text-[#dbe7fb]">
                              <SheetHeader>
                                <SheetTitle className="text-[#f5f9ff]">Filters</SheetTitle>
                              </SheetHeader>
                              <div className="mt-4">{filterPanelContent}</div>
                            </SheetContent>
                          </Sheet>
                        )}
                      </div>

                      {/* Tool Grouping by Scenario */}
                      <div className="space-y-12">
                        {SCENARIO_GROUPS.map((group) => {
                          const groupTools = gridTools.filter((t) => (group.categories as readonly string[]).includes(t.category));
                          if (groupTools.length === 0) return null;

                          return (
                            <div key={group.label} className="space-y-4">
                              <h3 className="flex items-center gap-2 px-1 text-lg font-bold text-[#f2f8ff]">
                                <span className="h-4 w-1 rounded-full bg-[#76ff8f]" />
                                {group.label}
                              </h3>
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {groupTools.map((tool) => {
                                  const hasAccess = canOpenTool(tool);
                                  const ctaLabel = ctaLabelForTool(tool, hasAccess);
                                  return (
                                    <Card
                                      key={tool.id}
                                      className="group relative flex flex-col overflow-hidden border-[#263b5a] bg-[#0d192c] transition-all hover:bg-[#0f1d31] hover:translate-y-[-2px] hover:shadow-lg"
                                    >
                                      <div 
                                        className="absolute top-0 left-0 w-full h-[2px]" 
                                        style={{ backgroundColor: getToolAccentColor(tool), opacity: 0.3 }} 
                                      />
                                      <CardHeader className="p-4 pb-2">
                                        <div className="flex items-center justify-between mb-1">
                                          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#6484b3]">
                                            {tool.category}
                                          </p>
                                          <Badge className="bg-[#070d18] text-[#90a8cc] border-none text-[7px] font-black uppercase h-4 px-1.5">
                                            {getToolConfidenceTag(tool)}
                                          </Badge>
                                        </div>
                                        <CardTitle className="text-sm font-black text-[#f2f8ff] tracking-tight">{tool.name}</CardTitle>
                                      </CardHeader>
                                      <CardContent className="flex flex-1 flex-col space-y-3 p-4 pt-0">
                                        <div className="space-y-1">
                                          <p className="text-[9px] font-black uppercase tracking-widest text-[#76ff8f]/50">
                                            Usage: 
                                          </p>
                                          <p className="text-[10px] font-bold text-[#e1ecff] leading-snug">
                                            {tool.recommendedWhen[0]}
                                          </p>
                                        </div>
                                        <p className="line-clamp-2 text-[11px] font-medium leading-relaxed text-[#a7b7d1]">{tool.description}</p>
                                        <div className="mt-auto pt-2">
                                          <Button
                                            size="sm"
                                            className="h-8 w-full bg-[#172845] text-[10px] font-black uppercase tracking-widest text-[#e8f1ff] hover:bg-[#22375a] active:scale-95 transition-transform"
                                            onClick={() => maybeOpenTool(tool)}
                                          >
                                            Run Tool
                                          </Button>
                                        </div>
                                      </CardContent>
                                      {!hasAccess && (
                                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a1220]/75 backdrop-blur-[2px] p-4 text-center">
                                          <Lock className="mb-2 h-4 w-4 text-[#9db0cb]" />
                                          <p className="text-[10px] font-black text-[#d8e3f5] uppercase tracking-[0.2em]">Restricted Access</p>
                                          <Button
                                            variant="link"
                                            className="h-auto p-0 mt-2 text-[10px] font-black uppercase tracking-widest text-[#76ff8f] hover:no-underline"
                                            onClick={() => maybeOpenTool(tool)}
                                          >
                                            Unlock Tool
                                          </Button>
                                        </div>
                                      )}
                                    </Card>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {gridTools.length === 0 && (
                        <div className="rounded-xl border border-dashed border-[#2a3f5f] py-16 text-center text-sm text-[#a7b7d1]">
                          No tools match your current search and filters.
                        </div>
                      )}
                    </div>
                  )}
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
                        const hasAccess = canOpenTool(tool);
                        const isComingSoonLocked = isConsistencyWorkspace && tool.id !== 'consistency-leak-finder';
                        return (
                          <button
                            key={tool.id}
                            type="button"
                            onClick={() => {
                              if (isComingSoonLocked) return;
                              maybeOpenTool(tool);
                            }}
                            disabled={isComingSoonLocked}
                            className={cn(
                              'relative w-full rounded-md border px-3 py-2 text-left transition-colors',
                              activeToolId === tool.id
                                ? 'border-[#76ff8f]/50 bg-[#14273e] text-[#e9f5ff]'
                                : 'border-[#2a3f5f] bg-[#0a1527] text-[#b4c7e3] hover:bg-[#12203a]',
                              !hasAccess && 'opacity-80',
                              isComingSoonLocked && 'cursor-not-allowed opacity-70'
                            )}
                            aria-disabled={isComingSoonLocked}
                          >
                            {isComingSoonLocked && (
                              <span className="absolute right-2 top-2 rounded-full border border-[#3f5478] bg-[#1a2d49] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#9eb3d1]">
                                Coming Soon
                              </span>
                            )}
                            <p className="text-sm font-medium">{tool.name}</p>
                            <p className="text-[11px] text-[#8ea2c1]">Standalone Tool</p>
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
                          if (!selected) return;
                          const isComingSoonLocked = isConsistencyWorkspace && selected.id !== 'consistency-leak-finder';
                          if (isComingSoonLocked) return;
                          maybeOpenTool(selected);
                        }}
                      >
                        {tools.map((tool) => (
                          <option
                            key={tool.id}
                            value={tool.id}
                            disabled={isConsistencyWorkspace && tool.id !== 'consistency-leak-finder'}
                          >
                            {tool.name} (Tool)
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
                          <div className="mx-auto w-full max-w-3xl space-y-4">
                            <Card className="border-[#2a3f5f] bg-[#0a1527]">
                              <CardContent className="space-y-5 p-4 md:p-5">
                                <div className="space-y-4">
                                  <p className="text-sm font-semibold text-[#edf5ff]">Customer Snapshot</p>
                                  <div className="grid gap-4 md:grid-cols-2">
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

                                <div className="space-y-4 rounded-lg border border-[#21375a] bg-[#0c1a30] p-4">
                                  <p className="text-sm font-semibold text-[#edf5ff]">Customer Signals</p>
                                  <div className="grid gap-4 md:grid-cols-2">
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
                                </div>

                                <div className="space-y-4 rounded-lg border border-[#21375a] bg-[#0c1a30] p-4">
                                  <p className="text-sm font-semibold text-[#edf5ff]">What it actually means</p>
                                  <div className="grid gap-4 md:grid-cols-2">
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
                                </div>

                                <div className="space-y-4 rounded-lg border border-[#21375a] bg-[#0c1a30] p-4">
                                  <p className="text-sm font-semibold text-[#edf5ff]">What to do next</p>
                                  <div className="grid gap-4 md:grid-cols-2">
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
                                </div>

                                <div className="space-y-2">
                                  <p className="text-sm font-semibold text-[#edf5ff]">Your Working Notes</p>
                                  <Textarea
                                    value={signalMapperDraft.notes}
                                    onChange={(event) => handleSignalMapperFieldChange('notes', event.target.value)}
                                    placeholder="Capture extra context, objections, and wording that worked."
                                    className="min-h-28 border-[#2c3f5f] bg-[#081323] text-[#d9e3f5] placeholder:text-[#6f84a7]"
                                  />
                                </div>
                              </CardContent>
                            </Card>

                            <div className="flex items-center justify-end">
                              <Button
                                className="h-11 bg-[#76ff8f] px-5 font-semibold text-[#0d1d11] hover:bg-[#92ffa7]"
                                onClick={handleSaveCurrentWork}
                                disabled={isSavingEntry}
                              >
                                <Save className="mr-2 h-4 w-4" />
                                {isSavingEntry ? 'Saving...' : 'Save My Work'}
                              </Button>
                            </div>
                          </div>
                        ) : activeTool.id === 'consistency-leak-finder' ? (
                          <div className="mx-auto w-full max-w-4xl">
                            <div className="overflow-hidden rounded-xl border border-[#2c3f5f] bg-[#081323]">
                              <iframe
                                src={`/tools/consistency-leak-finder?embed=1&theme=${embeddedTheme}`}
                                title="Consistency Leak Finder"
                                className="h-[78vh] min-h-[900px] w-full bg-[#081323]"
                              />
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

                        {activeTool.id !== 'signal-mapper' && activeTool.id !== 'consistency-leak-finder' && (
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-[#f6fbff]">Don't lose your work.</p>
                              <p className="text-xs text-[#9db0cb]">
                                Cloud save is a paid feature. Free and account users stay local/session-only.
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

                        {activeTool.id !== 'consistency-leak-finder' && (
                          <Card className="border-[#2a3f5f] bg-[#0a1527]">
                            <CardContent className="space-y-4 p-4">
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-[#f6fbff]">Enhancement Layers</p>
                                <p className="text-xs text-[#9db0cb]">
                                  Standalone tool output is always available. Sprocket and AutoDriveCX are additive layers.
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  className="bg-[#172845] text-[#eaf2ff] hover:bg-[#22375a]"
                                  onClick={() => void handleRunSprocketLayer()}
                                  disabled={isRunningSprocketLayer}
                                >
                                  {isRunningSprocketLayer ? 'Running Sprocket...' : 'Run Sprocket Layer'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-[#2f445f] bg-transparent text-[#dbe7fb] hover:bg-[#1a2d49]"
                                  onClick={() => void handleRunAutoDriveCxLayer()}
                                  disabled={isRunningCxLayer}
                                >
                                  {isRunningCxLayer ? 'Running AutoDriveCX...' : 'Run AutoDriveCX Layer'}
                                </Button>
                              </div>

                              {sprocketLayerOutput && (
                                <div className="space-y-2 rounded-lg border border-[#233a5c] bg-[#0b182d] p-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9ec0f1]">Sprocket Layer</p>
                                  <p className="text-sm text-[#dce9ff]"><span className="font-semibold">Diagnosis:</span> {sprocketLayerOutput.diagnosis}</p>
                                  <p className="text-sm text-[#dce9ff]"><span className="font-semibold">Rewrite:</span> {sprocketLayerOutput.rewrite}</p>
                                  <p className="text-sm text-[#dce9ff]"><span className="font-semibold">Coaching:</span> {sprocketLayerOutput.coaching}</p>
                                  <p className="text-sm text-[#dce9ff]"><span className="font-semibold">Prioritization:</span> {sprocketLayerOutput.prioritization}</p>
                                  <p className="text-xs text-[#9eb3d1]">Next steps: {sprocketLayerOutput.nextSteps.join(' • ')}</p>
                                </div>
                              )}

                              {cxLayerOutput && (
                                <div className="space-y-2 rounded-lg border border-[#25504a] bg-[#0c231f] p-3">
                                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#9ff7e7]">AutoDriveCX Layer</p>
                                  <p className="text-sm text-[#dbfff9]"><span className="font-semibold">Insight:</span> {cxLayerOutput.insight}</p>
                                  <p className="text-sm text-[#dbfff9]"><span className="font-semibold">Personalization:</span> {cxLayerOutput.personalization}</p>
                                  <p className="text-xs text-[#9de3d8]">Focus: {cxLayerOutput.focus.join(' • ')}</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
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
        </main>

        <EmailGateModal
          open={showEmailGate}
          loading={isEmailSubmitting}
          defaultEmail={accountEmail}
          defaultRole={accountRole}
          onOpenChange={setShowEmailGate}
          onSubmit={handleUnlockByEmail}
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

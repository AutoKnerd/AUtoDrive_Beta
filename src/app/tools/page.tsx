'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
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
  clearTempDrafts,
  exportTempDraftsAsEntries,
  getTempDraft,
  writeTempDraft,
} from '@/lib/tools/toolbox-storage';
import { FEATURES, resolvePaidAccess, type ToolboxCapturedRole, type ToolboxFeatureKey } from '@/lib/tools/entitlements';
import {
  buildSignalMapperMicroDraft,
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
  'Fast Win': '#60B040',
  'High Impact': '#2888B0',
  'Stuck Deal Fix': '#6E8E49',
  'Customer Saver': '#3E8F71',
  'Manager Move': '#1F6F93',
  'Confidence Builder': '#2F8F8A',
  'Momentum Booster': '#4E9D6F',
};

function getToolAccentColor(tool: ToolConfig): string {
  const tag = getToolConfidenceTag(tool);
  return TAG_ACCENT_COLORS[tag] || '#60B040';
}

const INLINE_TOOL_COMPONENTS: Record<string, ComponentType> = {
  'pickup-experience-designer': dynamic(() => import('@/app/tools/pickup-experience-designer/page'), { ssr: false }),
  'repair-trust-builder': dynamic(() => import('@/app/tools/repair-trust-builder/page'), { ssr: false }),
  'wait-experience-coach': dynamic(() => import('@/app/tools/wait-experience-coach/page'), { ssr: false }),
  'pressure-drop-planner': dynamic(() => import('@/app/tools/pressure-drop-planner/page'), { ssr: false }),
  'clarity-check-builder': dynamic(() => import('@/app/tools/clarity-check-builder/page'), { ssr: false }),
  'first-impression-calibrator': dynamic(() => import('@/app/tools/first-impression-calibrator/page'), { ssr: false }),
  'consistency-gap-check': dynamic(() => import('@/app/tools/consistency-gap-check/page'), { ssr: false }),
  'inventory-substitution-guide': dynamic(() => import('@/app/tools/inventory-substitution-guide/page'), { ssr: false }),
  'special-order-confidence-builder': dynamic(() => import('@/app/tools/special-order-confidence-builder/page'), { ssr: false }),
  'parts-objection-defuser': dynamic(() => import('@/app/tools/parts-objection-defuser/page'), { ssr: false }),
  'mpi-conversation-designer': dynamic(() => import('@/app/tools/mpi-conversation-designer/page'), { ssr: false }),
  'upsell-timing-advisor': dynamic(() => import('@/app/tools/upsell-timing-advisor/page'), { ssr: false }),
  'waiter-update-flow': dynamic(() => import('@/app/tools/waiter-update-flow/page'), { ssr: false }),
  'be-back-conversion-planner': dynamic(() => import('@/app/tools/be-back-conversion-planner/page'), { ssr: false }),
  'walkaround-path-builder': dynamic(() => import('@/app/tools/walkaround-path-builder/page'), { ssr: false }),
  'payment-comfort-mapper': dynamic(() => import('@/app/tools/payment-comfort-mapper/page'), { ssr: false }),
  'buyer-temperature-tracker': dynamic(() => import('@/app/tools/buyer-temperature-tracker/page'), { ssr: false }),
  'gross-protection-strategist': dynamic(() => import('@/app/tools/gross-protection-strategist/page'), { ssr: false }),
  'team-coaching-converter': dynamic(() => import('@/app/tools/team-coaching-converter/page'), { ssr: false }),
  'desk-conversation': dynamic(() => import('@/app/tools/desk-conversation/page'), { ssr: false }),
  'declined-work-recovery': dynamic(() => import('@/app/tools/declined-work-recovery/page'), { ssr: false }),
  'status-update': dynamic(() => import('@/app/tools/status-update/page'), { ssr: false }),
  'repair-approval': dynamic(() => import('@/app/tools/repair-approval/page'), { ssr: false }),
  'test-drive-debrief': dynamic(() => import('@/app/tools/test-drive-debrief/page'), { ssr: false }),
  'trade-value-bridge': dynamic(() => import('@/app/tools/trade-value-bridge/page'), { ssr: false }),
  'commitment-ladder': dynamic(() => import('@/app/tools/commitment-ladder/page'), { ssr: false }),
  'next-move-engine': dynamic(() => import('@/app/tools/next-move-engine/page'), { ssr: false }),
  'objection-reframe': dynamic(() => import('@/app/tools/objection-reframe/page'), { ssr: false }),
  'follow-up-cadence': dynamic(() => import('@/app/tools/follow-up-cadence/page'), { ssr: false }),
  'handoff-script': dynamic(() => import('@/app/tools/handoff-script/page'), { ssr: false }),
  'deal-recovery': dynamic(() => import('@/app/tools/deal-recovery/page'), { ssr: false }),
  'loyalty-loop': dynamic(() => import('@/app/tools/loyalty-loop/page'), { ssr: false }),
  'signal-mapper': dynamic(() => import('@/app/tools/signal-mapper/page'), { ssr: false }),
  'price-presentation': dynamic(() => import('@/app/tools/price-presentation/page'), { ssr: false }),
  'consistency-leak-finder': dynamic(() => import('@/app/tools/consistency-leak-finder/page'), { ssr: false }),
};

const SCENARIO_GROUPS = [
  { label: 'Move deals forward', categories: ['Deal Flow'] },
  { label: 'Handle objections fast', categories: ['Objections'] },
  { label: 'Reconnect & recover deals', categories: ['Follow-Up'] },
  { label: 'Present numbers clearly', categories: ['Pricing'] },
  { label: 'Improve customer experience', categories: ['CX / Process'] },
  { label: 'Lead and coach your team', categories: ['Manager Tools'] },
] as const;

const QUICK_DIAGNOSIS_OPTIONS = [
  { label: 'Customer is stalling', filter: 'Objections', description: 'Break the stall' },
  { label: 'Deal lost momentum', filter: 'Deal Flow', description: 'Get it moving again' },
  { label: 'Customer pushed back', filter: 'Objections', description: 'Handle the objection' },
  { label: 'I’m at numbers', filter: 'Pricing', description: 'Present cleanly' },
  { label: 'Need to re-engage', filter: 'Follow-Up', description: 'Reconnect now' },
  { label: 'Just tell me what to do', filter: 'all', description: 'Show me the move' },
] as const;
type DiagnosisLabel = (typeof QUICK_DIAGNOSIS_OPTIONS)[number]['label'];
type RoleTypeSelection = 'sales_advisor' | 'manager';
type RoleDetailSelection = 'Sales Consultant' | 'Service Writer' | 'manager' | 'Service Manager' | 'Finance Manager';

const DIAGNOSIS_TOOL_PRIORITY: Record<DiagnosisLabel, string[]> = {
  'Customer is stalling': ['objection-reframe', 'signal-mapper', 'parts-objection-defuser'],
  'Deal lost momentum': ['signal-mapper', 'objection-reframe', 'follow-up-cadence', 'status-update', 'loyalty-loop'],
  'Customer pushed back': ['objection-reframe', 'parts-objection-defuser', 'signal-mapper'],
  'I’m at numbers': ['desk-conversation', 'objection-reframe', 'signal-mapper'],
  'Need to re-engage': ['signal-mapper', 'follow-up-cadence', 'status-update', 'loyalty-loop'],
  'Just tell me what to do': ['signal-mapper', 'consistency-gap-check', 'objection-reframe'],
};

const ROLE_DETAIL_TOOL_PRIORITY: Record<RoleDetailSelection, string[]> = {
  'Sales Consultant': ['objection-reframe', 'signal-mapper', 'follow-up-cadence', 'deal-recovery', 'commitment-ladder', 'next-move-engine'],
  'Service Writer': ['clarity-check-builder', 'repair-trust-builder', 'repair-approval', 'status-update', 'waiter-update-flow', 'wait-experience-coach'],
  manager: ['team-coaching-converter', 'desk-conversation', 'consistency-gap-check', 'consistency-leak-finder', 'signal-mapper'],
  'Service Manager': ['consistency-gap-check', 'team-coaching-converter', 'repair-trust-builder', 'wait-experience-coach', 'status-update'],
  'Finance Manager': ['price-presentation', 'payment-comfort-mapper', 'objection-reframe', 'clarity-check-builder', 'desk-conversation'],
};

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
    triggers: ['Customer is asking what happens next', 'Delivery feels rushed or unclear', 'You want to turn this into a referral moment'],
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
  const toolWorkspaceRef = useRef<HTMLElement | null>(null);
  const lastScrolledToolIdRef = useRef<string | null>(null);

  const [didTouchRoleFilter, setDidTouchRoleFilter] = useState(false);
  const [selectedIntentFilter, setSelectedIntentFilter] = useState<ToolIntentTag | null>(null);
  const [isDesktopFilterUI, setIsDesktopFilterUI] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [appliedAccessFilter, setAppliedAccessFilter] = useState<'available' | 'all' | 'free' | 'premium'>('all');
  const [appliedCategoryFilters, setAppliedCategoryFilters] = useState<Array<'Deal Flow' | 'Objections' | 'Follow-Up' | 'Pricing' | 'CX / Process' | 'Manager Tools'>>([]);
  const [appliedRoleFilter, setAppliedRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [appliedSortBy, setAppliedSortBy] = useState<'recommended' | 'recent' | 'popular'>('recommended');
  const [draftAccessFilter, setDraftAccessFilter] = useState<'available' | 'all' | 'free' | 'premium'>('all');
  const [draftCategoryFilters, setDraftCategoryFilters] = useState<Array<'Deal Flow' | 'Objections' | 'Follow-Up' | 'Pricing' | 'CX / Process' | 'Manager Tools'>>([]);
  const [draftRoleFilter, setDraftRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [draftSortBy, setDraftSortBy] = useState<'recommended' | 'recent' | 'popular'>('recommended');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAllToolsExpanded, setIsAllToolsExpanded] = useState(false);
  const [diagnosisFeedback, setDiagnosisFeedback] = useState<string | null>(null);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<DiagnosisLabel | null>(null);
  const [selectedRoleType, setSelectedRoleType] = useState<RoleTypeSelection | null>(null);
  const [selectedRoleDetail, setSelectedRoleDetail] = useState<RoleDetailSelection | null>(null);
  const [isRoleSelectorExpanded, setIsRoleSelectorExpanded] = useState(true);
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
  const diagnosisPriorityToolIds = useMemo(
    () => (selectedDiagnosis ? DIAGNOSIS_TOOL_PRIORITY[selectedDiagnosis] || [] : []),
    [selectedDiagnosis]
  );
  const roleSelectionLabel = useMemo(() => {
    if (selectedRoleDetail === 'manager') return 'Sales Manager';
    if (selectedRoleDetail === 'Service Writer') return 'Service Advisor';
    if (selectedRoleDetail) return selectedRoleDetail;
    if (selectedRoleType === 'sales_advisor') return 'Sales / Advisor';
    if (selectedRoleType === 'manager') return 'Manager';
    return null;
  }, [selectedRoleDetail, selectedRoleType]);
  const rolePriorityToolIds = useMemo(
    () => (selectedRoleDetail ? ROLE_DETAIL_TOOL_PRIORITY[selectedRoleDetail] || [] : []),
    [selectedRoleDetail]
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
    const baseSorted = appliedSortBy === 'recent'
      ? sorted.sort(byRecency)
      : appliedSortBy === 'popular'
        ? sorted.sort(byPopularity)
        : sorted.sort(byRecommendation);

    const roleRankByToolId = new Map(rolePriorityToolIds.map((toolId, index) => [toolId, index]));
    if (!roleRankByToolId.size) return baseSorted;

    // Re-rank after existing filters/sorts: role priority only.
    // Non-priority tools retain their existing relative order.
    const originalIndex = new Map(baseSorted.map((tool, index) => [tool.id, index]));
    return [...baseSorted].sort((a, b) => {
      const aRoleWeight = roleRankByToolId.has(a.id) ? 1 : 2;
      const bRoleWeight = roleRankByToolId.has(b.id) ? 1 : 2;
      if (aRoleWeight !== bRoleWeight) return aRoleWeight - bRoleWeight;
      if (aRoleWeight === 1) {
        return (roleRankByToolId.get(a.id) ?? 0) - (roleRankByToolId.get(b.id) ?? 0);
      }

      return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0);
    });
  }, [appliedSortBy, recommendedToolIdSet, rolePriorityToolIds, tools, visibleTools]);

  const useRightNowTools = useMemo(() => {
    const diagnosisTools = diagnosisPriorityToolIds
      .map((toolId) => tools.find((tool) => tool.id === toolId))
      .filter((tool): tool is ToolConfig => !!tool);
    const list = [
      ...diagnosisTools,
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
  }, [diagnosisPriorityToolIds, featuredTool, recommendedPrimaryTool, recommendedSecondaryTools, tools]);

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
    if (typeof window === 'undefined') return;
    const syncLayout = () => setIsDesktopFilterUI(window.matchMedia('(min-width: 768px)').matches);
    syncLayout();
    window.addEventListener('resize', syncLayout);
    return () => window.removeEventListener('resize', syncLayout);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedType = window.localStorage.getItem('autodrive_role_type');
    const storedDetail = window.localStorage.getItem('autodrive_role_detail');

    if (storedType === 'sales_advisor' || storedType === 'manager') {
      setSelectedRoleType(storedType);
    }
    if (
      storedDetail === 'Sales Consultant' ||
      storedDetail === 'Service Writer' ||
      storedDetail === 'manager' ||
      storedDetail === 'Service Manager' ||
      storedDetail === 'Finance Manager'
    ) {
      setSelectedRoleDetail(storedDetail);
    }
    if (storedType || storedDetail) {
      setIsRoleSelectorExpanded(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedRoleType) {
      window.localStorage.setItem('autodrive_role_type', selectedRoleType);
    } else {
      window.localStorage.removeItem('autodrive_role_type');
    }
  }, [selectedRoleType]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (selectedRoleDetail) {
      window.localStorage.setItem('autodrive_role_detail', selectedRoleDetail);
    } else {
      window.localStorage.removeItem('autodrive_role_detail');
    }
  }, [selectedRoleDetail]);

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

  useEffect(() => {
    if (!activeToolId) {
      lastScrolledToolIdRef.current = null;
      return;
    }
    if (lastScrolledToolIdRef.current === activeToolId) return;

    const scrollWorkspaceToTop = (behavior: ScrollBehavior) => {
      const workspaceEl = toolWorkspaceRef.current;
      if (!workspaceEl) return;
      const stickyHeaderOffset = 80;
      const top = workspaceEl.getBoundingClientRect().top + window.scrollY - stickyHeaderOffset;
      window.scrollTo({ top: Math.max(0, top), behavior });
    };

    const timers = [
      window.setTimeout(() => scrollWorkspaceToTop('smooth'), 40),
      window.setTimeout(() => scrollWorkspaceToTop('auto'), 180),
      window.setTimeout(() => scrollWorkspaceToTop('auto'), 420),
      window.setTimeout(() => {
        scrollWorkspaceToTop('auto');
        lastScrolledToolIdRef.current = activeToolId;
      }, 760),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
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
    setDraftAccessFilter('all');
    setDraftCategoryFilters([]);
    setDraftRoleFilter('ALL');
    setDraftSortBy('recommended');
    setAppliedAccessFilter('all');
    setAppliedCategoryFilters([]);
    setAppliedRoleFilter('ALL');
    setAppliedSortBy('recommended');
    setDidTouchRoleFilter(false);
    setSelectedIntentFilter(null);
    setSelectedDiagnosis(null);
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
          <section className="space-y-4 transition-all duration-200">
            <div
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 transition-all duration-200',
                isWorkspaceMode && 'opacity-60'
              )}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-[#76ff8f]/30 bg-[#111b2d] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9bffac]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#76ff8f]" />
                New tool drops every week
              </div>
            </div>

            <div
              className={cn(
                'space-y-1 transition-all duration-200',
                isWorkspaceMode && 'opacity-75'
              )}
            >
              {!loading && user && (
                <p className="text-xs font-medium text-[#c8d8f1]">Welcome back{displayName ? `, ${displayName}` : ''}.</p>
              )}
              <h1 className="text-2xl font-semibold tracking-tight text-[#f6fbff] md:text-4xl">
                Build a system that actually moves deals.
              </h1>
              <p className="text-sm text-[#9db0cb]">
                For consultants and managers who want consistent wins.
              </p>
              <p className="text-[11px] text-[#6f84a7] font-medium leading-none">
                Pick what’s happening, we’ll guide your next move.
              </p>
            </div>

            <div className="space-y-2">
              {roleSelectionLabel && !isRoleSelectorExpanded ? (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200 flex items-center gap-2 px-1 text-[12px]">
                  <span className="text-[#9db0cb]">Showing tools for:</span>
                  <span className="font-semibold text-[#e8f1ff]">{roleSelectionLabel}</span>
                  <button
                    type="button"
                    onClick={() => setIsRoleSelectorExpanded(true)}
                    className="text-[#76ff8f] hover:text-[#92ffa7] underline-offset-4 hover:underline"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200 space-y-2">
                  <p className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f84a7]">
                    Show me tools for:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoleType('sales_advisor');
                        setIsRoleSelectorExpanded(false);
                        if (selectedRoleDetail === 'manager' || selectedRoleDetail === 'Service Manager' || selectedRoleDetail === 'Finance Manager') {
                          setSelectedRoleDetail(null);
                        }
                      }}
                      className={cn(
                        'rounded-full border px-4 py-2 text-[11px] font-semibold tracking-wide transition-all active:scale-[0.97]',
                        selectedRoleType === 'sales_advisor'
                          ? 'border-[#76ff8f]/45 bg-[#76ff8f]/12 text-[#b4ffbf]'
                          : 'border-[#2f466a] bg-[#0e1a30] text-[#a4b6d2] hover:bg-[#15243f]'
                      )}
                    >
                      Sales / Advisor
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoleType('manager');
                        setIsRoleSelectorExpanded(false);
                        if (selectedRoleDetail === 'Sales Consultant' || selectedRoleDetail === 'Service Writer') {
                          setSelectedRoleDetail(null);
                        }
                      }}
                      className={cn(
                        'rounded-full border px-4 py-2 text-[11px] font-semibold tracking-wide transition-all active:scale-[0.97]',
                        selectedRoleType === 'manager'
                          ? 'border-[#76ff8f]/45 bg-[#76ff8f]/12 text-[#b4ffbf]'
                          : 'border-[#2f466a] bg-[#0e1a30] text-[#a4b6d2] hover:bg-[#15243f]'
                      )}
                    >
                      Manager
                    </button>
                  </div>

                  {selectedRoleType && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-2 pt-1">
                      <p className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#6f84a7]">
                        Refine your role:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(selectedRoleType === 'sales_advisor'
                          ? ([
                              { label: 'Sales Consultant', value: 'Sales Consultant' },
                              { label: 'Service Advisor', value: 'Service Writer' },
                            ] as const)
                          : ([
                              { label: 'Sales Manager', value: 'manager' },
                              { label: 'Service Manager', value: 'Service Manager' },
                              { label: 'F&I Manager', value: 'Finance Manager' },
                            ] as const)
                        ).map((roleOption) => (
                          <button
                            key={roleOption.value}
                            type="button"
                            onClick={() => {
                              setSelectedRoleDetail(roleOption.value);
                              setIsRoleSelectorExpanded(false);
                            }}
                            className={cn(
                              'rounded-full border px-4 py-2 text-[11px] font-semibold tracking-wide transition-all active:scale-[0.97]',
                              selectedRoleDetail === roleOption.value
                                ? 'border-[#76ff8f]/45 bg-[#76ff8f]/12 text-[#b4ffbf]'
                                : 'border-[#2f466a] bg-[#0e1a30] text-[#a4b6d2] hover:bg-[#15243f]'
                            )}
                          >
                            {roleOption.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!activeTool && (
              <div className="animate-in fade-in duration-200">
                {/* QUICK DIAGNOSIS BAR */}
                <div className="rounded-xl border border-[#2b3e5d] bg-[#0c1729]/80 p-1 backdrop-blur shadow-xl">
                  <div className="flex flex-col gap-1 p-2">
                    <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#6f84a7]">
                        What’s happening right now?
                      </p>
                      {selectedDiagnosis && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDiagnosis(null);
                            setDiagnosisFeedback(null);
                          }}
                          className="text-[10px] font-semibold text-[#76ff8f] hover:text-[#92ffa7]"
                        >
                          Show all tools
                        </button>
                      )}
                    </div>
                    {selectedDiagnosis && (
                      <div className="px-2 pb-2 animate-in fade-in duration-200">
                        <p className="text-[11px] font-semibold text-[#b4ffbf]">
                          You&apos;re viewing tools for: {selectedDiagnosis}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {QUICK_DIAGNOSIS_OPTIONS.map((opt) => (
                        <button
                          key={opt.label}
                          onClick={() => {
                            setSelectedDiagnosis(opt.label);
                            const feedbackByDiagnosis: Record<DiagnosisLabel, string> = {
                              'Customer is stalling': 'Here’s how to break through this objection',
                              'Deal lost momentum': 'Let’s get this deal moving again',
                              'Customer pushed back': 'Here’s how to break through this objection',
                              'I’m at numbers': 'Best next moves for this situation',
                              'Need to re-engage': 'Here’s how to re-engage this customer',
                              'Just tell me what to do': 'Best next moves for this situation',
                            };
                            setDiagnosisFeedback(feedbackByDiagnosis[opt.label]);
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
              </div>
            )}

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
                              className="tool-run-cta h-8 shrink-0 px-3 text-[11px] uppercase tracking-widest"
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
                  {diagnosisFeedback && (
                    <div className="px-1 animate-in fade-in slide-in-from-left-4 duration-500">
                      <p className="text-sm font-black text-[#76ff8f] flex items-center gap-3 tracking-wide">
                        <CheckCircle2 className="h-4 w-4" />
                        {diagnosisFeedback}
                      </p>
                    </div>
                  )}
                  <p className="px-1 text-xs font-bold uppercase tracking-[0.25em] text-[#76ff8f]">
                    Essential Moves — Use Right Now
                  </p>
                  <div className="grid gap-4 pb-2 sm:grid-cols-2 lg:gap-6">
                    {useRightNowTools.map((tool) => {
                      const hasAccess = canOpenTool(tool);
                      const accentColor = getToolAccentColor(tool);
                      return (
                        <Card
                          key={tool.id}
                          className={cn(
                            'group relative w-full overflow-hidden border-[#2b3e5d] bg-[#0f1b30] transition-all duration-300',
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
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9bffac]">
                                {getToolAuthorityLabel(tool)}
                              </p>
                              <Badge 
                                className="shrink-0 whitespace-nowrap bg-[#070d18] text-white border-none text-[8px] uppercase tracking-widest font-black h-5 px-2"
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
                                You might be here if:
                              </p>
                              <ul className="space-y-2">
                                {getToolTriggers(tool).map((trigger, i) => (
                                  <li key={i} className="text-[10px] font-bold text-[#a9bbd8] leading-snug flex items-start gap-2">
                                    <span className="mt-1 h-1 w-1 rounded-full bg-[#76ff8f]/70 shrink-0" />
                                    <span>{trigger}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <p className="line-clamp-2 text-[12px] font-medium leading-relaxed text-[#869bbd]">{tool.description}</p>
                            
                            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                              <Badge variant="outline" className="border-[#2a3f5f] bg-transparent px-2.5 py-0.5 text-[9px] font-black uppercase tracking-tighter text-[#8ea2c1]">
                                {tool.category}
                              </Badge>
                              <Button
                                size="sm"
                                className="tool-run-cta h-10 w-full text-[12px] uppercase tracking-widest sm:w-auto sm:min-w-[180px]"
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
                          setSelectedDiagnosis(null);
                          setIsAllToolsExpanded(true);
                          setDiagnosisFeedback(isTogglingOff ? null : ({
                            'Move a deal forward': 'Let’s get this deal moving again',
                            'Handle an objection': 'Here’s how to break through this objection',
                            'Follow up': 'Here’s how to re-engage this customer',
                            'Present numbers': 'Best next moves for this situation',
                            'Recover a stalled deal': 'Let’s get this deal moving again',
                            'Improve consistency': 'Best next moves for this situation',
                            'Coach the team': 'Best next moves for this situation',
                          } as Record<ToolIntentTag, string>)[intent]);
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
                  <div className="tool-control-panel rounded-xl border border-[#253956] bg-[#0d182b] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-colors hover:bg-[#11213a]/40 md:p-5">
                    <button
                      type="button"
                      onClick={() => setIsAllToolsExpanded(!isAllToolsExpanded)}
                      className="group flex w-full items-center justify-between text-left transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="tool-control-panel-icon flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a2d49] text-[#76ff8f]">
                          <FolderOpen className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-base font-bold tracking-tight text-[#f5f9ff]">
                            Find the right tool fast <span className="text-[#6484b3] font-medium ml-1">({tools.length})</span>
                          </span>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#6f84a7]">
                            Search, filter, or jump straight to the right move
                          </p>
                        </div>
                      </div>
                      <ArrowRight className={cn('h-5 w-5 text-[#9eb3d1] transition-transform duration-300', isAllToolsExpanded && 'rotate-90')} />
                    </button>

                    <div className="mt-4 flex items-center gap-1.5 rounded-lg border border-[#233652] bg-[#0f1a2d]/60 p-1.5">
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => {
                          if (!isAllToolsExpanded) setIsAllToolsExpanded(true);
                        }}
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
                  </div>

                  <div
                    className={cn(
                      'overflow-hidden transition-all duration-300',
                      isAllToolsExpanded ? 'mt-8 max-h-[6000px] opacity-100' : 'max-h-0 opacity-0'
                    )}
                  >
                    <div className="space-y-10">

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
                                        <div className="mb-1 flex items-center justify-between gap-2">
                                          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#6484b3]">
                                            {tool.category} • {getToolConfidenceTag(tool)}
                                          </p>
                                        </div>
                                        <CardTitle className="text-sm font-black text-[#f2f8ff] tracking-tight">{tool.name}</CardTitle>
                                      </CardHeader>
                                      <CardContent className="flex flex-1 flex-col space-y-3 p-4 pt-0">
                                        <div className="space-y-1">
                                          <p className="text-[9px] font-black uppercase tracking-widest text-[#76ff8f]/50">
                                            Best used when:
                                          </p>
                                          <p className="text-[10px] font-bold text-[#e1ecff] leading-snug">
                                            {tool.recommendedWhen[0]}
                                          </p>
                                        </div>
                                        <div className="space-y-1.5">
                                          <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#6f84a7]/90">
                                            You might be here if:
                                          </p>
                                          <ul className="space-y-1.5 mt-2">
                                            {getToolTriggers(tool).slice(0, 2).map((trigger, i) => (
                                              <li key={i} className="text-[10px] font-bold text-[#a9bbd8] leading-snug flex items-start gap-2">
                                                <span className="mt-1 h-1 w-1 rounded-full bg-[#76ff8f]/70 shrink-0" />
                                                <span>{trigger}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                        <p className="line-clamp-2 text-[11px] font-medium leading-relaxed text-[#a7b7d1]">{tool.description}</p>
                                        <div className="mt-auto pt-3">
                                          <Button
                                            size="sm"
                                            className="tool-run-cta h-8 w-full text-[10px] uppercase tracking-widest"
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
                  </div>
                </section>
              </div>
            ) : (
              <section className={cn('grid gap-4', activeTool ? 'grid-cols-1' : 'md:grid-cols-[280px_minmax(0,1fr)]')}>
                {!activeTool && (
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
                        return (
                          <button
                            key={tool.id}
                            type="button"
                            onClick={() => {
                              maybeOpenTool(tool);
                            }}
                            className={cn(
                              'relative w-full rounded-md border px-3 py-2 text-left transition-colors',
                              activeToolId === tool.id
                                ? 'border-[#76ff8f]/50 bg-[#14273e] text-[#e9f5ff]'
                                : 'border-[#2a3f5f] bg-[#0a1527] text-[#b4c7e3] hover:bg-[#12203a]',
                              !hasAccess && 'opacity-80'
                            )}
                          >
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
                          maybeOpenTool(selected);
                        }}
                      >
                        {tools.map((tool) => (
                          <option
                            key={tool.id}
                            value={tool.id}
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
                )}

                <div className="space-y-5">
                  {activeTool && (
                    <section
                      id="tool-workspace-anchor"
                      ref={toolWorkspaceRef}
                      className="mx-auto w-full max-w-[1100px] animate-in fade-in duration-200"
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[#9eb3d1] hover:bg-[#1a2d49]"
                            onClick={() => setActiveTool(null)}
                          >
                            ← Back to Toolbox
                          </Button>
                        </div>
                      </div>

                      {(() => {
                        const InlineToolComponent = INLINE_TOOL_COMPONENTS[activeTool.id];
                        if (!InlineToolComponent) {
                          return (
                            <div className="rounded-xl border border-dashed border-[#2a3f5f] bg-[#0a1527] p-5 text-sm text-[#a7b7d1]">
                              This tool is available in full mode only.
                            </div>
                          );
                        }
                        return (
                          <div className="inline-tool-host workspace-tool-host animate-in fade-in duration-200 [&_header]:hidden">
                            <InlineToolComponent />
                          </div>
                        );
                      })()}
                    </section>
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

'use client';

import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { ArrowRight, ChevronDown, CheckCircle2, Clock, FolderOpen, HelpCircle, Save, SlidersHorizontal, Sparkles, Zap } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { EmailGateModal } from '@/components/tools/email-gate-modal';
import { UpgradeModal } from '@/components/tools/upgrade-modal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useEntitlements } from '@/hooks/use-entitlements';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { cn } from '@/lib/utils';
import { useThemeMode } from '@/context/theme-provider';
import { touchAttribution } from '@/lib/consultant-referral';
import './tools-theme.css';
import { OnboardingSection } from '@/components/tools/onboarding-section';
import {
  canAccessTool,
  getFeaturedTool,
  isRecentTool,
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
  createToolboxFreeAccount,
  fetchToolboxEntitlements,
  fetchToolboxEntries,
  saveToolboxEntry,
  syncToolboxPaidStatus,
  trackToolUsageEvent,
  trackToolXpEvent,
  trackRecommendationEventServer,
} from '@/lib/tools/toolbox-client';
import { getRecommendedTools } from '@/lib/tools/recommendation';
import { readUserCxStatScore } from '@/lib/tools/cx-stats';
import { allRoles, type UserRole } from '@/lib/definitions';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOOLBOX_UPGRADE_URL = 'https://app.autodrivecx.com/signup';

function badgeText(label: 'Premium'): string {
  if (label === 'Premium') return 'Advanced';
  return label;
}

function ctaLabelForTool(tool: ToolConfig, canAccess: boolean): string {
  return 'Run Tool';
}

const INLINE_TOOL_COMPONENTS: Record<string, ComponentType> = {
  'what-happens-next': dynamic(() => import('@/app/tools/what-happens-next/page'), { ssr: false }),
  'first-90-second-trust-test': dynamic(() => import('@/app/tools/first-90-second-trust-test/page'), { ssr: false }),
  'fee-transparency-coach': dynamic(() => import('@/app/tools/fee-transparency-coach/page'), { ssr: false }),
  'pickup-experience-designer': dynamic(() => import('@/app/tools/pickup-experience-designer/page'), { ssr: false }),
  'repair-trust-builder': dynamic(() => import('@/app/tools/repair-trust-builder/page'), { ssr: false }),
  'wait-experience-coach': dynamic(() => import('@/app/tools/wait-experience-coach/page'), { ssr: false }),
  'pressure-drop-planner': dynamic(() => import('@/app/tools/pressure-drop-planner/page'), { ssr: false }),
  'pressure-diffuser': dynamic(() => import('@/app/tools/pressure-diffuser/page'), { ssr: false }),
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
type HeroRoleSegment = 'sales' | 'service' | 'management';

const MANAGEMENT_ROLE_SET = new Set<UserRole>([
  'manager',
  'Service Manager',
  'Finance Manager',
  'Parts Manager',
  'General Manager',
  'Owner',
  'Trainer',
  'Admin',
  'Developer',
]);

const SERVICE_ROLE_SET = new Set<UserRole>([
  'Service Writer',
  'Parts Consultant',
]);

function mapUserRoleToHeroSegment(role: UserRole | null | undefined): HeroRoleSegment | null {
  if (!role) return null;
  if (MANAGEMENT_ROLE_SET.has(role)) return 'management';
  if (SERVICE_ROLE_SET.has(role)) return 'service';
  return 'sales';
}

const DIAGNOSIS_TOOL_PRIORITY: Record<DiagnosisLabel, string[]> = {
  'Customer is stalling': ['fee-transparency-coach', 'objection-reframe', 'parts-objection-defuser', 'commitment-ladder'],
  'Deal lost momentum': ['objection-reframe', 'follow-up-cadence', 'status-update', 'loyalty-loop'],
  'Customer pushed back': ['fee-transparency-coach', 'objection-reframe', 'parts-objection-defuser', 'next-move-engine'],
  'I’m at numbers': ['fee-transparency-coach', 'desk-conversation', 'objection-reframe', 'price-presentation'],
  'Need to re-engage': ['follow-up-cadence', 'status-update', 'loyalty-loop', 'deal-recovery'],
  'Just tell me what to do': ['fee-transparency-coach', 'consistency-gap-check', 'objection-reframe', 'next-move-engine'],
};

const ROLE_DETAIL_TOOL_PRIORITY: Record<RoleDetailSelection, string[]> = {
  'Sales Consultant': ['objection-reframe', 'follow-up-cadence', 'deal-recovery', 'commitment-ladder', 'next-move-engine'],
  'Service Writer': ['clarity-check-builder', 'repair-trust-builder', 'repair-approval', 'status-update', 'waiter-update-flow', 'wait-experience-coach'],
  manager: ['team-coaching-converter', 'desk-conversation', 'consistency-gap-check', 'consistency-leak-finder', 'next-move-engine'],
  'Service Manager': ['consistency-gap-check', 'team-coaching-converter', 'repair-trust-builder', 'wait-experience-coach', 'status-update'],
  'Finance Manager': ['price-presentation', 'payment-comfort-mapper', 'objection-reframe', 'clarity-check-builder', 'desk-conversation'],
};

export default function ToolsPage() {
  const { toast } = useToast();
  const { user, firebaseUser, loading, setUser } = useAuth();
  const firebaseAuth = useFirebaseAuth();
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
  const [heroRoleSelection, setHeroRoleSelection] = useState<HeroRoleSegment | null>(null);
  const categoryFilters: Array<'Deal Flow' | 'Objections' | 'Follow-Up' | 'Pricing' | 'CX / Process' | 'Manager Tools'> = [
    'Deal Flow', 'Objections', 'Follow-Up', 'Pricing', 'CX / Process', 'Manager Tools',
  ];

  const tools = TOOLBOX_TOOLS;
  const featuredTool = useMemo(() => getFeaturedTool(tools), [tools]);
  const isAuthenticated = !!firebaseUser;
  const baseHasPaidAccess = resolvePaidAccess({
    tier: user?.tier,
    subscriptionStatus: user?.subscriptionStatus,
  });
  const baseHasAutoDriveCX = Boolean(user?.hasAutoDriveCX);

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
    hasPaidAccess: baseHasPaidAccess,
    hasAutoDriveCX: baseHasAutoDriveCX,
  });
  const isPaidUser = entitlements.hasPaidAccess;

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

  const activeDraft = activeTool ? drafts[activeTool.id] || '' : '';
  const activeToolId = activeTool?.id ?? null;
  const isWorkspaceMode = !!activeToolId;
  const displayName = (user?.name || '').trim().split(/\s+/)[0] || (user?.email || '');
  const accountEmail = accountProfile?.email || user?.email || firebaseUser?.email || '';
  const accountRole = (user?.role || accountProfile?.role || 'Sales Consultant') as ToolboxCapturedRole;
  const storedRole = (user?.role || accountProfile?.role || null) as UserRole | null;
  const resolvedHeroRole = useMemo(
    () => (isAuthenticated ? mapUserRoleToHeroSegment(storedRole) : heroRoleSelection),
    [heroRoleSelection, isAuthenticated, storedRole]
  );
  const historyGate = checkFeature(FEATURES.HISTORY);
  const intelligenceGate = checkFeature(FEATURES.AUTODRIVE_CX);
  const hasIntelligenceAccess = intelligenceGate.allowed;
  const shouldShowOnboarding = !entitlements.hasAccount && !entitlements.hasPaidAccess && !entitlements.hasAutoDriveCX;

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
    const cxScores = {
      empathy: readUserCxStatScore(user, 'empathy'),
      listening: readUserCxStatScore(user, 'listening'),
      trust: readUserCxStatScore(user, 'trust'),
      followUp: readUserCxStatScore(user, 'followUp'),
      closing: readUserCxStatScore(user, 'closing'),
      relationship: readUserCxStatScore(user, 'relationship'),
    };

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
      cxSignals: hasIntelligenceAccess ? {
        skillGaps: [
          ...(cxScores.trust < 60 ? ['trust'] : []),
          ...(cxScores.listening < 60 ? ['listening'] : []),
          ...(cxScores.followUp < 60 ? ['follow-up'] : []),
          ...(cxScores.closing < 60 ? ['closing'] : []),
          ...(cxScores.empathy < 60 ? ['empathy'] : []),
          ...(cxScores.relationship < 60 ? ['relationship'] : []),
        ],
        coachingSignals: [
          ...(cxScores.listening < 55 ? ['question-led listening'] : []),
          ...(cxScores.trust < 55 ? ['transparency framing'] : []),
          ...(cxScores.closing < 55 ? ['commitment confidence'] : []),
        ],
        performanceWeaknesses: [
          ...(cxScores.followUp < 55 ? ['follow-up consistency'] : []),
          ...(cxScores.relationship < 55 ? ['relationship consistency'] : []),
        ],
      } : null,
      recommendationEvents,
    });
  }, [accessibleToolIds, accountProfile?.role, entitlements.hasAccount, hasIntelligenceAccess, recentEntries, recommendationEvents, selectedIntentFilter, sessionOpenedToolIds, tools, usedToolIds, user]);

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
  const recommendationByToolId = useMemo(
    () => new Map(recommendationResult.recommendations.map((row) => [row.toolId, row] as const)),
    [recommendationResult.recommendations]
  );
  const cxScores = useMemo(
    () => ({
      empathy: readUserCxStatScore(user, 'empathy'),
      listening: readUserCxStatScore(user, 'listening'),
      trust: readUserCxStatScore(user, 'trust'),
      followUp: readUserCxStatScore(user, 'followUp'),
      closing: readUserCxStatScore(user, 'closing'),
      relationship: readUserCxStatScore(user, 'relationship'),
    }),
    [user]
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

  const contextualTools = useMemo(() => {
    if (!selectedDiagnosis) return [];

    const selectedOption = QUICK_DIAGNOSIS_OPTIONS.find((option) => option.label === selectedDiagnosis);
    const categoryFallback = selectedOption && selectedOption.filter !== 'all'
      ? tools.filter((tool) => tool.category === selectedOption.filter)
      : tools;

    const diagnosisTools = diagnosisPriorityToolIds
      .map((toolId) => tools.find((tool) => tool.id === toolId))
      .filter((tool): tool is ToolConfig => !!tool);

    const list = [
      ...diagnosisTools,
      recommendedPrimaryTool,
      ...recommendedSecondaryTools.map((r) => r.tool),
      ...categoryFallback,
    ].filter((t): t is ToolConfig => !!t);

    const seen = new Set<string>();
    return list.filter((tool) => {
      if (seen.has(tool.id)) return false;
      seen.add(tool.id);
      return true;
    }).slice(0, 6);
  }, [diagnosisPriorityToolIds, recommendedPrimaryTool, recommendedSecondaryTools, selectedDiagnosis, tools]);

  const recentToolNameForReason = useMemo(() => {
    const recentId = [...sessionOpenedToolIds, ...usedToolIds].reverse().find((id) => tools.some((tool) => tool.id === id));
    return recentId ? (tools.find((tool) => tool.id === recentId)?.name || null) : null;
  }, [sessionOpenedToolIds, usedToolIds, tools]);
  const diagnosisSubtitle = useMemo(() => {
    const byDiagnosis: Partial<Record<DiagnosisLabel, string>> = {
      'Customer is stalling': 'for breaking through this stall',
      'Deal lost momentum': 'for restoring deal momentum',
      'Customer pushed back': 'for handling this objection',
      'I’m at numbers': 'for presenting numbers with confidence',
      'Need to re-engage': 'for re-engaging this customer',
      'Just tell me what to do': 'for the fastest next move',
    };
    return selectedDiagnosis ? (byDiagnosis[selectedDiagnosis] || 'for this situation') : 'for this situation';
  }, [selectedDiagnosis]);

  const compactHeroContent = useMemo(() => {
    if (resolvedHeroRole === 'sales') {
      return {
        headline: 'Move more deals forward with confidence.',
        subtext: 'Handle objections cleanly, keep momentum, and choose the best next move faster.',
      };
    }

    if (resolvedHeroRole === 'service') {
      return {
        headline: 'Drive more approvals through trust and clarity.',
        subtext: 'Communicate recommendations clearly, strengthen customer confidence, and move work forward.',
      };
    }

    if (resolvedHeroRole === 'management') {
      return {
        headline: 'Coach consistency across every customer conversation.',
        subtext: 'Build repeatable behaviors, sharpen team execution, and improve performance at scale.',
      };
    }

    return {
      headline: 'Build a system that actually moves deals.',
      subtext: 'For consultants and managers who want consistent wins.',
    };
  }, [resolvedHeroRole]);

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
    const storedHeroRole = window.localStorage.getItem('autodrive_hero_role');

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
    if (storedHeroRole === 'sales' || storedHeroRole === 'service' || storedHeroRole === 'management') {
      setHeroRoleSelection(storedHeroRole);
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
    if (typeof window === 'undefined' || isAuthenticated) return;
    if (heroRoleSelection) {
      window.localStorage.setItem('autodrive_hero_role', heroRoleSelection);
    } else {
      window.localStorage.removeItem('autodrive_hero_role');
    }
  }, [heroRoleSelection, isAuthenticated]);

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

  function deriveNameFromEmail(email: string): string {
    const localPart = (email || '').split('@')[0] || '';
    const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
    if (!cleaned) return 'Member';
    return cleaned
      .split(/\s+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  function skillCategoryForTool(tool: ToolConfig): 'Empathy' | 'Listening' | 'Trust' | 'Follow-Up' | 'Closing' | 'Relationship Building' {
    if (tool.category === 'Follow-Up') return 'Follow-Up';
    if (tool.category === 'Pricing') return 'Closing';
    if (tool.category === 'Objections') return 'Trust';
    if (tool.category === 'CX / Process') return 'Relationship Building';
    if (tool.category === 'Manager Tools') return 'Listening';
    return 'Empathy';
  }

  async function awardToolXp(input: {
    tool: ToolConfig;
    eventType: 'tool_first_use' | 'tool_completion' | 'tool_session_completion';
    baseXP: number;
    idempotencyKey: string;
  }) {
    if (!firebaseUser || !user?.userId) return;

    const bonusXP = (entitlements.hasPaidAccess && entitlements.hasAutoDriveCX)
      ? Math.round(input.baseXP * 0.5)
      : 0;

    const idToken = await firebaseUser.getIdToken();
    const result = await trackToolXpEvent({
      idToken,
      idempotencyKey: input.idempotencyKey,
      userId: user.userId,
      toolId: input.tool.id,
      eventType: input.eventType,
      baseXP: input.baseXP,
      bonusXP,
      skillCategory: skillCategoryForTool(input.tool),
      entitlementStatus: entitlements.hasPaidAccess && entitlements.hasAutoDriveCX ? 'paid' : 'free',
      timestamp: new Date().toISOString(),
    });

    if (!result.ok) {
      console.warn('[Toolbox XP] event failed:', result.message);
      return;
    }

    if (typeof result.data.totalXp === 'number' && user) {
      setUser({
        ...user,
        xp: result.data.totalXp,
      });
    }
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

  function openTool(tool: ToolConfig, source: 'tools_page' | 'recommended_tool' = 'tools_page') {
    const wasFirstUse = !usedToolIds.includes(tool.id);
    setActiveTool(tool);
    setSessionOpenedToolIds((current) => (current.includes(tool.id) ? current : [...current, tool.id]));
    registerToolUsage(tool.id);
    void (async () => {
      const idToken = firebaseUser ? await firebaseUser.getIdToken() : undefined;
      await trackToolUsageEvent({
        toolId: tool.id,
        source,
        role: user?.role || accountRole,
        idToken,
      });
    })();

    if (wasFirstUse) {
      void awardToolXp({
        tool,
        eventType: 'tool_first_use',
        baseXP: 20,
        idempotencyKey: `tool-first-use:${tool.id}`,
      });
    }
  }

  function openToolExperience(tool: ToolConfig, source: 'tools_page' | 'recommended_tool' = 'tools_page') {
    openTool(tool, source);
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
    if (!canOpenTool(tool)) {
      requireFeature(FEATURES.TOOL_ACCESS, undefined, tool);
      return;
    }

    openToolExperience(tool, 'recommended_tool');
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

  async function handleCreateAccount(input: { email: string; password: string; role: ToolboxCapturedRole }) {
    const email = input.email.trim().toLowerCase();
    if (!emailRegex.test(email)) {
      toast({ variant: 'destructive', title: 'Enter a valid email' });
      return;
    }
    if (input.password.trim().length < 8) {
      toast({ variant: 'destructive', title: 'Password must be at least 8 characters.' });
      return;
    }

    setIsEmailSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email, input.password.trim());
      const idToken = await credential.user.getIdToken(true);

      await fetch('/api/auth/bootstrap-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email,
          name: deriveNameFromEmail(email),
          signupRoleInterest: input.role,
        }),
      });

      setLocalAccountProfile({ email, role: input.role });
      refreshLocalEntitlements();

      const bootstrapResult = await createToolboxFreeAccount({
        idToken,
        localEntries: exportTempDraftsAsEntries(),
        toolsUsedCount: entitlements.usage.toolsUsedCount,
        accountProfile: { email, role: input.role },
      });
      if (bootstrapResult.ok && bootstrapResult.data.entitlements) {
        setServerEntitlements(bootstrapResult.data.entitlements);
      }

      touchAttribution('strong', 'account_created_tools_gate');
      setShowEmailGate(false);
      setShowAccountSuccess(true);
      clearTempDrafts();

      const queuedTool = pendingToolToOpen;
      setPendingToolToOpen(null);
      setPendingGateFeature(null);
      if (queuedTool) {
        openToolExperience(queuedTool);
      } else if (!activeTool) {
        openToolExperience(featuredTool);
      }

      toast({
        title: 'System Unlocked',
        description: 'Your account is active and all tools are now available.',
      });
    } catch (error: any) {
      const message = error?.code === 'auth/email-already-in-use'
        ? 'That email already has an account. Sign in to continue.'
        : (error?.message || 'Could not create account.');
      toast({ variant: 'destructive', title: 'Account setup failed', description: message });
    } finally {
      setIsEmailSubmitting(false);
    }
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
      title: 'Complete upgrade to unlock intelligence',
      description: 'Finish checkout, then return here. Guided coaching and smarter recommendations will unlock automatically.',
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
      toast({ title: 'Upgrade complete', description: 'Intelligence features are now unlocked on this account.' });
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
      toast({ variant: 'destructive', title: result.message });
      return;
    }

    setRecentEntries((current) => [result.data.entry, ...current].slice(0, 12));
    setIsSavingEntry(false);

    void awardToolXp({
      tool: activeTool,
      eventType: 'tool_completion',
      baseXP: 40,
      idempotencyKey: `tool-completion:${activeTool.id}:${new Date().toISOString().slice(0, 10)}`,
    });

    toast({ title: 'Saved', description: 'Your note is now available in recent work.' });
  }

  function handleDraftChange(toolId: string, value: string) {
    setDrafts((current) => ({ ...current, [toolId]: value }));

    if (!entitlements.hasPaidAccess) {
      writeTempDraft(toolId, value);
    }
  }

  function buildSprocketLayerOutput(input: string) {
    const normalized = input.trim();
    const lowConfidence = /(maybe|not sure|i think|probably|guess)/i.test(normalized);
    const priceFriction = /(price|payment|budget|cost)/i.test(normalized);
    const trustFriction = /(trust|concern|hesitat|nervous|unsure)/i.test(normalized);
    const cxScores = [
      { label: 'Empathy', score: readUserCxStatScore(user, 'empathy') },
      { label: 'Listening', score: readUserCxStatScore(user, 'listening') },
      { label: 'Trust', score: readUserCxStatScore(user, 'trust') },
      { label: 'Follow-Up', score: readUserCxStatScore(user, 'followUp') },
      { label: 'Closing', score: readUserCxStatScore(user, 'closing') },
      { label: 'Relationship', score: readUserCxStatScore(user, 'relationship') },
    ].sort((a, b) => a.score - b.score);
    const weakest = cxScores[0];
    const hasCxGap = entitlements.hasAutoDriveCX && weakest.score < 60;
    const cxOverlay = hasCxGap
      ? ` CX signal: ${weakest.label} is low (${Math.round(weakest.score)}), so lead with that correction first.`
      : '';

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
      coaching: `Lead with clarity, then confirmation, then commitment. Avoid jumping to details before alignment.${cxOverlay}`,
      prioritization: `${trustFriction ? 'Priority: trust -> clarity -> close' : 'Priority: clarity -> value -> close'}${hasCxGap ? ` | CX: ${weakest.label}` : ''}`,
    };
  }

  function buildCxLayerOutput(input: string) {
    const normalized = input.trim().toLowerCase();
    const followUpGap = /(follow|later|tomorrow|next week)/.test(normalized);
    const listeningGap = /(i told|already said|again)/.test(normalized);
    const followUpScore = readUserCxStatScore(user, 'followUp');
    const listeningScore = readUserCxStatScore(user, 'listening');
    const trustScore = readUserCxStatScore(user, 'trust');
    const weakest = [
      { label: 'Follow-up reliability', score: followUpScore },
      { label: 'Listening precision', score: listeningScore },
      { label: 'Trust framing', score: trustScore },
    ].sort((a, b) => a.score - b.score)[0];

    return {
      insight: followUpGap
        ? `Pattern trend: follow-up timing drift is reducing momentum. AutoDriveCX score signal: ${weakest.label} (${Math.round(weakest.score)}).`
        : `Pattern trend: next-step clarity is the highest leverage behavior. AutoDriveCX score signal: ${weakest.label} (${Math.round(weakest.score)}).`,
      personalization: listeningGap
        ? 'Personalized coaching: mirror customer language once before advancing the conversation.'
        : 'Personalized coaching: tighten next-step statements to one action and one time.',
      focus: [
        followUpGap || followUpScore < 58 ? 'Follow-up reliability' : 'Next-step precision',
        listeningGap || listeningScore < 58 ? 'Listening effectiveness' : 'Tone and pacing consistency',
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
                  ? 'border-[#76ff8f]/45 bg-[#9DEE75]/12 text-[#b4ffbf]'
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
                  ? 'border-[#76ff8f]/45 bg-[#9DEE75]/12 text-[#b4ffbf]'
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
                  ? 'border-[#76ff8f]/45 bg-[#9DEE75]/12 text-[#b4ffbf]'
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
        <Button type="button" className="bg-[#9DEE75] text-[#0d1d11] hover:bg-[#ABF28A]" onClick={handleApplyFilters}>
          Apply
        </Button>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'tools-theme relative min-h-screen overflow-hidden pb-24',
        resolvedTheme === 'light' && 'tools-theme-light'
      )}
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-[#7b2eff]/[0.08] blur-3xl" />
      <div className="relative z-10">
        <Header />

        <main className="mx-auto w-full max-w-7xl space-y-6 p-4 md:space-y-8 md:p-6 lg:p-8">
          <section className="relative space-y-4 transition-all duration-200">
            <div
              className={cn(
                'flex flex-wrap items-center justify-between gap-3 transition-all duration-200',
                isWorkspaceMode && 'opacity-60'
              )}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-[#76ff8f]/30 bg-[#111b2d] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9bffac]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9DEE75]" />
                New tool drops every week
              </div>
            </div>

          {/* Welcome Area */}
          <section className="mb-4">
            {shouldShowOnboarding ? (
              <OnboardingSection
                isAuthenticated={isAuthenticated}
                onCreateAccount={() => setShowEmailGate(true)}
                heroRole={resolvedHeroRole}
                onHeroRoleChange={setHeroRoleSelection}
                onDismiss={() => {
                  const anchor = document.getElementById('quick-diagnosis-anchor');
                  if (anchor) {
                    anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              />
            ) : (
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
                  {compactHeroContent.headline}
                </h1>
                <p className="text-sm text-[#9db0cb]">
                  {compactHeroContent.subtext}
                </p>
                <p className="text-[11px] text-[#6f84a7] font-medium leading-none">
                  Pick what’s happening, we’ll guide your next move.
                </p>
              </div>
            )}
          </section>

            {!activeTool && (
              <div className="tool-card-surface featured-tool-banner animate-in fade-in duration-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7B2EFF]">
                      This Week&apos;s Featured Tool
                    </p>
                    <p className="truncate text-base font-bold text-[#FFFFFF]">{featuredTool.name}</p>
                    <p className="line-clamp-1 text-sm text-[#B8B8C5]">{featuredTool.description}</p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => maybeOpenTool(featuredTool)}
                    className="h-10 w-full border-[#2f415f] bg-[#0d1728] text-xs text-[#e8f1ff] transition-all hover:bg-[#12203a] active:scale-[0.95] sm:w-auto sm:min-w-[220px]"
                  >
                    Open Featured Tool
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {!activeTool && (
              <div className="animate-in fade-in duration-200" id="quick-diagnosis-anchor">
                <div className="tool-control-panel rounded-xl p-2 md:p-3">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 px-2 pb-1">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#FFFFFF]">
                        What&apos;s happening right now?
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {QUICK_DIAGNOSIS_OPTIONS.map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          aria-pressed={selectedDiagnosis === opt.label}
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
                          className={cn(
                            'diagnosis-card group relative flex items-center gap-3 rounded-lg border bg-[#1A1A24] p-4 text-left transition-all duration-200 active:scale-[0.99]',
                            'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
                            selectedDiagnosis === opt.label
                              ? 'border-[#7B2EFF] bg-[#1c1630] shadow-[0_8px_18px_rgba(123,46,255,0.16)]'
                              : 'border-[#2A2A38] hover:-translate-y-[2px] hover:border-[#7B2EFF]/50 hover:bg-[#181828]'
                          )}
                        >
                          <div className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-[#12121A] transition-all',
                            selectedDiagnosis === opt.label
                              ? 'border-[#7B2EFF]/60 text-[#c9a9ff]'
                              : 'border-[#2A2A38] text-[#7B2EFF] group-hover:border-[#7B2EFF]/40'
                          )}>
                            {opt.filter === 'all' ? <HelpCircle className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#FFFFFF]">{opt.label}</p>
                            <p className="text-[11px] text-[#B8B8C5]">{opt.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    {selectedDiagnosis && contextualTools.length > 0 && (
                      <div className="mt-2 border-t border-[#2A2A38] pt-4">
                        {diagnosisFeedback && (
                          <div className="px-1 pb-2 animate-in fade-in slide-in-from-left-4 duration-500">
                            <p className="flex items-center gap-3 text-sm font-black tracking-wide text-[#76ff8f]">
                              <CheckCircle2 className="h-4 w-4" />
                              {diagnosisFeedback}
                            </p>
                          </div>
                        )}
                        <div className="px-1 pb-3">
                          <h3 className="text-lg font-semibold text-[#FFFFFF]">Best Next Moves</h3>
                          <p className="text-sm text-[#B8B8C5]">
                            {diagnosisSubtitle}
                          </p>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
                          {contextualTools.map((tool) => (
                            <Card
                              key={tool.id}
                              className="tool-card-surface group relative flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-[2px]"
                            >
                              <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold tracking-tight text-[#FFFFFF]">
                                  {tool.name}
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="flex flex-1 flex-col p-4 pt-0">
                                <p className="line-clamp-1 text-[12px] font-medium text-[#B8B8C5]">{tool.description}</p>
                                <div className="mt-4">
                                  <Button size="sm" className="tool-run-cta text-[11px] uppercase tracking-widest" onClick={() => maybeOpenTool(tool)}>
                                    Run Tool
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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
                      aria-pressed={selectedRoleType === 'sales_advisor'}
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
                          ? 'border-[#76ff8f]/45 bg-[#9DEE75]/12 text-[#b4ffbf]'
                          : 'border-[#2f466a] bg-[#0e1a30] text-[#a4b6d2] hover:bg-[#15243f]'
                      )}
                    >
                      Sales / Advisor
                    </button>
                    <button
                      type="button"
                      aria-pressed={selectedRoleType === 'manager'}
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
                          ? 'border-[#76ff8f]/45 bg-[#9DEE75]/12 text-[#b4ffbf]'
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
                            aria-pressed={selectedRoleDetail === roleOption.value}
                            onClick={() => {
                              setSelectedRoleDetail(roleOption.value);
                              setIsRoleSelectorExpanded(false);
                            }}
                            className={cn(
                              'rounded-full border px-4 py-2 text-[11px] font-semibold tracking-wide transition-all active:scale-[0.97]',
                              selectedRoleDetail === roleOption.value
                                ? 'border-[#76ff8f]/45 bg-[#9DEE75]/12 text-[#b4ffbf]'
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

          </section>

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
                {/* 3. Tool Library (Secondary) */}
                <section className="pt-2" id="all-tools-anchor">
                  <p className="px-1 pb-3 text-sm font-semibold text-[#B8B8C5]">Or browse all tools</p>
                  <div className="tool-control-panel rounded-xl border border-[#253956] bg-[#0d182b] p-4 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all hover:bg-[#11213a]/40 md:p-5">
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
                            Find the right tool fast
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
                              <h3 className="tool-section-header flex items-center gap-2 px-1 text-lg font-bold">
                                <span className="h-4 w-1 rounded-full bg-[#7B2EFF]" />
                                {group.label}
                              </h3>
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {groupTools.map((tool) => {
                                  return (
                                    <Card
                                      key={tool.id}
                                      className="tool-card-surface group relative flex flex-col overflow-hidden transition-all"
                                    >
                                      <CardHeader className="p-4 pb-2">
                                        <CardTitle className="text-sm font-black tracking-tight text-[#ffffff]">{tool.name}</CardTitle>
                                      </CardHeader>
                                      <CardContent className="flex flex-1 flex-col p-4 pt-0">
                                        <p className="line-clamp-1 text-[12px] font-medium text-[#B8B8C5]">{tool.description}</p>
                                        <div className="mt-4 pt-1">
                                          <Button
                                            size="sm"
                                            className="tool-run-cta h-9 w-full text-[11px] uppercase tracking-widest"
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

                {/* 4. Continue where you left off */}
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
                            className="flex items-center justify-between gap-4 p-4 transition-all hover:bg-[#111f35]"
                          >
                            <div className="min-w-0 flex-1 flex items-center gap-3">
                              <div className="h-2 w-2 rounded-full bg-[#9DEE75] shrink-0 animate-pulse" />
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
              </div>
            ) : (
              <section className={cn('grid gap-4', activeTool ? 'grid-cols-1' : 'md:grid-cols-[280px_minmax(0,1fr)]')}>
                {!activeTool && (
                <aside className="space-y-3 md:sticky md:top-20 md:h-fit">
                  <Card className="border-[#263b5a] bg-[#0d192c]">
                    <CardHeader className="border-b border-[#203352] bg-[#111f35] py-4">
                      <CardTitle className="flex items-center justify-between text-base text-[#edf5ff]">
                        <span>AutoShop</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[#9eb3d1] hover:bg-[#1a2d49]"
                          onClick={() => setActiveTool(null)}
                        >
                          Back to AutoShop
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
                              'relative w-full rounded-md border px-3 py-2 text-left transition-all',
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
                        Back to AutoShop
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
                            ← Back to AutoShop
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
          onSubmit={handleCreateAccount}
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

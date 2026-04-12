'use client';

import { useEffect, useState, useCallback, useMemo, type ComponentType } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { ConsultantDashboard } from '@/components/dashboard/consultant-dashboard';
import { ManagerDashboard } from '@/components/dashboard/manager-dashboard';
import { Spinner } from '@/components/ui/spinner';
import { allRoles, managerialRoles, UserRole, User, Dealership, FreshUpArchetypeCategory, FreshUpSandboxConfig } from '@/lib/definitions';
import { hasDealershipAssignment } from '@/lib/billing/access';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Header } from '@/components/layout/header';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Copy,
  Download,
  ExternalLink,
  FlaskConical,
  Home,
  Menu,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { getManageableUsers, getDealerships, updateDealershipToolboxAccess } from '@/lib/data.client';
import { RegisterDealershipForm } from '@/components/admin/register-dealership-form';
import { RemoveUserForm } from '@/components/admin/remove-user-form';
import { CreateDealershipForm } from '@/components/admin/create-dealership-form';
import { CreateUserForm } from '@/components/admin/create-user-form';
import { AssignDealershipsForm } from '@/components/admin/assign-dealerships-form';
import { ManageDealershipForm } from '@/components/admin/ManageDealershipForm';
import { EditUserForm } from '@/components/admin/edit-user-form';
import { PppProtocolSettings } from '@/components/admin/ppp-protocol-settings';
import { AutoForgeLeadsPanel } from '@/components/developer/autoforge-leads-panel';
import { SprocketActivityPanel } from '@/components/developer/sprocket-activity-panel';
import { ToolUsageMonitoringPanel } from '@/components/developer/tool-usage-monitoring-panel';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FRESH_UP_LESSON_ID } from '@/lib/fresh-up';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { runFreshUpQAMatrix, runFreshUpQAVersionComparison, storeFreshUpQATestRun, type FreshUpQASimulationConfig, type FreshUpQASessionResult, type FreshUpQASummary, type FreshUpQAVersionComparisonResult } from '@/lib/fresh-up-qa';
import { evaluateFreshUpPromotionSafety, getFreshUpReleaseState, getFreshUpReleaseVersions, rollbackFreshUpProductionVersion, setFreshUpProductionVersion, setFreshUpSandboxDefaultVersion, type FreshUpReleaseSafetyCheck, type FreshUpReleaseVersion } from '@/lib/fresh-up-release';
import { getAisInteractionLabel } from '@/lib/ais-role-adaptive';
import { interpretAisScore, type AisMetricName } from '@/lib/ais-score-interpretation';
import { getRoleLabels, resolveRoleLabelKeyFromAisRoleType } from '@/config/roleLabels';
import { CONVERSATION_TEMPO_PROFILES } from '@/config/conversationTempoProfiles';
import { buildConsultantOutreachLink } from '@/lib/consultant-share-links';

type DashboardMode = 'role_based' | 'single_user';
type SectionId =
  | 'dashboard'
  | 'people_access'
  | 'dealerships'
  | 'revenue_growth'
  | 'leads'
  | 'product_controls'
  | 'monitoring'
  | 'sandbox'
  | 'danger';
type ToolId =
  | 'create_user'
  | 'edit_user'
  | 'assign_dealerships'
  | 'invite'
  | 'remove'
  | 'create_dealership'
  | 'manage_dealerships'
  | 'ppp_global';

type LiveCxTrait = 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationship';
type LiveCxScores = Record<LiveCxTrait, number>;
type ConsultantPickerOption = {
  name: string;
  referral_code?: string;
  referralCode?: string;
};
type AkLeaderboardRow = {
  consultant: string;
  sales: number;
  monthly_revenue: number;
};
type AkPayoutRecord = {
  consultant_id: string;
  amount: number;
  commission_amount: number;
  status: 'pending' | 'approved' | 'voided' | 'paid';
  period_start: string;
  created_at: string;
};
type AkPayoutResponse = {
  records: AkPayoutRecord[];
};
type SignalMapperUnlockRow = {
  email: string;
  firstUnlockedAt: string;
  lastUnlockedAt: string;
  count: number;
};

const LIVE_CX_TRAITS: Array<{ key: LiveCxTrait; label: string }> = [
  { key: 'empathy', label: 'Empathy' },
  { key: 'listening', label: 'Listening' },
  { key: 'trust', label: 'Trust' },
  { key: 'followUp', label: 'Follow Up' },
  { key: 'closing', label: 'Closing' },
  { key: 'relationship', label: 'Relationship' },
];

const BENCHMARK_PRESET: LiveCxScores = {
  empathy: 75,
  listening: 75,
  trust: 75,
  followUp: 75,
  closing: 75,
  relationship: 75,
};

const SECTION_LABELS: Record<SectionId, string> = {
  dashboard: 'Dashboard',
  people_access: 'People & Access',
  dealerships: 'Dealerships',
  revenue_growth: 'Revenue & Growth',
  leads: 'Leads',
  product_controls: 'Product Controls',
  monitoring: 'Monitoring',
  sandbox: 'Sandbox',
  danger: 'Danger Zone',
};

const SECTION_DESCRIPTIONS: Record<SectionId, string> = {
  dashboard: 'System pulse, quick actions, and the most common admin jumps.',
  people_access: 'Manage users, roles, invitations, assignments, and access changes.',
  dealerships: 'Create dealerships and manage dealership-level settings.',
  revenue_growth: 'Consultant performance, public links, lead capture, and growth surfaces.',
  leads: 'All captured lead flows, inboxes, activity streams, and source-specific pipelines.',
  product_controls: 'Feature access, PPP configuration, and product-level controls.',
  monitoring: 'Operational watchlists, activity streams, exports, and diagnostics.',
  sandbox: 'Safe preview tools for impersonation and CX simulation.',
  danger: 'High-risk operations with explicit confirmation.',
};

const SECTION_ICONS: Record<SectionId, ComponentType<{ className?: string }>> = {
  dashboard: Home,
  people_access: Users,
  dealerships: Building2,
  revenue_growth: BarChart3,
  leads: Activity,
  product_controls: Settings2,
  monitoring: Activity,
  sandbox: FlaskConical,
  danger: AlertTriangle,
};

const SECTION_ORDER: SectionId[] = [
  'dashboard',
  'people_access',
  'dealerships',
  'revenue_growth',
  'leads',
  'product_controls',
  'monitoring',
  'sandbox',
  'danger',
];

const TOOLS: Array<{ id: ToolId; label: string; section: SectionId }> = [
  { id: 'create_user', label: 'Create User', section: 'people_access' },
  { id: 'edit_user', label: 'Edit User', section: 'people_access' },
  { id: 'assign_dealerships', label: 'Assign Dealerships', section: 'people_access' },
  { id: 'invite', label: 'Invitations', section: 'people_access' },
  { id: 'remove', label: 'Remove User', section: 'danger' },
  { id: 'create_dealership', label: 'Create Dealership', section: 'dealerships' },
  { id: 'manage_dealerships', label: 'Dealership Settings', section: 'dealerships' },
  { id: 'ppp_global', label: 'PPP Global', section: 'product_controls' },
];

const BOTTOM_NAV_SECTIONS: SectionId[] = ['dashboard', 'people_access', 'dealerships', 'revenue_growth', 'leads', 'product_controls', 'monitoring', 'sandbox'];
const SANDBOX_SOURCE_TYPES: Array<{ value: FreshUpSandboxConfig['sourceType']; label: string }> = [
  { value: 'procedural', label: 'Procedural Customer' },
  { value: 'signature', label: 'Signature Scenario' },
  { value: 'random', label: 'Random' },
];
const SANDBOX_ROLE_TYPES: Array<{ value: FreshUpSandboxConfig['roleType']; label: string }> = [
  { value: 'sales', label: 'Sales' },
  { value: 'service', label: 'Service' },
  { value: 'parts', label: 'Parts' },
  { value: 'fi', label: 'F&I' },
  { value: 'random', label: 'Random' },
];
const SANDBOX_ROLE_LABEL_TYPES: Array<{ value: NonNullable<FreshUpSandboxConfig['roleLabelKey']>; label: string }> = [
  { value: 'sales', label: 'Sales' },
  { value: 'service', label: 'Service' },
  { value: 'parts', label: 'Parts' },
  { value: 'fi', label: 'F&I' },
  { value: 'manager', label: 'Manager' },
  { value: 'gm', label: 'General Manager' },
  { value: 'random', label: 'Random' },
];
const SANDBOX_ENGINE_ROLE_BY_LABEL: Record<Exclude<NonNullable<FreshUpSandboxConfig['roleLabelKey']>, 'random'>, Exclude<FreshUpSandboxConfig['roleType'], 'random'>> = {
  sales: 'sales',
  service: 'service',
  parts: 'parts',
  fi: 'fi',
  manager: 'sales',
  gm: 'sales',
};
const SANDBOX_DIFFICULTIES: Array<{ value: FreshUpSandboxConfig['difficulty']; label: string }> = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'random', label: 'Random' },
];
const SANDBOX_VEHICLES: Array<{ value: FreshUpSandboxConfig['vehicleInterest']; label: string }> = [
  { value: 'SUV', label: 'SUV' },
  { value: 'truck', label: 'Truck' },
  { value: 'sedan', label: 'Sedan' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'EV', label: 'EV' },
  { value: 'performance vehicle', label: 'Performance Vehicle' },
  { value: 'family vehicle', label: 'Family Vehicle' },
  { value: 'random', label: 'Random' },
];
const SANDBOX_PRIMARY_CONCERNS: Array<{ value: FreshUpSandboxConfig['primaryConcern']; label: string }> = [
  { value: 'price', label: 'Price' },
  { value: 'trade value', label: 'Trade Value' },
  { value: 'monthly payment', label: 'Monthly Payment' },
  { value: 'reliability', label: 'Reliability' },
  { value: 'technology confusion', label: 'Technology Confusion' },
  { value: 'fuel economy', label: 'Fuel Economy' },
  { value: 'safety', label: 'Safety' },
  { value: 'time efficiency', label: 'Time Efficiency' },
  { value: 'random', label: 'Random' },
];
const SANDBOX_MOODS: Array<{ value: FreshUpSandboxConfig['startingMood']; label: string }> = [
  { value: 'cautious', label: 'Cautious' },
  { value: 'curious', label: 'Curious' },
  { value: 'stressed', label: 'Stressed' },
  { value: 'excited', label: 'Excited' },
  { value: 'guarded', label: 'Guarded' },
  { value: 'frustrated', label: 'Frustrated' },
  { value: 'optimistic', label: 'Optimistic' },
  { value: 'random', label: 'Random' },
];
const SANDBOX_PERSONALITIES: Array<{ value: FreshUpSandboxConfig['personalityType']; label: string }> = [
  { value: 'analytical', label: 'Analytical' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'skeptical', label: 'Skeptical' },
  { value: 'impatient', label: 'Impatient' },
  { value: 'overwhelmed', label: 'Overwhelmed' },
  { value: 'excited', label: 'Excited' },
  { value: 'defensive', label: 'Defensive' },
  { value: 'random', label: 'Random' },
];
const SANDBOX_COMMUNICATION_STYLES: Array<{ value: FreshUpSandboxConfig['communicationStyle']; label: string }> = [
  { value: 'talkative', label: 'Talkative' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'direct', label: 'Direct' },
  { value: 'sarcastic', label: 'Sarcastic' },
  { value: 'story-driven', label: 'Story-Driven' },
  { value: 'cautious', label: 'Cautious' },
  { value: 'rapid-fire questions', label: 'Rapid-Fire Questions' },
  { value: 'random', label: 'Random' },
];
const AIS_METRIC_OPTIONS: Array<{ value: AisMetricName; label: string }> = [
  { value: 'empathy', label: 'Empathy' },
  { value: 'listening', label: 'Listening' },
  { value: 'trust', label: 'Trust' },
  { value: 'followUp', label: 'Follow Up' },
  { value: 'closing', label: 'Closing' },
  { value: 'relationship', label: 'Relationship' },
];
const QA_SOURCE_TYPES: Array<{ value: FreshUpQASimulationConfig['sourceType']; label: string }> = [
  { value: 'procedural', label: 'Procedural Customer' },
  { value: 'signature', label: 'Signature Scenario' },
  { value: 'mixed', label: 'Mixed' },
];
const QA_DIFFICULTY_RANGES: Array<{ value: FreshUpQASimulationConfig['difficultyRange']; label: string }> = [
  { value: 'easy', label: 'Easy Only' },
  { value: 'medium', label: 'Medium Only' },
  { value: 'hard', label: 'Hard Only' },
  { value: 'mixed', label: 'Mixed' },
];
const QA_VEHICLE_OPTIONS = [
  { value: 'SUV', label: 'SUV' },
  { value: 'truck', label: 'Truck' },
  { value: 'sedan', label: 'Sedan' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'EV', label: 'EV' },
  { value: 'performance vehicle', label: 'Performance' },
  { value: 'family vehicle', label: 'Family Vehicle' },
  { value: 'Random', label: 'Random' },
];
const QA_PRIMARY_CONCERN_OPTIONS = [
  { value: 'price', label: 'Price' },
  { value: 'trade value', label: 'Trade Value' },
  { value: 'monthly payment', label: 'Monthly Payment' },
  { value: 'reliability', label: 'Reliability' },
  { value: 'technology confusion', label: 'Technology Confusion' },
  { value: 'fuel economy', label: 'Fuel Economy' },
  { value: 'safety', label: 'Safety' },
  { value: 'time efficiency', label: 'Time Efficiency' },
];
const QA_PERSONALITY_OPTIONS = [
  { value: 'analytical', label: 'Analytical' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'skeptical', label: 'Skeptical' },
  { value: 'impatient', label: 'Impatient' },
  { value: 'overwhelmed', label: 'Overwhelmed' },
  { value: 'excited', label: 'Excited' },
  { value: 'defensive', label: 'Defensive' },
];
const QA_COMMUNICATION_OPTIONS = [
  { value: 'talkative', label: 'Talkative' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'direct', label: 'Direct' },
  { value: 'sarcastic', label: 'Sarcastic' },
  { value: 'story-driven', label: 'Story Driven' },
  { value: 'cautious', label: 'Cautious' },
  { value: 'rapid-fire questions', label: 'Rapid Fire Questions' },
];
const QA_MOOD_OPTIONS = [
  { value: 'cautious', label: 'Cautious' },
  { value: 'curious', label: 'Curious' },
  { value: 'stressed', label: 'Stressed' },
  { value: 'excited', label: 'Excited' },
  { value: 'guarded', label: 'Guarded' },
  { value: 'frustrated', label: 'Frustrated' },
  { value: 'optimistic', label: 'Optimistic' },
];
const QA_ARCHETYPE_CATEGORY_OPTIONS: Array<{ value: FreshUpArchetypeCategory; label: string }> = [
  { value: 'friendly', label: 'Friendly' },
  { value: 'curious', label: 'Curious' },
  { value: 'funny', label: 'Funny' },
  { value: 'analytical', label: 'Analytical' },
  { value: 'skeptical', label: 'Skeptical' },
  { value: 'budget_focused', label: 'Budget Focused' },
  { value: 'high_stakes', label: 'High Stakes' },
  { value: 'family_complex', label: 'Family Complex' },
  { value: 'emotional', label: 'Emotional' },
  { value: 'unusual', label: 'Unusual' },
];
const SANDBOX_TEMPO_OPTIONS = CONVERSATION_TEMPO_PROFILES.map((profile) => ({
  value: profile.tempoId,
  label: profile.name,
}));

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function togglePoolValue(pool: string[], value: string): string[] {
  if (pool.includes(value)) return pool.filter((item) => item !== value);
  return [...pool, value];
}

function buildLiveCxScoresFromUser(user: User): LiveCxScores {
  return {
    empathy: clampScore(user.stats?.empathy?.score ?? 60),
    listening: clampScore(user.stats?.listening?.score ?? 60),
    trust: clampScore(user.stats?.trust?.score ?? 60),
    followUp: clampScore(user.stats?.followUp?.score ?? 60),
    closing: clampScore(user.stats?.closing?.score ?? 60),
    relationship: clampScore(user.stats?.relationship?.score ?? 60),
  };
}

function buildDefaultLiveCxScores(): LiveCxScores {
  return {
    empathy: 60,
    listening: 60,
    trust: 60,
    followUp: 60,
    closing: 60,
    relationship: 60,
  };
}

function buildUserStatsFromLiveScores(scores: LiveCxScores): User['stats'] {
  const now = new Date();
  return {
    empathy: { score: scores.empathy, lastUpdated: now },
    listening: { score: scores.listening, lastUpdated: now },
    trust: { score: scores.trust, lastUpdated: now },
    followUp: { score: scores.followUp, lastUpdated: now },
    closing: { score: scores.closing, lastUpdated: now },
    relationship: { score: scores.relationship, lastUpdated: now },
  };
}

export default function DeveloperPage() {
  const { user, loading, setUser, originalUser } = useAuth();
  const firebaseAuth = useFirebaseAuth();
  const { toast } = useToast();
  const router = useRouter();
  const originalUserIsAssigned = !!originalUser && hasDealershipAssignment(originalUser);

  const [manageableUsers, setManageableUsers] = useState<User[]>([]);
  const [allDealerships, setAllDealerships] = useState<Dealership[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [activeSection, setActiveSection] = useState<SectionId>('dashboard');
  const [activeTool, setActiveTool] = useState<ToolId>('create_user');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('role_based');
  const [sandboxDealershipId, setSandboxDealershipId] = useState<string>('all');
  const [sprocketTourPreviewNonce, setSprocketTourPreviewNonce] = useState(0);
  const [singleUserScores, setSingleUserScores] = useState<LiveCxScores>(() => (
    user ? buildLiveCxScoresFromUser(user) : buildDefaultLiveCxScores()
  ));
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExportingUsers, setIsExportingUsers] = useState(false);
  const [consultantLookupId, setConsultantLookupId] = useState('lee');
  const [consultantOptions, setConsultantOptions] = useState<Array<{ code: string; name: string }>>([]);
  const [consultantLeaderboard, setConsultantLeaderboard] = useState<AkLeaderboardRow[]>([]);
  const [consultantMonthlyGross, setConsultantMonthlyGross] = useState(0);
  const [consultantYearlyGross, setConsultantYearlyGross] = useState(0);
  const [consultantMonthlyPayout, setConsultantMonthlyPayout] = useState(0);
  const [consultantMetricsLoading, setConsultantMetricsLoading] = useState(false);
  const [consultantMetricsError, setConsultantMetricsError] = useState<string | null>(null);
  const [consultantMetricsLastRefreshedAt, setConsultantMetricsLastRefreshedAt] = useState<Date | null>(null);
  const [consultantCommissionDueById, setConsultantCommissionDueById] = useState<Record<string, number>>({});
  const [giftTargetUserId, setGiftTargetUserId] = useState<string>('');
  const [isGiftingToolbox, setIsGiftingToolbox] = useState(false);
  const [isRevertingToolbox, setIsRevertingToolbox] = useState(false);
  const [giftAutoDriveCxTargetUserId, setGiftAutoDriveCxTargetUserId] = useState<string>('');
  const [isGiftingAutoDriveCx, setIsGiftingAutoDriveCx] = useState(false);
  const [isRevertingAutoDriveCx, setIsRevertingAutoDriveCx] = useState(false);
  const [siteTrafficTargetUserId, setSiteTrafficTargetUserId] = useState<string>('');
  const [isGrantingSiteTraffic, setIsGrantingSiteTraffic] = useState(false);
  const [isRevokingSiteTraffic, setIsRevokingSiteTraffic] = useState(false);
  const [toolboxDealershipId, setToolboxDealershipId] = useState<string>('');
  const [toolboxDealershipAccessEnabled, setToolboxDealershipAccessEnabled] = useState(true);
  const [isSavingToolboxDealershipAccess, setIsSavingToolboxDealershipAccess] = useState(false);
  const [signalMapperUnlocks, setSignalMapperUnlocks] = useState<SignalMapperUnlockRow[]>([]);
  const [signalMapperUnlocksLoading, setSignalMapperUnlocksLoading] = useState(false);
  const [signalMapperUnlocksError, setSignalMapperUnlocksError] = useState<string | null>(null);
  const [freshUpSandboxConfig, setFreshUpSandboxConfig] = useState<FreshUpSandboxConfig>({
    enabled: false,
    roleType: 'random',
    roleLabelKey: 'random',
    interactionDisplayLabel: undefined,
    sourceType: 'random',
    difficulty: 'random',
    vehicleInterest: 'random',
    primaryConcern: 'random',
    startingMood: 'random',
    personalityType: 'random',
    communicationStyle: 'random',
    forceProfileIdOrName: '',
    forceArchetypeIdOrName: '',
    forceTempoIdOrName: '',
    startingUpMeter: 35,
    memoryDebugMode: false,
    scoringDebugMode: false,
    saveSessionToLiveAnalytics: false,
  });
  const [qaConfig, setQaConfig] = useState<FreshUpQASimulationConfig>({
    sessionsToRun: 20,
    sourceType: 'mixed',
    difficultyRange: 'mixed',
    vehicleInterestPool: ['SUV', 'truck', 'sedan', 'hybrid', 'EV', 'performance vehicle', 'family vehicle'],
    primaryConcernPool: ['price', 'trade value', 'monthly payment', 'reliability', 'technology confusion', 'fuel economy', 'safety', 'time efficiency'],
    personalityPool: ['analytical', 'friendly', 'skeptical', 'impatient', 'overwhelmed', 'excited', 'defensive'],
    communicationStylePool: ['talkative', 'reserved', 'direct', 'sarcastic', 'story-driven', 'cautious', 'rapid-fire questions'],
    moodPool: ['cautious', 'curious', 'stressed', 'excited', 'guarded', 'frustrated', 'optimistic'],
    tempoPool: CONVERSATION_TEMPO_PROFILES.map((profile) => profile.tempoId),
    archetypeCategoryPool: ['friendly', 'curious', 'funny', 'analytical', 'skeptical', 'budget_focused', 'high_stakes', 'family_complex', 'emotional', 'unusual'],
  });
  const [isRunningQAMatrix, setIsRunningQAMatrix] = useState(false);
  const [qaSummary, setQaSummary] = useState<FreshUpQASummary | null>(null);
  const [qaComparison, setQaComparison] = useState<FreshUpQAVersionComparisonResult | null>(null);
  const [selectedQASessionId, setSelectedQASessionId] = useState<string | null>(null);
  const [freshUpVersions, setFreshUpVersions] = useState<FreshUpReleaseVersion[]>([]);
  const [releaseChecks, setReleaseChecks] = useState<FreshUpReleaseSafetyCheck[]>([]);
  const [productionVersionId, setProductionVersionId] = useState<string>('');
  const [sandboxVersionId, setSandboxVersionId] = useState<string>('');
  const [qaCompareEnabled, setQaCompareEnabled] = useState(false);
  const [qaCompareLeftVersionId, setQaCompareLeftVersionId] = useState<string>('');
  const [qaCompareRightVersionId, setQaCompareRightVersionId] = useState<string>('');
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [freshUpTestingControlsOpen, setFreshUpTestingControlsOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [scoreInterpretationTest, setScoreInterpretationTest] = useState<{
    roleType: FreshUpSandboxConfig['roleType'];
    metricName: AisMetricName;
    metricValue: number;
    concernCategory: string;
    archetypeContext: string;
  }>({
    roleType: 'sales',
    metricName: 'trust',
    metricValue: 68,
    concernCategory: 'price',
    archetypeContext: 'skeptical',
  });
  const sandboxDealershipStorageKey = useMemo(
    () => `managerDashboard:selectedDealershipId:${originalUser?.userId || user?.userId || 'sandbox'}`,
    [originalUser?.userId, user?.userId]
  );
  const giftableUsers = useMemo(
    () => [...manageableUsers].sort((a, b) => a.name.localeCompare(b.name)),
    [manageableUsers]
  );
  const selectedToolboxDealership = useMemo(
    () => allDealerships.find((dealership) => dealership.id === toolboxDealershipId) || null,
    [allDealerships, toolboxDealershipId]
  );
  const strategicDeckHref = '/Presentations/autoknerd-strategic-deck';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const persisted = localStorage.getItem(sandboxDealershipStorageKey);
    if (persisted && persisted.trim().length > 0) {
      setSandboxDealershipId(persisted);
    }
  }, [sandboxDealershipStorageKey]);

  const handleSandboxDealershipChange = useCallback((value: string) => {
    setSandboxDealershipId(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(sandboxDealershipStorageKey, value);
    }
  }, [sandboxDealershipStorageKey]);

  const loadFreshUpReleaseConfig = useCallback(async () => {
    setReleaseLoading(true);
    try {
      const [versions, state] = await Promise.all([
        getFreshUpReleaseVersions(),
        getFreshUpReleaseState(),
      ]);
      setFreshUpVersions(versions);
      setProductionVersionId(state.productionVersionId || versions[0]?.versionId || '');
      const defaultSandbox = state.sandboxDefaultVersionId || versions[0]?.versionId || '';
      setSandboxVersionId(defaultSandbox);
      if (!qaCompareLeftVersionId) {
        setQaCompareLeftVersionId(state.productionVersionId || versions[0]?.versionId || '');
      }
      if (!qaCompareRightVersionId) {
        setQaCompareRightVersionId(defaultSandbox);
      }
    } finally {
      setReleaseLoading(false);
    }
  }, [qaCompareLeftVersionId, qaCompareRightVersionId]);

  useEffect(() => {
    if (!loading && originalUser && (originalUser.role === 'Developer' || originalUser.role === 'Admin')) {
      void loadFreshUpReleaseConfig();
    }
  }, [loading, originalUser, loadFreshUpReleaseConfig]);

  const handleLaunchFreshUpSandbox = useCallback(() => {
    if (!freshUpSandboxConfig.enabled) {
      router.push(`/lesson/${FRESH_UP_LESSON_ID}?freshUp=true`);
      return;
    }
    const params = new URLSearchParams();
    params.set('freshUp', 'true');
    params.set('sandboxFreshUp', 'true');
    params.set('sandboxRoleType', freshUpSandboxConfig.roleType);
    if (freshUpSandboxConfig.roleLabelKey && freshUpSandboxConfig.roleLabelKey !== 'random') {
      params.set('sandboxRoleLabelKey', freshUpSandboxConfig.roleLabelKey);
      params.set('sandboxInteractionLabel', getRoleLabels(freshUpSandboxConfig.roleLabelKey).interactionLabel);
    } else if (freshUpSandboxConfig.roleType !== 'random') {
      params.set('sandboxRoleLabelKey', resolveRoleLabelKeyFromAisRoleType(freshUpSandboxConfig.roleType));
      params.set('sandboxInteractionLabel', getAisInteractionLabel(freshUpSandboxConfig.roleType));
    }
    params.set('sandboxSourceType', freshUpSandboxConfig.sourceType);
    params.set('sandboxDifficulty', freshUpSandboxConfig.difficulty);
    params.set('sandboxVehicleInterest', freshUpSandboxConfig.vehicleInterest);
    params.set('sandboxPrimaryConcern', freshUpSandboxConfig.primaryConcern);
    params.set('sandboxStartingMood', freshUpSandboxConfig.startingMood);
    params.set('sandboxPersonalityType', freshUpSandboxConfig.personalityType);
    params.set('sandboxCommunicationStyle', freshUpSandboxConfig.communicationStyle);
    params.set('sandboxStartingUpMeter', String(Math.max(0, Math.min(100, Math.round(Number(freshUpSandboxConfig.startingUpMeter || 35))))));
    params.set('sandboxMemoryDebug', freshUpSandboxConfig.memoryDebugMode ? 'true' : 'false');
    params.set('sandboxScoringDebug', freshUpSandboxConfig.scoringDebugMode ? 'true' : 'false');
    params.set('sandboxSaveLive', freshUpSandboxConfig.saveSessionToLiveAnalytics ? 'true' : 'false');
    if (sandboxVersionId) {
      params.set('sandboxVersionId', sandboxVersionId);
    }
    if (freshUpSandboxConfig.forceProfileIdOrName && freshUpSandboxConfig.forceProfileIdOrName.trim().length > 0) {
      params.set('sandboxForceProfile', freshUpSandboxConfig.forceProfileIdOrName.trim());
    }
    if (freshUpSandboxConfig.forceArchetypeIdOrName && freshUpSandboxConfig.forceArchetypeIdOrName.trim().length > 0) {
      params.set('sandboxForceArchetype', freshUpSandboxConfig.forceArchetypeIdOrName.trim());
    }
    if (freshUpSandboxConfig.forceTempoIdOrName && freshUpSandboxConfig.forceTempoIdOrName.trim().length > 0) {
      params.set('sandboxForceTempo', freshUpSandboxConfig.forceTempoIdOrName.trim());
    }
    router.push(`/lesson/${FRESH_UP_LESSON_ID}?${params.toString()}`);
  }, [freshUpSandboxConfig, router, sandboxVersionId]);

  const scoreInterpretationPreview = useMemo(() => {
    if (scoreInterpretationTest.roleType === 'random') return null;
    return interpretAisScore({
      roleType: scoreInterpretationTest.roleType,
      metricName: scoreInterpretationTest.metricName,
      metricValue: scoreInterpretationTest.metricValue,
      concernCategory: scoreInterpretationTest.concernCategory || undefined,
      archetypeContext: scoreInterpretationTest.archetypeContext || undefined,
      interactionContext: getAisInteractionLabel(scoreInterpretationTest.roleType),
    });
  }, [scoreInterpretationTest]);

  const handleRunFreshUpQAMatrix = useCallback(async () => {
    setIsRunningQAMatrix(true);
    try {
      const selectedVersionForRun = freshUpVersions.find((version) => version.versionId === sandboxVersionId);
      const resolvedConfig: FreshUpQASimulationConfig = {
        ...qaConfig,
        freshUpVersionId: selectedVersionForRun?.versionId || undefined,
        freshUpVersionName: selectedVersionForRun?.versionName || undefined,
        featureToggles: selectedVersionForRun?.toggles,
      };
      const summary = runFreshUpQAMatrix(resolvedConfig);
      const qaDealerId = sandboxDealershipId !== 'all'
        ? sandboxDealershipId
        : (user?.selfDeclaredDealershipId || user?.dealershipIds?.[0] || undefined);
      await storeFreshUpQATestRun({
        runId: summary.runId,
        dealerId: qaDealerId,
        sessions: summary.sessions,
      });
      setQaSummary(summary);
      setQaComparison(null);
      setSelectedQASessionId(summary.flaggedSessions[0]?.simulationID ?? null);
      if (qaCompareEnabled && qaCompareLeftVersionId && qaCompareRightVersionId) {
        const leftVersion = freshUpVersions.find((version) => version.versionId === qaCompareLeftVersionId);
        const rightVersion = freshUpVersions.find((version) => version.versionId === qaCompareRightVersionId);
        if (leftVersion && rightVersion) {
          const comparison = runFreshUpQAVersionComparison({
            baseConfig: qaConfig,
            leftVersion: {
              versionId: leftVersion.versionId,
              versionName: leftVersion.versionName,
              toggles: leftVersion.toggles,
            },
            rightVersion: {
              versionId: rightVersion.versionId,
              versionName: rightVersion.versionName,
              toggles: rightVersion.toggles,
            },
          });
          setQaComparison(comparison);
          await Promise.all([
            storeFreshUpQATestRun({
              runId: comparison.left.runId,
              dealerId: qaDealerId,
              sessions: comparison.left.sessions,
            }),
            storeFreshUpQATestRun({
              runId: comparison.right.runId,
              dealerId: qaDealerId,
              sessions: comparison.right.sessions,
            }),
          ]);
        }
      }
      toast({
        title: 'Fresh Up QA Matrix Complete',
        description: qaCompareEnabled
          ? `Ran ${summary.totalSessionsRun} simulations plus version comparison runs and stored results in freshUpQATests.`
          : `Ran ${summary.totalSessionsRun} simulations and stored results in freshUpQATests.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'QA Simulation Failed',
        description: error?.message || 'Unable to complete Fresh Up QA simulation.',
      });
    } finally {
      setIsRunningQAMatrix(false);
    }
  }, [qaConfig, sandboxDealershipId, user?.selfDeclaredDealershipId, user?.dealershipIds, toast, sandboxVersionId, freshUpVersions, qaCompareEnabled, qaCompareLeftVersionId, qaCompareRightVersionId]);

  const handleSetSandboxVersion = useCallback(async (versionId: string) => {
    if (!user) return;
    setSandboxVersionId(versionId);
    setReleaseBusy(true);
    try {
      await setFreshUpSandboxDefaultVersion({
        versionId,
        updatedBy: user.userId,
      });
      toast({
        title: 'Sandbox Version Updated',
        description: 'Fresh Up sandbox default version has been updated.',
      });
      await loadFreshUpReleaseConfig();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Sandbox version update failed',
        description: error?.message || 'Unable to update sandbox default version.',
      });
    } finally {
      setReleaseBusy(false);
    }
  }, [loadFreshUpReleaseConfig, toast, user]);

  const handlePromoteVersion = useCallback(async (versionId: string) => {
    if (!user) return;
    setReleaseBusy(true);
    try {
      const result = await setFreshUpProductionVersion({
        versionId,
        updatedBy: user.userId,
        enforceSafety: true,
      });
      setReleaseChecks(result.checks);
      if (!result.promoted) {
        toast({
          variant: 'destructive',
          title: 'Promotion blocked by safety checks',
          description: 'Resolve failed checks before promoting this version to production.',
        });
        return;
      }
      toast({
        title: 'Production Version Updated',
        description: 'Fresh Up production version has been promoted successfully.',
      });
      await loadFreshUpReleaseConfig();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Promotion failed',
        description: error?.message || 'Unable to promote selected version.',
      });
    } finally {
      setReleaseBusy(false);
    }
  }, [loadFreshUpReleaseConfig, toast, user]);

  const handlePreviewSafetyChecks = useCallback(async (versionId: string) => {
    setReleaseBusy(true);
    try {
      const version = freshUpVersions.find((entry) => entry.versionId === versionId);
      if (!version) return;
      const checks = await evaluateFreshUpPromotionSafety(version);
      setReleaseChecks(checks);
    } finally {
      setReleaseBusy(false);
    }
  }, [freshUpVersions]);

  const handleRollbackProduction = useCallback(async () => {
    if (!user) return;
    setReleaseBusy(true);
    try {
      await rollbackFreshUpProductionVersion(user.userId);
      toast({
        title: 'Production Rollback Complete',
        description: 'Fresh Up reverted to the previous stable version.',
      });
      await loadFreshUpReleaseConfig();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Rollback failed',
        description: error?.message || 'Unable to roll back production version.',
      });
    } finally {
      setReleaseBusy(false);
    }
  }, [loadFreshUpReleaseConfig, toast, user]);

  const refreshData = useCallback(async () => {
    if (!originalUser) return;
    setDataLoading(true);
    const [users, dealerships] = await Promise.all([
      getManageableUsers(originalUser.userId),
      getDealerships(),
    ]);
    setManageableUsers(users);
    setAllDealerships(dealerships);
    setLastRefreshedAt(new Date());
    setDataLoading(false);
  }, [originalUser]);

  useEffect(() => {
    if (!loading && originalUser) {
      void refreshData();
    }
  }, [loading, originalUser, refreshData]);

  useEffect(() => {
    if (!allDealerships.length) {
      setToolboxDealershipId('');
      return;
    }
    setToolboxDealershipId((current) => (
      current && allDealerships.some((dealership) => dealership.id === current)
        ? current
        : allDealerships[0].id
    ));
  }, [allDealerships]);

  useEffect(() => {
    if (!selectedToolboxDealership) {
      setToolboxDealershipAccessEnabled(true);
      return;
    }
    setToolboxDealershipAccessEnabled(selectedToolboxDealership.enableToolboxAccess !== false);
  }, [selectedToolboxDealership]);

  useEffect(() => {
    if (!originalUser) return;
    const timer = setInterval(() => {
      void refreshData();
    }, 60_000);
    return () => clearInterval(timer);
  }, [originalUser, refreshData]);

  useEffect(() => {
    let cancelled = false;

    async function loadConsultants() {
      try {
        const response = await fetch('/api/admin/consultants');
        if (!response.ok) return;
        const payload = await response.json() as { consultants?: ConsultantPickerOption[] };
        const options = (payload.consultants || [])
          .map((row) => {
            const code = String(row.referral_code || row.referralCode || '').trim().toLowerCase();
            const name = String(row.name || '').trim();
            return { code, name };
          })
          .filter((row) => row.code.length > 0);
        if (cancelled) return;
        setConsultantOptions(options);

        if (options.length > 0) {
          const normalizedCurrent = consultantLookupId.trim().toLowerCase();
          const hasCurrent = options.some((row) => row.code === normalizedCurrent);
          if (!hasCurrent) {
            setConsultantLookupId(options[0].code);
          }
        }
      } catch {
        // Best-effort picker population.
      }
    }

    if (!loading && originalUser) {
      void loadConsultants();
    }

    return () => {
      cancelled = true;
    };
  }, [loading, originalUser]);

  const loadConsultantMetrics = useCallback(async () => {
    if (!originalUser || (originalUser.role !== 'Admin' && originalUser.role !== 'Developer')) {
      return;
    }

    setConsultantMetricsLoading(true);
    setConsultantMetricsError(null);

    try {
      const leaderboardResponse = await fetch('/api/leaderboard');
      const leaderboardPayload = await leaderboardResponse.json();
      if (!leaderboardResponse.ok) {
        throw new Error(leaderboardPayload?.error || 'Failed to load consultant leaderboard.');
      }

      const leaderboardRows = (leaderboardPayload as AkLeaderboardRow[]) || [];
      const monthlyGross = leaderboardRows.reduce((sum, row) => sum + Number(row.monthly_revenue || 0), 0);

      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required for payout metrics.');
      }
      const token = await fbUser.getIdToken(true);
      const payoutsResponse = await fetch('/api/admin/payouts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payoutsPayload = await payoutsResponse.json() as AkPayoutResponse & { message?: string };
      if (!payoutsResponse.ok) {
        throw new Error(payoutsPayload?.message || 'Failed to load payout metrics.');
      }

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const records = payoutsPayload.records || [];

      const yearlyGross = records.reduce((sum, row) => {
        if (row.status === 'voided') return sum;
        const iso = row.period_start || row.created_at;
        const date = new Date(iso);
        if (Number.isNaN(date.getTime()) || date.getFullYear() !== currentYear) return sum;
        return sum + Number(row.amount || 0);
      }, 0);

      const monthlyPayout = records.reduce((sum, row) => {
        if (row.status === 'voided') return sum;
        const iso = row.period_start || row.created_at;
        const date = new Date(iso);
        if (
          Number.isNaN(date.getTime())
          || date.getFullYear() !== currentYear
          || date.getMonth() !== currentMonth
        ) return sum;
        return sum + Number(row.commission_amount || 0);
      }, 0);

      const commissionDueByConsultant = records.reduce((acc, row) => {
        if (row.status !== 'pending' && row.status !== 'approved') {
          return acc;
        }
        const consultantId = String(row.consultant_id || '').trim().toLowerCase();
        if (!consultantId) {
          return acc;
        }
        acc[consultantId] = (acc[consultantId] || 0) + Number(row.commission_amount || 0);
        return acc;
      }, {} as Record<string, number>);

      setConsultantLeaderboard(leaderboardRows);
      setConsultantMonthlyGross(Math.round(monthlyGross * 100) / 100);
      setConsultantYearlyGross(Math.round(yearlyGross * 100) / 100);
      setConsultantMonthlyPayout(Math.round(monthlyPayout * 100) / 100);
      setConsultantCommissionDueById(
        Object.fromEntries(
          Object.entries(commissionDueByConsultant).map(([key, value]) => [key, Math.round(value * 100) / 100])
        )
      );
      setConsultantMetricsLastRefreshedAt(new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load consultant metrics.';
      setConsultantMetricsError(message);
    } finally {
      setConsultantMetricsLoading(false);
    }
  }, [originalUser, firebaseAuth]);

  const loadSignalMapperUnlocks = useCallback(async () => {
    if (!originalUser || (originalUser.role !== 'Admin' && originalUser.role !== 'Developer')) {
      return;
    }

    setSignalMapperUnlocksLoading(true);
    setSignalMapperUnlocksError(null);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required for unlock email metrics.');
      }
      const token = await fbUser.getIdToken(true);
      const response = await fetch('/api/admin/signal-mapper-unlocks', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || payload?.error || 'Failed to load unlock emails.');
      }

      const rows = Array.isArray(payload?.records) ? payload.records : [];
      setSignalMapperUnlocks(rows as SignalMapperUnlockRow[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load unlock emails.';
      setSignalMapperUnlocksError(message);
    } finally {
      setSignalMapperUnlocksLoading(false);
    }
  }, [firebaseAuth, originalUser]);

  const giftToolboxAccess = useCallback(async () => {
    if (!giftTargetUserId) {
      toast({
        variant: 'destructive',
        title: 'Select a user first',
        description: 'Choose a user to gift full AutoShop access.',
      });
      return;
    }

    try {
      setIsGiftingToolbox(true);
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required to gift AutoShop access.');
      }
      const token = await fbUser.getIdToken(true);

      const response = await fetch('/api/admin/toolbox-gift', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: giftTargetUserId }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to gift AutoShop access.');
      }

      toast({
        title: 'AutoShop gifted',
        description: `${payload?.user?.name || 'User'} now has paid AutoShop + Sprocket + AutoDriveCX.`,
      });
      await refreshData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gift failed',
        description: error instanceof Error ? error.message : 'Failed to gift AutoShop access.',
      });
    } finally {
      setIsGiftingToolbox(false);
    }
  }, [firebaseAuth, giftTargetUserId, refreshData, toast]);

  const revertToolboxAccess = useCallback(async () => {
    if (!giftTargetUserId) {
      toast({
        variant: 'destructive',
        title: 'Select a user first',
        description: 'Choose a user to revert gifted AutoShop access.',
      });
      return;
    }

    try {
      setIsRevertingToolbox(true);
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required to revert AutoShop access.');
      }
      const token = await fbUser.getIdToken(true);

      const response = await fetch('/api/admin/toolbox-gift', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'revert', targetUserId: giftTargetUserId }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to revert AutoShop gift access.');
      }

      toast({
        title: 'Gift reverted',
        description: `${payload?.user?.name || 'User'} restored to pre-gift AutoShop access.`,
      });
      await refreshData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Revert failed',
        description: error instanceof Error ? error.message : 'Failed to revert AutoShop gift access.',
      });
    } finally {
      setIsRevertingToolbox(false);
    }
  }, [firebaseAuth, giftTargetUserId, refreshData, toast]);

  const giftAutoDriveCxAccess = useCallback(async () => {
    if (!giftAutoDriveCxTargetUserId) {
      toast({
        variant: 'destructive',
        title: 'Select a user first',
        description: 'Choose a user to gift AutoDriveCX access.',
      });
      return;
    }

    try {
      setIsGiftingAutoDriveCx(true);
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required to gift AutoDriveCX access.');
      }
      const token = await fbUser.getIdToken(true);

      const response = await fetch('/api/admin/toolbox-gift', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scope: 'autodrivecx', targetUserId: giftAutoDriveCxTargetUserId }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to gift AutoDriveCX access.');
      }

      toast({
        title: 'AutoDriveCX gifted',
        description: `${payload?.user?.name || 'User'} now has AutoDriveCX access.`,
      });
      await refreshData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Gift failed',
        description: error instanceof Error ? error.message : 'Failed to gift AutoDriveCX access.',
      });
    } finally {
      setIsGiftingAutoDriveCx(false);
    }
  }, [firebaseAuth, giftAutoDriveCxTargetUserId, refreshData, toast]);

  const revertAutoDriveCxAccess = useCallback(async () => {
    if (!giftAutoDriveCxTargetUserId) {
      toast({
        variant: 'destructive',
        title: 'Select a user first',
        description: 'Choose a user to revert gifted AutoDriveCX access.',
      });
      return;
    }

    try {
      setIsRevertingAutoDriveCx(true);
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required to revert AutoDriveCX access.');
      }
      const token = await fbUser.getIdToken(true);

      const response = await fetch('/api/admin/toolbox-gift', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scope: 'autodrivecx', action: 'revert', targetUserId: giftAutoDriveCxTargetUserId }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to revert AutoDriveCX gift access.');
      }

      toast({
        title: 'AutoDriveCX gift reverted',
        description: `${payload?.user?.name || 'User'} restored to pre-gift AutoDriveCX access.`,
      });
      await refreshData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Revert failed',
        description: error instanceof Error ? error.message : 'Failed to revert AutoDriveCX gift access.',
      });
    } finally {
      setIsRevertingAutoDriveCx(false);
    }
  }, [firebaseAuth, giftAutoDriveCxTargetUserId, refreshData, toast]);

  const grantSiteTrafficAccess = useCallback(async () => {
    if (!siteTrafficTargetUserId) {
      toast({
        variant: 'destructive',
        title: 'Select a user first',
        description: 'Choose a user to grant Site Traffic access.',
      });
      return;
    }

    try {
      setIsGrantingSiteTraffic(true);
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required to grant Site Traffic access.');
      }
      const token = await fbUser.getIdToken(true);

      const response = await fetch('/api/admin/site-traffic-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: siteTrafficTargetUserId }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to grant Site Traffic access.');
      }

      toast({
        title: 'Site Traffic access granted',
        description: `${payload?.user?.name || 'User'} can now open Site Traffic from the avatar menu.`,
      });
      await refreshData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Grant failed',
        description: error instanceof Error ? error.message : 'Failed to grant Site Traffic access.',
      });
    } finally {
      setIsGrantingSiteTraffic(false);
    }
  }, [firebaseAuth, refreshData, siteTrafficTargetUserId, toast]);

  const revokeSiteTrafficAccess = useCallback(async () => {
    if (!siteTrafficTargetUserId) {
      toast({
        variant: 'destructive',
        title: 'Select a user first',
        description: 'Choose a user to revoke Site Traffic access.',
      });
      return;
    }

    try {
      setIsRevokingSiteTraffic(true);
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required to revoke Site Traffic access.');
      }
      const token = await fbUser.getIdToken(true);

      const response = await fetch('/api/admin/site-traffic-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'revoke', targetUserId: siteTrafficTargetUserId }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Failed to revoke Site Traffic access.');
      }

      toast({
        title: 'Site Traffic access revoked',
        description: `${payload?.user?.name || 'User'} no longer has Site Traffic access.`,
      });
      await refreshData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Revoke failed',
        description: error instanceof Error ? error.message : 'Failed to revoke Site Traffic access.',
      });
    } finally {
      setIsRevokingSiteTraffic(false);
    }
  }, [firebaseAuth, refreshData, siteTrafficTargetUserId, toast]);

  const saveDealershipToolboxAccess = useCallback(async () => {
    if (!toolboxDealershipId) {
      toast({
        variant: 'destructive',
        title: 'Select a dealership first',
        description: 'Choose a dealership to update AutoShop access.',
      });
      return;
    }

    try {
      setIsSavingToolboxDealershipAccess(true);
      await updateDealershipToolboxAccess(toolboxDealershipId, toolboxDealershipAccessEnabled);
      toast({
        title: 'Dealership AutoShop Updated',
        description: `${selectedToolboxDealership?.name || 'Dealership'} ${toolboxDealershipAccessEnabled ? 'now has' : 'no longer has'} AutoShop access.`,
      });
      await refreshData();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Failed to update dealership AutoShop access.',
      });
    } finally {
      setIsSavingToolboxDealershipAccess(false);
    }
  }, [refreshData, selectedToolboxDealership?.name, toast, toolboxDealershipAccessEnabled, toolboxDealershipId]);

  useEffect(() => {
    if (activeSection === 'revenue_growth') {
      void loadConsultantMetrics();
    }
  }, [activeSection, loadConsultantMetrics]);

  useEffect(() => {
    if (activeSection === 'revenue_growth') {
      void loadSignalMapperUnlocks();
    }
  }, [activeSection, loadSignalMapperUnlocks]);

  useEffect(() => {
    if (!loading && (!user || (originalUser?.role !== 'Developer' && originalUser?.role !== 'Admin'))) {
      router.push('/login');
      return;
    }

    if (!loading && originalUser && !originalUserIsAssigned) {
      router.push('/');
    }
  }, [user, loading, router, originalUser, originalUserIsAssigned]);

  useEffect(() => {
    if (!originalUser) return;
    if (dashboardMode !== 'single_user') return;
    setSingleUserScores(buildLiveCxScoresFromUser(originalUser));
  }, [dashboardMode, originalUser]);

  useEffect(() => {
    const tool = TOOLS.find((entry) => entry.id === activeTool);
    if (!tool || tool.section === activeSection) return;
    const fallback = TOOLS.find((entry) => entry.section === activeSection);
    if (fallback) setActiveTool(fallback.id);
  }, [activeSection, activeTool]);

  const handleSwitchRole = (newRole: UserRole) => {
    if (originalUser) setUser({ ...originalUser, role: newRole });
  };

  const updateSingleUserScore = useCallback((trait: LiveCxTrait, value: number) => {
    const clamped = clampScore(value);
    setSingleUserScores((previous) => ({ ...previous, [trait]: clamped }));
  }, []);

  const setAllSingleUserScores = useCallback((value: number) => {
    const clamped = clampScore(value);
    setSingleUserScores({
      empathy: clamped,
      listening: clamped,
      trust: clamped,
      followUp: clamped,
      closing: clamped,
      relationship: clamped,
    });
  }, []);

  const applyBenchmarkPreset = useCallback(() => {
    setSingleUserScores(BENCHMARK_PRESET);
  }, []);

  const resetSingleUserScores = useCallback(() => {
    if (!originalUser) return;
    setSingleUserScores(buildLiveCxScoresFromUser(originalUser));
  }, [originalUser]);

  const dashboardUser: User = useMemo(() => {
    if (!user) {
      return {
        userId: '',
        name: '',
        email: '',
        role: 'Sales Consultant',
        dealershipIds: [],
        avatarUrl: '',
        xp: 0,
      };
    }
    if (dashboardMode === 'single_user') {
      return {
        ...user,
        role: 'Sales Consultant',
        dealershipIds: [],
        selfDeclaredDealershipId: undefined,
        stats: buildUserStatsFromLiveScores(singleUserScores),
      };
    }

    if (sandboxDealershipId && sandboxDealershipId !== 'all') {
      const sourceIds = Array.from(new Set([
        ...(user.dealershipIds || []),
        ...(user.selfDeclaredDealershipId ? [user.selfDeclaredDealershipId] : []),
      ]));
      const isPrivilegedViewer = originalUser?.role === 'Admin' || originalUser?.role === 'Developer';
      const canScopeToSelected = isPrivilegedViewer || sourceIds.includes(sandboxDealershipId);

      if (canScopeToSelected) {
        return {
          ...user,
          dealershipIds: [sandboxDealershipId],
          selfDeclaredDealershipId: sandboxDealershipId,
        };
      }
    }

    return user;
  }, [dashboardMode, singleUserScores, user, sandboxDealershipId, originalUser?.role]);

  const isViewingAsManager = managerialRoles.includes(dashboardUser.role);
  const canSeeDeveloperCxTuner = originalUser?.role === 'Developer';
  const showDeveloperCxTuner = canSeeDeveloperCxTuner && dashboardMode === 'single_user';
  const selectedQASession: FreshUpQASessionResult | null = useMemo(() => {
    if (!qaSummary) return null;
    if (selectedQASessionId) {
      return qaSummary.sessions.find((session) => session.simulationID === selectedQASessionId) ?? null;
    }
    return qaSummary.sessions[0] ?? null;
  }, [qaSummary, selectedQASessionId]);
  const freshUpVersionById = useMemo(() => (
    new Map(freshUpVersions.map((version) => [version.versionId, version]))
  ), [freshUpVersions]);
  const activeProductionVersion = productionVersionId ? (freshUpVersionById.get(productionVersionId) ?? null) : null;
  const selectedSandboxVersion = sandboxVersionId ? (freshUpVersionById.get(sandboxVersionId) ?? null) : null;
  const qaMatrixEnabledForSelectedVersion = selectedSandboxVersion?.toggles.enableQAMatrix !== false;

  const dealershipNameById = useMemo(() => (
    new Map(allDealerships.map((dealership) => [dealership.id, dealership.name]))
  ), [allDealerships]);

  const newestUsers = useMemo(() => {
    const safeDate = (value?: string) => {
      if (!value) return 0;
      const parsed = new Date(value).getTime();
      return Number.isNaN(parsed) ? 0 : parsed;
    };

    return [...manageableUsers]
      .sort((a, b) => safeDate(b.memberSince) - safeDate(a.memberSince))
      .slice(0, 100);
  }, [manageableUsers]);

  const filteredNewestUsers = useMemo(() => {
    const startTs = exportStartDate ? new Date(`${exportStartDate}T00:00:00`).getTime() : null;
    const endTs = exportEndDate ? new Date(`${exportEndDate}T23:59:59.999`).getTime() : null;

    return newestUsers.filter((candidate) => {
      if (!candidate.memberSince) return !startTs && !endTs;
      const joinedTs = new Date(candidate.memberSince).getTime();
      if (Number.isNaN(joinedTs)) return !startTs && !endTs;
      if (startTs !== null && joinedTs < startTs) return false;
      if (endTs !== null && joinedTs > endTs) return false;
      return true;
    });
  }, [newestUsers, exportStartDate, exportEndDate]);

  const pausedDealershipCount = useMemo(() => (
    allDealerships.filter((dealership) => dealership.status === 'paused').length
  ), [allDealerships]);
  const tempProSignupUrl = useMemo(() => {
    if (typeof window === 'undefined') return '/signup';
    return new URL('/signup', window.location.origin).toString();
  }, []);

  const getAffiliationLabel = useCallback((candidate: User) => {
    const ids = Array.isArray(candidate.dealershipIds) ? candidate.dealershipIds : [];
    const names = ids
      .map((id) => dealershipNameById.get(id))
      .filter((name): name is string => typeof name === 'string' && name.length > 0);

    if (names.length > 0) return names.join(', ');
    if (candidate.selfDeclaredDealershipId) {
      return dealershipNameById.get(candidate.selfDeclaredDealershipId) || candidate.selfDeclaredDealershipId;
    }
    return 'No dealership assigned';
  }, [dealershipNameById]);

  const getWatchlistRoleLabel = useCallback((candidate: User) => {
    const role = candidate.signupRoleInterest || candidate.role;
    if (!role) return '';
    if (role === 'manager') return 'Sales Manager';
    if (role === 'Service Writer') return 'Service Advisor';
    if (role === 'BDC') return 'BDC Professional';
    if (role === 'Finance Manager') return 'F&I Director';
    return role;
  }, []);

  const handleExportNewUsers = useCallback(async () => {
    try {
      setIsExportingUsers(true);

      const rows = filteredNewestUsers.map((candidate) => ({
        Joined: candidate.memberSince ? new Date(candidate.memberSince).toLocaleDateString() : '',
        Name: candidate.name || 'New User',
        Email: candidate.email || '',
        Role: getWatchlistRoleLabel(candidate),
        DealerAffiliation: getAffiliationLabel(candidate),
      }));

      if (rows.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No users to export',
          description: 'Adjust the date range to include at least one user.',
        });
        return;
      }

      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'New Users');

      const rangeSuffix = exportStartDate || exportEndDate
        ? `_${exportStartDate || 'start'}_to_${exportEndDate || 'end'}`
        : '';
      XLSX.writeFile(workbook, `new-users-watchlist${rangeSuffix}.xlsx`);
    } catch (error) {
      console.error('Failed to export new users watchlist:', error);
      toast({
        variant: 'destructive',
        title: 'Export failed',
        description: 'Could not generate the Excel file.',
      });
    } finally {
      setIsExportingUsers(false);
    }
  }, [filteredNewestUsers, getWatchlistRoleLabel, getAffiliationLabel, exportStartDate, exportEndDate, toast]);

  const handleCopyTempProSignupLink = useCallback(async () => {
    try {
      if (typeof window === 'undefined') return;
      await navigator.clipboard.writeText(tempProSignupUrl);
      toast({
        title: 'Link copied',
        description: 'Signup test URL copied to clipboard.',
      });
    } catch (error) {
      console.error('Failed to copy signup test URL:', error);
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Could not copy the link. You can copy it from the field below.',
      });
    }
  }, [tempProSignupUrl, toast]);

  const handleCopyGuidedDemoLink = useCallback(async (url: string) => {
    try {
      if (typeof window === 'undefined') return;
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link copied',
        description: 'Guided demo URL copied to clipboard.',
      });
    } catch (error) {
      console.error('Failed to copy guided demo URL:', error);
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Could not copy the guided demo link.',
      });
    }
  }, [toast]);

  const handleCopyValue = useCallback(async (value: string, successDescription: string) => {
    try {
      if (typeof window === 'undefined') return;
      await navigator.clipboard.writeText(value);
      toast({
        title: 'Copied',
        description: successDescription,
      });
    } catch (error) {
      console.error('Failed to copy value:', error);
      toast({
        variant: 'destructive',
        title: 'Copy failed',
        description: 'Could not copy to clipboard.',
      });
    }
  }, [toast]);

  if (
    loading ||
    !user ||
    !originalUser ||
    !originalUserIsAssigned ||
    (originalUser.role !== 'Developer' && originalUser.role !== 'Admin')
  ) {
    return <div className="flex h-screen w-full items-center justify-center bg-background"><Spinner size="lg" /></div>;
  }

  const goToSection = (section: SectionId, toolId?: ToolId) => {
    setActiveSection(section);
    if (toolId) setActiveTool(toolId);
    setMobileNavOpen(false);
  };

  const renderWatchlistCard = () => (
    <Collapsible open={watchlistOpen} onOpenChange={setWatchlistOpen}>
      <Card className="mt-6">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>New Users Watchlist</CardTitle>
              <CardDescription>
                Live list of newest users for welcome email follow-up.
                {lastRefreshedAt ? ` Last refreshed ${lastRefreshedAt.toLocaleTimeString()}.` : ''}
              </CardDescription>
            </div>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                {watchlistOpen ? 'Collapse' : 'Expand'}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            {dataLoading ? (
              <Spinner />
            ) : filteredNewestUsers.length === 0 && newestUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users found.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="new-users-start-date">Start Date</Label>
                    <Input
                      id="new-users-start-date"
                      type="date"
                      value={exportStartDate}
                      onChange={(event) => setExportStartDate(event.target.value)}
                      className="w-[180px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-users-end-date">End Date</Label>
                    <Input
                      id="new-users-end-date"
                      type="date"
                      value={exportEndDate}
                      onChange={(event) => setExportEndDate(event.target.value)}
                      className="w-[180px]"
                    />
                  </div>
                  <Button variant="outline" onClick={() => { setExportStartDate(''); setExportEndDate(''); }}>
                    Clear Range
                  </Button>
                  <Button onClick={handleExportNewUsers} disabled={isExportingUsers || filteredNewestUsers.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    {isExportingUsers ? 'Exporting...' : 'Export Excel'}
                  </Button>
                </div>

                {filteredNewestUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No users found in this date range.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Joined</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Dealer Affiliation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredNewestUsers.map((candidate) => (
                        <TableRow key={candidate.userId}>
                          <TableCell>{candidate.memberSince ? new Date(candidate.memberSince).toLocaleDateString() : '-'}</TableCell>
                          <TableCell className="font-medium">{candidate.name || 'New User'}</TableCell>
                          <TableCell>{candidate.email}</TableCell>
                          <TableCell>{getWatchlistRoleLabel(candidate) || '-'}</TableCell>
                          <TableCell>{getAffiliationLabel(candidate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );

  const renderSandbox = () => (
    <Card>
      <CardHeader>
        <CardTitle>Impersonation Sandbox</CardTitle>
        <CardDescription>
          Use role-based impersonation or jump directly into a single-user dashboard with no dealership assignment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium">Mode:</span>
          <Select onValueChange={(mode) => setDashboardMode(mode as DashboardMode)} value={dashboardMode}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="role_based">Role-Based</SelectItem>
              <SelectItem value="single_user">Single User</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium">Dealership:</span>
          <Select onValueChange={handleSandboxDealershipChange} value={sandboxDealershipId}>
            <SelectTrigger className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              {allDealerships.map((dealership) => (
                <SelectItem key={dealership.id} value={dealership.id}>
                  {dealership.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="text-sm font-medium">Impersonating:</span>
          <Select onValueChange={(role) => handleSwitchRole(role as UserRole)} value={user.role}>
            <SelectTrigger className="w-[240px]" disabled={dashboardMode === 'single_user'}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allRoles.map((role) => (
                <SelectItem key={role} value={role}>{role === 'manager' ? 'Sales Manager' : role}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dashboardMode === 'single_user' && (
            <span className="text-xs text-muted-foreground">
              Single User mode uses `Sales Consultant` with no dealership.
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setSprocketTourPreviewNonce((prev) => prev + 1)}
            disabled={isViewingAsManager}
          >
            Launch Sprocket Tour Preview
          </Button>
          {isViewingAsManager ? (
            <span className="text-xs text-muted-foreground">Switch to a consultant role (or Single User mode) to preview this tour.</span>
          ) : (
            <span className="text-xs text-muted-foreground">Sandbox only. Opens the Sprocket First Login Tour without baseline submission.</span>
          )}
        </div>
        <Collapsible open={freshUpTestingControlsOpen} onOpenChange={setFreshUpTestingControlsOpen}>
          <Card className="mt-6 border-primary/40">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Fresh Up Testing Controls</CardTitle>
                  <CardDescription>
                    Controlled Fresh Up testing for admins and developers. Test sessions stay out of live analytics unless explicitly enabled.
                  </CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    {freshUpTestingControlsOpen ? 'Collapse' : 'Expand'}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-5">
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Fresh Up Release Version Selector</p>
                  <p className="text-xs text-muted-foreground">
                    Choose sandbox version, preview promotion safety checks, and promote or roll back without code changes.
                  </p>
                </div>
                {(releaseLoading || releaseBusy) && <Spinner size="sm" />}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Sandbox Version</Label>
                  <Select
                    value={sandboxVersionId || ''}
                    onValueChange={(value) => { void handleSetSandboxVersion(value); }}
                  >
                    <SelectTrigger><SelectValue placeholder="Select sandbox version" /></SelectTrigger>
                    <SelectContent>
                      {freshUpVersions.map((version) => (
                        <SelectItem key={version.versionId} value={version.versionId}>
                          {version.versionName} ({version.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Production Active Version</Label>
                  <div className="rounded border bg-muted/40 px-3 py-2 text-sm">
                    {activeProductionVersion ? `${activeProductionVersion.versionName} (${activeProductionVersion.status})` : 'Not set'}
                  </div>
                </div>
              </div>
              {sandboxVersionId && freshUpVersionById.get(sandboxVersionId) && (
                <div className="rounded border bg-muted/20 p-3">
                  <p className="text-xs font-medium">Selected Version Notes</p>
                  <p className="mt-1 text-xs text-muted-foreground">{freshUpVersionById.get(sandboxVersionId)?.notes || 'No notes provided.'}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Enabled Toggles: {Object.entries(freshUpVersionById.get(sandboxVersionId)?.toggles || {}).filter(([, enabled]) => enabled).map(([key]) => key).join(', ') || 'None'}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!sandboxVersionId || releaseBusy}
                  onClick={() => { if (sandboxVersionId) void handlePreviewSafetyChecks(sandboxVersionId); }}
                >
                  Run Promotion Safety Check
                </Button>
                <Button
                  type="button"
                  disabled={!sandboxVersionId || releaseBusy}
                  onClick={() => { if (sandboxVersionId) void handlePromoteVersion(sandboxVersionId); }}
                >
                  Promote Selected to Production
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={releaseBusy}
                  onClick={() => { void handleRollbackProduction(); }}
                >
                  Roll Back Production
                </Button>
              </div>
              {releaseChecks.length > 0 && (
                <div className="rounded border p-3 space-y-1">
                  <p className="text-xs font-medium">Promotion Safety Checks</p>
                  {releaseChecks.map((check) => (
                    <p key={check.key} className="text-xs text-muted-foreground">
                      {check.passed ? 'PASS' : 'FAIL'} · {check.label}{check.details ? ` — ${check.details}` : ''}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Enable Fresh Up Test Mode</p>
                <p className="text-xs text-muted-foreground">Bypasses normal Up Meter eligibility and launches Fresh Up with the selected test parameters.</p>
              </div>
              <Switch
                checked={freshUpSandboxConfig.enabled}
                onCheckedChange={(checked) => setFreshUpSandboxConfig((prev) => ({ ...prev, enabled: checked }))}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={freshUpSandboxConfig.roleLabelKey || freshUpSandboxConfig.roleType}
                  onValueChange={(value) => setFreshUpSandboxConfig((prev) => {
                    const nextLabelKey = value as NonNullable<FreshUpSandboxConfig['roleLabelKey']>;
                    if (nextLabelKey === 'random') {
                      return {
                        ...prev,
                        roleLabelKey: 'random',
                        roleType: 'random',
                        interactionDisplayLabel: undefined,
                      };
                    }
                    const nextEngineRole = SANDBOX_ENGINE_ROLE_BY_LABEL[nextLabelKey];
                    return {
                      ...prev,
                      roleLabelKey: nextLabelKey,
                      roleType: nextEngineRole,
                      interactionDisplayLabel: getRoleLabels(nextLabelKey).interactionLabel,
                    };
                  })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SANDBOX_ROLE_LABEL_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Source Type</Label>
                <Select
                  value={freshUpSandboxConfig.sourceType}
                  onValueChange={(value) => setFreshUpSandboxConfig((prev) => ({ ...prev, sourceType: value as FreshUpSandboxConfig['sourceType'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SANDBOX_SOURCE_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select
                  value={freshUpSandboxConfig.difficulty}
                  onValueChange={(value) => setFreshUpSandboxConfig((prev) => ({ ...prev, difficulty: value as FreshUpSandboxConfig['difficulty'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SANDBOX_DIFFICULTIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vehicle Interest</Label>
                <Select
                  value={freshUpSandboxConfig.vehicleInterest}
                  onValueChange={(value) => setFreshUpSandboxConfig((prev) => ({ ...prev, vehicleInterest: value as FreshUpSandboxConfig['vehicleInterest'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SANDBOX_VEHICLES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Primary Concern</Label>
                <Select
                  value={freshUpSandboxConfig.primaryConcern}
                  onValueChange={(value) => setFreshUpSandboxConfig((prev) => ({ ...prev, primaryConcern: value as FreshUpSandboxConfig['primaryConcern'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SANDBOX_PRIMARY_CONCERNS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Starting Mood</Label>
                <Select
                  value={freshUpSandboxConfig.startingMood}
                  onValueChange={(value) => setFreshUpSandboxConfig((prev) => ({ ...prev, startingMood: value as FreshUpSandboxConfig['startingMood'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SANDBOX_MOODS.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Personality Type</Label>
                <Select
                  value={freshUpSandboxConfig.personalityType}
                  onValueChange={(value) => setFreshUpSandboxConfig((prev) => ({ ...prev, personalityType: value as FreshUpSandboxConfig['personalityType'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SANDBOX_PERSONALITIES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Communication Style</Label>
                <Select
                  value={freshUpSandboxConfig.communicationStyle}
                  onValueChange={(value) => setFreshUpSandboxConfig((prev) => ({ ...prev, communicationStyle: value as FreshUpSandboxConfig['communicationStyle'] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SANDBOX_COMMUNICATION_STYLES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Starting Up Meter</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={freshUpSandboxConfig.startingUpMeter}
                  onChange={(event) => setFreshUpSandboxConfig((prev) => ({ ...prev, startingUpMeter: clampScore(Number(event.target.value)) }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Force Character / Scenario (Optional)</Label>
                <Input
                  value={freshUpSandboxConfig.forceProfileIdOrName || ''}
                  onChange={(event) => setFreshUpSandboxConfig((prev) => ({ ...prev, forceProfileIdOrName: event.target.value }))}
                  placeholder="e.g. sig-trade-in-skeptic or scenario name"
                />
              </div>
              <div className="space-y-2">
                <Label>Force Archetype (Optional)</Label>
                <Input
                  value={freshUpSandboxConfig.forceArchetypeIdOrName || ''}
                  onChange={(event) => setFreshUpSandboxConfig((prev) => ({ ...prev, forceArchetypeIdOrName: event.target.value }))}
                  placeholder="e.g. funny-dad-joke-machine or archetype name"
                />
              </div>
              <div className="space-y-2">
                <Label>Force Tempo (Optional)</Label>
                <Select
                  value={freshUpSandboxConfig.forceTempoIdOrName || ''}
                  onValueChange={(value) => setFreshUpSandboxConfig((prev) => ({ ...prev, forceTempoIdOrName: value === 'none' ? '' : value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Any tempo profile" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any tempo profile</SelectItem>
                    {SANDBOX_TEMPO_OPTIONS.map((item) => (
                      <SelectItem key={`tempo-${item.value}`} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Memory Debug Mode</p>
                  <p className="text-xs text-muted-foreground">Expose post-session memory state panels.</p>
                </div>
                <Switch
                  checked={freshUpSandboxConfig.memoryDebugMode}
                  onCheckedChange={(checked) => setFreshUpSandboxConfig((prev) => ({ ...prev, memoryDebugMode: checked }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Scoring Debug Mode</p>
                  <p className="text-xs text-muted-foreground">Expose post-session scoring movement panels.</p>
                </div>
                <Switch
                  checked={freshUpSandboxConfig.scoringDebugMode}
                  onCheckedChange={(checked) => setFreshUpSandboxConfig((prev) => ({ ...prev, scoringDebugMode: checked }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Save Session to Live Analytics</p>
                  <p className="text-xs text-muted-foreground">Off by default to avoid contaminating production analytics.</p>
                </div>
                <Switch
                  checked={freshUpSandboxConfig.saveSessionToLiveAnalytics}
                  onCheckedChange={(checked) => setFreshUpSandboxConfig((prev) => ({ ...prev, saveSessionToLiveAnalytics: checked }))}
                />
              </div>
            </div>

            <Button type="button" className="w-full md:w-auto" onClick={handleLaunchFreshUpSandbox}>
              Launch Fresh Up Test
            </Button>

            <div className="space-y-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-semibold">AIS Score Interpretation Sandbox</p>
                <p className="text-xs text-muted-foreground">
                  Test how the same score is interpreted across roles without changing raw numeric values.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={scoreInterpretationTest.roleType}
                    onValueChange={(value) => setScoreInterpretationTest((prev) => ({
                      ...prev,
                      roleType: value as FreshUpSandboxConfig['roleType'],
                    }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SANDBOX_ROLE_TYPES.filter((item) => item.value !== 'random').map((item) => (
                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Metric</Label>
                  <Select
                    value={scoreInterpretationTest.metricName}
                    onValueChange={(value) => setScoreInterpretationTest((prev) => ({ ...prev, metricName: value as AisMetricName }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AIS_METRIC_OPTIONS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Score</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={scoreInterpretationTest.metricValue}
                    onChange={(event) => setScoreInterpretationTest((prev) => ({
                      ...prev,
                      metricValue: clampScore(Number(event.target.value)),
                    }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Concern Category</Label>
                  <Input
                    value={scoreInterpretationTest.concernCategory}
                    onChange={(event) => setScoreInterpretationTest((prev) => ({ ...prev, concernCategory: event.target.value }))}
                    placeholder="e.g. price, repair timeline, availability, paperwork stress"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Archetype Context</Label>
                  <Input
                    value={scoreInterpretationTest.archetypeContext}
                    onChange={(event) => setScoreInterpretationTest((prev) => ({ ...prev, archetypeContext: event.target.value }))}
                    placeholder="e.g. skeptical"
                  />
                </div>
              </div>
              {scoreInterpretationPreview && (
                <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground space-y-2">
                  <p><span className="font-semibold text-foreground">Score Band:</span> {scoreInterpretationPreview.scoreBand}</p>
                  <p><span className="font-semibold text-foreground">Meaning:</span> {scoreInterpretationPreview.displayMeaning}</p>
                  <p><span className="font-semibold text-foreground">Role Interpretation:</span> {scoreInterpretationPreview.roleSpecificInterpretation}</p>
                  <p><span className="font-semibold text-foreground">Feedback Line:</span> {scoreInterpretationPreview.feedbackLine}</p>
                  <p><span className="font-semibold text-foreground">Coaching Example:</span> {scoreInterpretationPreview.coachingExample}</p>
                  <p><span className="font-semibold text-foreground">Improvement Focus:</span> {scoreInterpretationPreview.recommendedImprovementFocus}</p>
                </div>
              )}
            </div>

            <Collapsible className="rounded-md border">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-left">
                <div>
                  <p className="text-sm font-semibold">Fresh Up QA Matrix</p>
                  <p className="text-xs text-muted-foreground">Run silent simulation batches to stress-test Fresh Up behavior combinations.</p>
                </div>
                <Badge variant="secondary">Developer QA</Badge>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-5 border-t px-4 py-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Number of Simulated Sessions</Label>
                      <Input
                        type="number"
                        min={5}
                        max={200}
                        value={qaConfig.sessionsToRun}
                        onChange={(event) => setQaConfig((prev) => ({ ...prev, sessionsToRun: Math.max(5, Math.min(200, Math.round(Number(event.target.value || 20)))) }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Source Type</Label>
                      <Select value={qaConfig.sourceType} onValueChange={(value) => setQaConfig((prev) => ({ ...prev, sourceType: value as FreshUpQASimulationConfig['sourceType'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {QA_SOURCE_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Difficulty Range</Label>
                      <Select value={qaConfig.difficultyRange} onValueChange={(value) => setQaConfig((prev) => ({ ...prev, difficultyRange: value as FreshUpQASimulationConfig['difficultyRange'] }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {QA_DIFFICULTY_RANGES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="rounded-md border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">QA Version Comparison</p>
                        <p className="text-xs text-muted-foreground">Run side-by-side QA between two Fresh Up versions.</p>
                      </div>
                      <Switch checked={qaCompareEnabled} onCheckedChange={setQaCompareEnabled} />
                    </div>
                    {qaCompareEnabled && (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Version A</Label>
                          <Select value={qaCompareLeftVersionId} onValueChange={setQaCompareLeftVersionId}>
                            <SelectTrigger><SelectValue placeholder="Select version" /></SelectTrigger>
                            <SelectContent>
                              {freshUpVersions.map((version) => (
                                <SelectItem key={`qa-left-${version.versionId}`} value={version.versionId}>
                                  {version.versionName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Version B</Label>
                          <Select value={qaCompareRightVersionId} onValueChange={setQaCompareRightVersionId}>
                            <SelectTrigger><SelectValue placeholder="Select version" /></SelectTrigger>
                            <SelectContent>
                              {freshUpVersions.map((version) => (
                                <SelectItem key={`qa-right-${version.versionId}`} value={version.versionId}>
                                  {version.versionName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-md border p-3">
                      <p className="mb-2 text-sm font-medium">Vehicle Interest Pool</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {QA_VEHICLE_OPTIONS.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={qaConfig.vehicleInterestPool.includes(option.value)}
                              onCheckedChange={() => setQaConfig((prev) => ({ ...prev, vehicleInterestPool: togglePoolValue(prev.vehicleInterestPool, option.value) }))}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="mb-2 text-sm font-medium">Primary Concern Pool</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {QA_PRIMARY_CONCERN_OPTIONS.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={qaConfig.primaryConcernPool.includes(option.value)}
                              onCheckedChange={() => setQaConfig((prev) => ({ ...prev, primaryConcernPool: togglePoolValue(prev.primaryConcernPool, option.value) }))}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="mb-2 text-sm font-medium">Personality Pool</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {QA_PERSONALITY_OPTIONS.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={qaConfig.personalityPool.includes(option.value)}
                              onCheckedChange={() => setQaConfig((prev) => ({ ...prev, personalityPool: togglePoolValue(prev.personalityPool, option.value) }))}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md border p-3">
                      <p className="mb-2 text-sm font-medium">Communication Style Pool</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {QA_COMMUNICATION_OPTIONS.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={qaConfig.communicationStylePool.includes(option.value)}
                              onCheckedChange={() => setQaConfig((prev) => ({ ...prev, communicationStylePool: togglePoolValue(prev.communicationStylePool, option.value) }))}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md border p-3 lg:col-span-2">
                      <p className="mb-2 text-sm font-medium">Mood Pool</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {QA_MOOD_OPTIONS.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={qaConfig.moodPool.includes(option.value)}
                              onCheckedChange={() => setQaConfig((prev) => ({ ...prev, moodPool: togglePoolValue(prev.moodPool, option.value) }))}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md border p-3 lg:col-span-2">
                      <p className="mb-2 text-sm font-medium">Archetype Category Filter</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {QA_ARCHETYPE_CATEGORY_OPTIONS.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={qaConfig.archetypeCategoryPool.includes(option.value)}
                              onCheckedChange={() => setQaConfig((prev) => ({ ...prev, archetypeCategoryPool: togglePoolValue(prev.archetypeCategoryPool, option.value) as FreshUpArchetypeCategory[] }))}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-md border p-3 lg:col-span-2">
                      <p className="mb-2 text-sm font-medium">Tempo Profile Pool</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {SANDBOX_TEMPO_OPTIONS.map((option) => (
                          <label key={`qa-tempo-${option.value}`} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={qaConfig.tempoPool.includes(option.value)}
                              onCheckedChange={() => setQaConfig((prev) => ({ ...prev, tempoPool: togglePoolValue(prev.tempoPool, option.value) }))}
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button type="button" onClick={handleRunFreshUpQAMatrix} disabled={isRunningQAMatrix || !qaMatrixEnabledForSelectedVersion}>
                    {isRunningQAMatrix ? 'Running QA Simulation...' : 'Run Fresh Up QA Simulation'}
                  </Button>
                  {!qaMatrixEnabledForSelectedVersion && (
                    <p className="text-xs text-muted-foreground">QA Matrix is disabled for the selected sandbox version. Enable `enableQAMatrix` for this version to run simulations.</p>
                  )}

                  {qaSummary && (
                    <div className="space-y-4 rounded-md border p-4">
                      <div className="grid gap-3 md:grid-cols-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Total Sessions Run</p>
                          <p className="text-lg font-semibold">{qaSummary.totalSessionsRun}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Average Up Meter Change</p>
                          <p className="text-lg font-semibold">{qaSummary.averageUpMeterChange > 0 ? '+' : ''}{qaSummary.averageUpMeterChange}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Flagged Sessions</p>
                          <p className="text-lg font-semibold">{qaSummary.flaggedSessions.length}</p>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-md border p-3">
                          <p className="text-sm font-medium">Outcome Distribution</p>
                          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                            <p>positive_progress: {qaSummary.outcomeDistribution.positive_progress}</p>
                            <p>neutral_pause: {qaSummary.outcomeDistribution.neutral_pause}</p>
                            <p>stalled_conversation: {qaSummary.outcomeDistribution.stalled_conversation}</p>
                            <p>trust_break: {qaSummary.outcomeDistribution.trust_break}</p>
                            <p>appointment_ready: {qaSummary.outcomeDistribution.appointment_ready}</p>
                          </div>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-sm font-medium">Average Skill Score Impact</p>
                          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                            <p>empathy: {qaSummary.averageSkillScoreImpact.empathy > 0 ? '+' : ''}{qaSummary.averageSkillScoreImpact.empathy}</p>
                            <p>listening: {qaSummary.averageSkillScoreImpact.listening > 0 ? '+' : ''}{qaSummary.averageSkillScoreImpact.listening}</p>
                            <p>trust: {qaSummary.averageSkillScoreImpact.trust > 0 ? '+' : ''}{qaSummary.averageSkillScoreImpact.trust}</p>
                            <p>relationship: {qaSummary.averageSkillScoreImpact.relationship > 0 ? '+' : ''}{qaSummary.averageSkillScoreImpact.relationship}</p>
                            <p>follow_up: {qaSummary.averageSkillScoreImpact.follow_up > 0 ? '+' : ''}{qaSummary.averageSkillScoreImpact.follow_up}</p>
                            <p>closing: {qaSummary.averageSkillScoreImpact.closing > 0 ? '+' : ''}{qaSummary.averageSkillScoreImpact.closing}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-md border p-3">
                        <p className="text-sm font-medium">Archetype Performance Comparison</p>
                        <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                          {qaSummary.archetypePerformance.length === 0 ? (
                            <p>No archetype category data available in this run.</p>
                          ) : (
                            qaSummary.archetypePerformance.map((row) => (
                              <p key={row.archetypeCategory}>
                                {row.archetypeCategory}: {row.sessions} sessions, peak {row.averageUpMeterPeak}, trust-break rate {row.trustBreakRate}%
                              </p>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="rounded-md border p-3">
                        <p className="text-sm font-medium">Most Common Failure Conditions</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {qaSummary.mostCommonFailureConditions.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No dominant failure condition detected in this run.</span>
                          ) : (
                            qaSummary.mostCommonFailureConditions.map((item) => (
                              <Badge key={`${item.flag}-${item.count}`} variant="outline">{item.flag} ({item.count})</Badge>
                            ))
                          )}
                        </div>
                      </div>

                      {qaComparison && (
                        <div className="rounded-md border p-3">
                          <p className="text-sm font-medium">Version Comparison Snapshot</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {qaComparison.left.freshUpVersionName || qaComparison.left.freshUpVersionId} vs {qaComparison.right.freshUpVersionName || qaComparison.right.freshUpVersionId}
                          </p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-muted-foreground">
                            <p>Average Up Meter Peak Δ: {qaComparison.deltas.averageUpMeterPeak > 0 ? '+' : ''}{qaComparison.deltas.averageUpMeterPeak}</p>
                            <p>Average Up Meter Change Δ: {qaComparison.deltas.averageUpMeterChange > 0 ? '+' : ''}{qaComparison.deltas.averageUpMeterChange}</p>
                            <p>Flagged Sessions Δ: {qaComparison.deltas.flaggedSessionDelta > 0 ? '+' : ''}{qaComparison.deltas.flaggedSessionDelta}</p>
                            <p>Guardrail Failures Δ: {qaComparison.deltas.guardrailFailureDelta > 0 ? '+' : ''}{qaComparison.deltas.guardrailFailureDelta}</p>
                            <p>Trust Impact Δ: {qaComparison.deltas.averageSkillScoreImpact.trust > 0 ? '+' : ''}{qaComparison.deltas.averageSkillScoreImpact.trust}</p>
                            <p>Closing Impact Δ: {qaComparison.deltas.averageSkillScoreImpact.closing > 0 ? '+' : ''}{qaComparison.deltas.averageSkillScoreImpact.closing}</p>
                          </div>
                        </div>
                      )}

                      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                        <div className="rounded-md border p-3">
                          <p className="text-sm font-medium">Flagged Sessions</p>
                          <div className="mt-2 max-h-[360px] space-y-2 overflow-y-auto">
                            {qaSummary.flaggedSessions.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No flagged sessions in this run.</p>
                            ) : (
                              qaSummary.flaggedSessions.map((session) => (
                                <button
                                  key={session.simulationID}
                                  type="button"
                                  className={`w-full rounded border p-2 text-left text-xs ${selectedQASession?.simulationID === session.simulationID ? 'border-primary bg-primary/5' : 'border-border'}`}
                                  onClick={() => setSelectedQASessionId(session.simulationID)}
                                >
                                  <p className="font-semibold">{session.simulationID}</p>
                                  <p className="text-muted-foreground">{session.customerProfile.characterName} · {session.endingType}</p>
                                  <p className="mt-1 text-muted-foreground">{Array.from(new Set([...(session.failureFlags || []), ...(session.guardrailFlags || [])])).join(', ')}</p>
                                </button>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="rounded-md border p-3">
                          <p className="text-sm font-medium">Session Review</p>
                          {!selectedQASession ? (
                            <p className="mt-2 text-xs text-muted-foreground">Select a flagged session to inspect profile, transcript, meter movement, and ending details.</p>
                          ) : (
                            <div className="mt-2 space-y-3 text-sm">
                              <div>
                                <p className="font-medium">Generated Customer Profile</p>
                                <p className="text-xs text-muted-foreground">
                                  {selectedQASession.customerProfile.characterName} · {selectedQASession.customerProfile.personalityType} · {selectedQASession.customerProfile.vehicleInterest} · {selectedQASession.customerProfile.primaryConcern}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Archetype: {selectedQASession.customerProfile.archetypeName} ({selectedQASession.customerProfile.archetypeCategory}) · Humor {selectedQASession.customerProfile.humorLevel}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Tempo: {selectedQASession.customerProfile.conversationTempoName || 'Steady'} ({selectedQASession.customerProfile.conversationTempoId || 'steady'})
                                </p>
                              </div>
                              <div>
                                <p className="font-medium">Opening Message</p>
                                <p className="text-xs text-muted-foreground">{selectedQASession.openingMessage}</p>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <p className="text-xs text-muted-foreground">Up Meter: {selectedQASession.upMeterStart} → {selectedQASession.upMeterPeak} → {selectedQASession.upMeterEnd}</p>
                                <p className="text-xs text-muted-foreground">Ending: {selectedQASession.endingType} · {selectedQASession.outcomeTag}</p>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <p className="text-xs text-muted-foreground">Content Validation: {selectedQASession.contentValidationPassed ? 'Passed' : 'Failed'}</p>
                                <p className="text-xs text-muted-foreground">Validation Reasons: {(selectedQASession.validationFailureReasons || []).join(', ') || 'None'}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">Guardrail Flags: {(selectedQASession.guardrailFlags || []).join(', ') || 'None'}</p>
                              <div className="grid gap-2 sm:grid-cols-3">
                                <p className="text-xs text-muted-foreground">Empathy: {selectedQASession.skillScores.empathy}</p>
                                <p className="text-xs text-muted-foreground">Listening: {selectedQASession.skillScores.listening}</p>
                                <p className="text-xs text-muted-foreground">Trust: {selectedQASession.skillScores.trust}</p>
                                <p className="text-xs text-muted-foreground">Relationship: {selectedQASession.skillScores.relationship}</p>
                                <p className="text-xs text-muted-foreground">Follow Up: {selectedQASession.skillScores.follow_up}</p>
                                <p className="text-xs text-muted-foreground">Closing: {selectedQASession.skillScores.closing}</p>
                              </div>
                              <div>
                                <p className="font-medium">Conversation Transcript</p>
                                <div className="mt-1 max-h-[300px] overflow-y-auto rounded bg-muted p-2">
                                  {selectedQASession.conversationTranscript.map((line, idx) => (
                                    <p key={`${line.speaker}-${idx}`} className="mb-1 text-xs">
                                      <span className="font-semibold">{line.speaker}:</span> {line.text}
                                      <span className="text-muted-foreground"> (Up Meter {line.upMeter})</span>
                                    </p>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
        {canSeeDeveloperCxTuner && !showDeveloperCxTuner && (
          <Card className="mt-6 border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Developer CX Live Tuner</CardTitle>
              <CardDescription>
                This control set appears in Single User mode so you can preview CX score behavior in real time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button type="button" variant="outline" onClick={() => setDashboardMode('single_user')}>
                Switch to Single User
              </Button>
            </CardContent>
          </Card>
        )}
        {showDeveloperCxTuner && (
          <Card className="mt-6 border-primary/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Developer CX Live Tuner</CardTitle>
              <CardDescription>
                Developer-only preview controls. Updates the Single User CX chart in real time without writing to Firestore.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {LIVE_CX_TRAITS.map((trait) => (
                <div key={trait.key} className="grid gap-2 md:grid-cols-[140px_1fr_90px] md:items-center">
                  <Label className="text-sm font-medium">{trait.label}</Label>
                  <Slider
                    value={[singleUserScores[trait.key]]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(values) => updateSingleUserScore(trait.key, values[0] ?? 0)}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={singleUserScores[trait.key]}
                    onChange={(event) => updateSingleUserScore(trait.key, Number(event.target.value))}
                    className="h-8"
                  />
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" variant="outline" onClick={resetSingleUserScores}>
                  Reset to Profile
                </Button>
                <Button type="button" variant="outline" onClick={applyBenchmarkPreset}>
                  Apply Benchmarks
                </Button>
                <Button type="button" variant="outline" onClick={() => setAllSingleUserScores(60)}>
                  Set All 60
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
        <div className="mt-6 border-t pt-8">
          {isViewingAsManager ? (
            <ManagerDashboard key={`sandbox-manager-${sandboxDealershipId}-${dashboardUser.role}`} user={dashboardUser} />
          ) : (
            <ConsultantDashboard
              user={dashboardUser}
              sprocketTourPreviewNonce={sprocketTourPreviewNonce}
              isSprocketTourSandboxPreview
            />
          )}
        </div>
      </CardContent>
    </Card>
  );

  const renderToolPanel = () => {
    if (activeTool === 'ppp_global') {
      return <PppProtocolSettings />;
    }
    if (activeTool === 'create_user') {
      return <CreateUserForm onUserCreated={refreshData} dealerships={allDealerships} />;
    }
    if (activeTool === 'edit_user') {
      return <EditUserForm manageableUsers={manageableUsers} dealerships={allDealerships} onUserUpdated={refreshData} />;
    }
    if (activeTool === 'assign_dealerships') {
      return (
        <AssignDealershipsForm
          manageableUsers={manageableUsers}
          dealerships={allDealerships}
          currentUser={originalUser}
          onDealershipsAssigned={refreshData}
        />
      );
    }
    if (activeTool === 'invite') {
      return <RegisterDealershipForm user={originalUser} dealerships={allDealerships} onUserInvited={refreshData} />;
    }
    if (activeTool === 'remove') {
      return <RemoveUserForm manageableUsers={manageableUsers} onUserRemoved={refreshData} />;
    }
    if (activeTool === 'create_dealership') {
      return <CreateDealershipForm user={originalUser} onDealershipCreated={refreshData} />;
    }
    return <ManageDealershipForm dealerships={allDealerships} onDealershipManaged={refreshData} />;
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Manageable Users</CardDescription>
            <CardTitle>{manageableUsers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Dealerships</CardDescription>
            <CardTitle>{allDealerships.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>New Users (Range)</CardDescription>
            <CardTitle>{filteredNewestUsers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paused Dealerships</CardDescription>
            <CardTitle>{pausedDealershipCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Jump directly to the most common admin workflows.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => goToSection('people_access', 'create_user')}>Create User</Button>
          <Button variant="outline" onClick={() => goToSection('people_access', 'invite')}>Send Invitation</Button>
          <Button variant="outline" onClick={() => goToSection('dealerships', 'create_dealership')}>Create Dealership</Button>
          <Button variant="outline" onClick={() => goToSection('product_controls', 'ppp_global')}>PPP Global Setting</Button>
          <Button variant="outline" onClick={() => goToSection('revenue_growth')}>Consultant Metrics</Button>
          <Button variant="outline" onClick={() => goToSection('monitoring')}>Open Monitoring</Button>
          <Button variant="outline" onClick={() => goToSection('sandbox')}>Open Sandbox</Button>
          <Button
            variant="outline"
            onClick={() => window.open(strategicDeckHref, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open Strategic Deck
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderConsultants = () => {
    const normalizedConsultantId = consultantLookupId.trim().toLowerCase() || 'lee';
    const quickAccessConsultantId = consultantLookupId.trim().toLowerCase();
    const dashboardHref = `/consultant/${encodeURIComponent(normalizedConsultantId)}`;
    const salesReportHref = `/consultant/${encodeURIComponent(normalizedConsultantId)}/sales-report`;
    const dealerPipelineHref = `/consultant/${encodeURIComponent(normalizedConsultantId)}/dealer-pipeline`;
    const customersHref = `/consultant/${encodeURIComponent(normalizedConsultantId)}/customers`;
    const guidedDemoShareHref = buildConsultantOutreachLink('guidedDemo', normalizedConsultantId);

    const openConsultantDashboard = () => {
      if (!quickAccessConsultantId) return;
      router.push(`/consultant/${encodeURIComponent(quickAccessConsultantId)}`);
    };

    const openConsultantSalesReport = () => {
      if (!quickAccessConsultantId) return;
      router.push(`/consultant/${encodeURIComponent(quickAccessConsultantId)}/sales-report`);
    };

    const openConsultantDealerPipeline = () => {
      if (!quickAccessConsultantId) return;
      router.push(`/consultant/${encodeURIComponent(quickAccessConsultantId)}/dealer-pipeline`);
    };

    const openConsultantCustomers = () => {
      if (!quickAccessConsultantId) return;
      router.push(`/consultant/${encodeURIComponent(quickAccessConsultantId)}/customers`);
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle>Consultant Revenue</CardTitle>
          <CardDescription>
            Open consultant performance dashboards and Stripe-backed revenue views.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm space-y-1">
            <Label htmlFor="ak-consultant-id">Consultant ID</Label>
            <Select value={consultantLookupId} onValueChange={setConsultantLookupId}>
              <SelectTrigger id="ak-consultant-id">
                <SelectValue placeholder="Select consultant" />
              </SelectTrigger>
              <SelectContent>
                {consultantOptions.length === 0 ? (
                  <SelectItem value="lee">Lee</SelectItem>
                ) : (
                  consultantOptions.map((consultant) => (
                    <SelectItem key={consultant.code} value={consultant.code}>
                      {consultant.name} ({consultant.code})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Uses Stripe subscription metadata key: <code>consultant</code>
            </p>
          </div>
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <p className="text-sm font-medium">Consultant Dashboard Quick Access</p>
            <p className="text-xs text-muted-foreground">
              Jump directly to consultant routes using the referral code.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={openConsultantDashboard}>
                Open Consultant Dashboard
              </Button>
              <Button variant="outline" onClick={openConsultantSalesReport}>
                Open Sales Report
              </Button>
              <Button variant="outline" onClick={openConsultantDealerPipeline}>
                Open Dealer Pipeline
              </Button>
              <Button variant="outline" onClick={openConsultantCustomers}>
                Open Customers
              </Button>
            </div>
          </div>
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <p className="text-sm font-medium">Public Guided Tour Link</p>
            <p className="text-xs text-muted-foreground">
              Share this link externally to launch the guided demo role selector.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void handleCopyGuidedDemoLink(guidedDemoShareHref)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open(guidedDemoShareHref, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open
              </Button>
            </div>
            <div className="rounded bg-muted px-3 py-2 text-xs break-all">
              {guidedDemoShareHref}
            </div>
          </div>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="sm:col-span-2 xl:col-span-4 flex items-center justify-between rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              <p>
                Last refreshed:{' '}
                {consultantMetricsLastRefreshedAt
                  ? consultantMetricsLastRefreshedAt.toLocaleString()
                  : 'Not refreshed yet'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadConsultantMetrics()}
                disabled={consultantMetricsLoading}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Metrics
              </Button>
            </div>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Gross Sales (Monthly)</CardDescription>
                <CardTitle>${consultantMonthlyGross.toLocaleString('en-US')}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Gross Sales (Yearly)</CardDescription>
                <CardTitle>${consultantYearlyGross.toLocaleString('en-US')}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Payout This Month</CardDescription>
                <CardTitle>${consultantMonthlyPayout.toLocaleString('en-US')}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Active Consultants</CardDescription>
                <CardTitle>{consultantLeaderboard.length}</CardTitle>
              </CardHeader>
            </Card>
          </section>
          <Card>
            <CardHeader>
              <CardTitle>AK Consultant Leaderboard</CardTitle>
              <CardDescription>Ranked by active subscriber count and monthly gross revenue.</CardDescription>
            </CardHeader>
            <CardContent>
              {consultantMetricsLoading ? (
                <p className="text-sm text-muted-foreground">Loading consultant metrics...</p>
              ) : consultantMetricsError ? (
                <p className="text-sm text-red-500">{consultantMetricsError}</p>
              ) : consultantLeaderboard.length === 0 ? (
                <p className="text-sm text-muted-foreground">No consultant leaderboard data found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Consultant</TableHead>
                      <TableHead>Subscribers</TableHead>
                      <TableHead>Monthly Gross</TableHead>
                      <TableHead>Commissions To Be Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consultantLeaderboard.map((row, index) => (
                      <TableRow key={row.consultant}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{row.consultant}</TableCell>
                        <TableCell>{row.sales}</TableCell>
                        <TableCell>${Number(row.monthly_revenue || 0).toLocaleString('en-US')}</TableCell>
                        <TableCell>
                          ${(consultantCommissionDueById[String(row.consultant || '').toLowerCase()] || 0).toLocaleString('en-US')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <div className="space-y-2">
            <p className="text-sm font-medium">Admin Tools</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link href="/admin/consultants">Open Consultant Manager</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/dealers">Open Admin Dealer Pipeline</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <p><span className="font-medium">Consultant Manager:</span> /admin/consultants</p>
            <p><span className="font-medium">Admin Dealer Pipeline:</span> /admin/dealers</p>
            <p><span className="font-medium">Dashboard:</span> {dashboardHref}</p>
            <p><span className="font-medium">Sales Report:</span> {salesReportHref}</p>
            <p><span className="font-medium">Dealer Pipeline:</span> {dealerPipelineHref}</p>
            <p><span className="font-medium">Customers:</span> {customersHref}</p>
            <p><span className="font-medium">Guided Tour (Public):</span> {guidedDemoShareHref}</p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderTourEmails = () => {
    const allEmailsBlock = signalMapperUnlocks
      .map((entry) => entry.email)
      .join('\n');

    return (
      <Card>
        <CardHeader>
          <CardTitle>Signal Mapper Unlock Emails</CardTitle>
          <CardDescription>
            Real emails submitted in the free Signal Mapper unlock form.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={signalMapperUnlocks.length === 0}
              onClick={() => void handleCopyValue(allEmailsBlock, 'All unlock emails copied.')}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy All Emails
            </Button>
            <Button type="button" variant="outline" onClick={() => void loadSignalMapperUnlocks()} disabled={signalMapperUnlocksLoading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>

          {signalMapperUnlocksError && (
            <p className="text-sm text-red-500">{signalMapperUnlocksError}</p>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Latest Unlock</TableHead>
                <TableHead>Count</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {signalMapperUnlocksLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">Loading unlock emails...</TableCell>
                </TableRow>
              ) : signalMapperUnlocks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">No unlock emails captured yet.</TableCell>
                </TableRow>
              ) : signalMapperUnlocks.map((entry) => (
                <TableRow key={entry.email}>
                  <TableCell className="font-mono text-xs">{entry.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(entry.lastUnlockedAt).toLocaleString()}</TableCell>
                  <TableCell>{entry.count}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleCopyValue(entry.email, 'Unlock email copied.')}
                      >
                        Copy Email
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  const renderRevenueGrowth = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Growth Links</CardTitle>
          <CardDescription>Public and internal links used for acquisition and conversion testing.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border p-3">
            <p className="text-sm font-medium">Testing Link: Signup Page</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Open or copy the signup flow used to test Stripe checkout and conversion paths.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Button type="button" variant="outline" onClick={handleCopyTempProSignupLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
              <Button type="button" variant="outline" onClick={() => window.open(tempProSignupUrl, '_blank', 'noopener,noreferrer')}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open
              </Button>
            </div>
            <div className="mt-3 rounded bg-muted px-3 py-2 text-xs break-all">
              {tempProSignupUrl}
            </div>
          </div>
        </CardContent>
      </Card>
      {renderConsultants()}
      {renderTourEmails()}
    </div>
  );

  const renderLeads = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Lead Pipelines</CardTitle>
          <CardDescription>Unified view of lead capture across AutoForge, Sprocket, and future inbound sources.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Use this section as the single place to review incoming leads, source quality, and follow-up opportunities across products.
          </p>
        </CardContent>
      </Card>
      <AutoForgeLeadsPanel />
      <SprocketActivityPanel />
    </div>
  );

  const renderMonitoring = () => (
    <div className="space-y-6">
      <ToolUsageMonitoringPanel />
      {renderWatchlistCard()}
      <Card>
        <CardHeader>
          <CardTitle>System Diagnostics</CardTitle>
          <CardDescription>Operational checks and health endpoints.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Admin health endpoints and deeper diagnostics can be linked here as this surface expands.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const renderMainSection = () => {
    if (activeSection === 'dashboard') return renderDashboard();
    if (activeSection === 'revenue_growth') return renderRevenueGrowth();
    if (activeSection === 'leads') return renderLeads();
    if (activeSection === 'monitoring') return renderMonitoring();
    if (activeSection === 'sandbox') return renderSandbox();

    const sectionTools = TOOLS.filter((tool) => tool.section === activeSection || (activeSection === 'danger' && tool.id === 'remove'));

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{SECTION_LABELS[activeSection]} Tools</CardTitle>
            <CardDescription>Select a workflow to open the corresponding management panel.</CardDescription>
          </CardHeader>
          <CardContent>
            {activeSection === 'people_access' && (
              <div className="mb-6 space-y-3">
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium">Grant Site Traffic Access</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Adds a Site Traffic destination to the selected user&apos;s avatar dropdown without exposing the full Admin Intelligence dashboard.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Select value={siteTrafficTargetUserId} onValueChange={setSiteTrafficTargetUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user for Site Traffic" />
                        </SelectTrigger>
                        <SelectContent>
                          {giftableUsers.map((candidate) => (
                            <SelectItem key={candidate.userId} value={candidate.userId}>
                              {candidate.name} ({candidate.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => void grantSiteTrafficAccess()}
                          disabled={isGrantingSiteTraffic || isRevokingSiteTraffic || !siteTrafficTargetUserId}
                        >
                          {isGrantingSiteTraffic ? <Spinner size="sm" /> : 'Grant Site Traffic'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void revokeSiteTrafficAccess()}
                          disabled={isGrantingSiteTraffic || isRevokingSiteTraffic || !siteTrafficTargetUserId}
                        >
                          {isRevokingSiteTraffic ? <Spinner size="sm" /> : 'Revoke Access'}
                        </Button>
                      </div>
                    </div>
                  </div>
              </div>
            )}
            {activeSection === 'product_controls' && (
              <div className="mb-6 space-y-3">
                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium">Gift AutoShop Access</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Grants full AutoShop access for the selected user, including paid Sprocket and AutoDriveCX personalization.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Select value={giftTargetUserId} onValueChange={setGiftTargetUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user to gift" />
                        </SelectTrigger>
                        <SelectContent>
                          {giftableUsers.map((candidate) => (
                            <SelectItem key={candidate.userId} value={candidate.userId}>
                              {candidate.name} ({candidate.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Button type="button" onClick={() => void giftToolboxAccess()} disabled={isGiftingToolbox || isRevertingToolbox || !giftTargetUserId}>
                          {isGiftingToolbox ? <Spinner size="sm" /> : 'Gift AutoShop'}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => void revertToolboxAccess()} disabled={isGiftingToolbox || isRevertingToolbox || !giftTargetUserId}>
                          {isRevertingToolbox ? <Spinner size="sm" /> : 'Revert Gift'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium">Dealership AutoShop Access</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Enable or disable dealership-backed AutoShop access (including Sprocket and AutoDriveCX layers) for a selected dealership.
                    </p>
                    <div className="mt-3 grid gap-3">
                      <Select value={toolboxDealershipId} onValueChange={setToolboxDealershipId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select dealership" />
                        </SelectTrigger>
                        <SelectContent>
                          {allDealerships.map((dealership) => (
                            <SelectItem key={dealership.id} value={dealership.id}>
                              {dealership.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">Enable AutoShop Access</p>
                          <p className="text-xs text-muted-foreground">
                            Current: {selectedToolboxDealership?.enableToolboxAccess !== false ? 'Enabled' : 'Disabled'}
                          </p>
                        </div>
                        <Switch
                          checked={toolboxDealershipAccessEnabled}
                          onCheckedChange={setToolboxDealershipAccessEnabled}
                          disabled={!toolboxDealershipId || isSavingToolboxDealershipAccess}
                          aria-label="Enable dealership AutoShop access"
                        />
                      </div>
                      <div className="flex items-center justify-end">
                        <Button
                          type="button"
                          onClick={() => void saveDealershipToolboxAccess()}
                          disabled={
                            !toolboxDealershipId
                            || isSavingToolboxDealershipAccess
                            || toolboxDealershipAccessEnabled === (selectedToolboxDealership?.enableToolboxAccess !== false)
                          }
                        >
                          {isSavingToolboxDealershipAccess ? <Spinner size="sm" /> : 'Save Dealership AutoShop Access'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <p className="text-sm font-medium">Gift AutoDriveCX Access</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Grants AutoDriveCX for the selected user without changing AutoShop tier settings.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <Select value={giftAutoDriveCxTargetUserId} onValueChange={setGiftAutoDriveCxTargetUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user to gift AutoDriveCX" />
                        </SelectTrigger>
                        <SelectContent>
                          {giftableUsers.map((candidate) => (
                            <SelectItem key={candidate.userId} value={candidate.userId}>
                              {candidate.name} ({candidate.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={() => void giftAutoDriveCxAccess()}
                          disabled={isGiftingAutoDriveCx || isRevertingAutoDriveCx || !giftAutoDriveCxTargetUserId}
                        >
                          {isGiftingAutoDriveCx ? <Spinner size="sm" /> : 'Gift AutoDriveCX'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void revertAutoDriveCxAccess()}
                          disabled={isGiftingAutoDriveCx || isRevertingAutoDriveCx || !giftAutoDriveCxTargetUserId}
                        >
                          {isRevertingAutoDriveCx ? <Spinner size="sm" /> : 'Revert Gift'}
                        </Button>
                      </div>
                    </div>
                  </div>
              </div>
            )}
            <div className="mb-6 flex flex-wrap gap-2">
              {sectionTools.map((tool) => (
                <Button
                  key={tool.id}
                  variant={activeTool === tool.id ? 'default' : 'outline'}
                  onClick={() => setActiveTool(tool.id)}
                >
                  {tool.label}
                </Button>
              ))}
            </div>
            {dataLoading ? <Spinner /> : renderToolPanel()}
          </CardContent>
        </Card>

        {activeSection === 'danger' && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle>Danger Zone Guidelines</CardTitle>
              <CardDescription>
                These actions can revoke access or remove critical assignments. Always validate scope before saving.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">Typed confirmation required</Badge>
                <Badge variant="secondary">Immediate effect</Badge>
                <Badge variant="secondary">No rollback flow</Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <Header />
      <main className="flex-1 space-y-6 p-4 pb-24 md:p-6 md:pb-6 lg:p-8">
        <Card className="border-[#8DC63F]/60 bg-[#8DC63F]/10 shadow-[0_0_24px_rgba(141,198,63,0.18)]">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <SlidersHorizontal className="h-10 w-10 text-[#8DC63F] drop-shadow-[0_0_10px_rgba(141,198,63,0.5)]" />
              <div>
                <CardTitle className="text-2xl text-[#8DC63F]">Developer Console</CardTitle>
                <CardDescription className="text-[#8DC63F]/80">
                  Organized around people, dealerships, revenue, product controls, monitoring, and sandboxing.
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" className="md:hidden" onClick={() => setMobileNavOpen(true)}>
              <Menu className="mr-2 h-4 w-4" /> Sections
            </Button>
          </CardHeader>
        </Card>

        <div className="grid gap-6 md:grid-cols-[260px_1fr]">
          <Card className="hidden md:block">
            <CardHeader>
              <CardTitle>Sections</CardTitle>
              <CardDescription>Navigate by admin job to be done.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {SECTION_ORDER.map((section) => {
                const Icon = SECTION_ICONS[section];
                return (
                  <Button
                    key={section}
                    variant={activeSection === section ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => goToSection(section)}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {SECTION_LABELS[section]}
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>{SECTION_LABELS[activeSection]}</CardTitle>
                <CardDescription>{SECTION_DESCRIPTIONS[activeSection]}</CardDescription>
              </CardHeader>
            </Card>
            {renderMainSection()}
          </div>
        </div>
      </main>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[88vw] max-w-sm p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>Developer Sections</SheetTitle>
            <SheetDescription>Choose the admin area you want to work in.</SheetDescription>
          </SheetHeader>
          <div className="space-y-2 p-4">
            {SECTION_ORDER.map((section) => {
              const Icon = SECTION_ICONS[section];
              return (
                <Button
                  key={section}
                  variant={activeSection === section ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => goToSection(section)}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {SECTION_LABELS[section]}
                </Button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-2 backdrop-blur md:hidden">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {BOTTOM_NAV_SECTIONS.map((section) => {
            const Icon = SECTION_ICONS[section];
            return (
              <Button
                key={section}
                variant={activeSection === section ? 'default' : 'outline'}
                size="sm"
                className="h-10 shrink-0"
                onClick={() => goToSection(section)}
              >
                <Icon className="mr-1 h-4 w-4" />
                <span className="truncate text-xs">{SECTION_LABELS[section]}</span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronDown, Minus, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { Header } from '@/components/layout/header';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

type TrendDirection = 'up' | 'down' | 'stable';

type MetricWithTrend = {
  score: number;
  trend: TrendDirection;
};

type IntelligenceResponse = {
  generatedAt: string;
  windows: {
    usage: {
      last7Days: { sessions: number; trend: TrendDirection };
      last30Days: { sessions: number; trend: TrendDirection };
      last90Days: { sessions: number; trend: TrendDirection };
      activeDealers: number;
      activeConsultants: number;
    };
  };
  skillTrends: {
    empathy: MetricWithTrend;
    listening: MetricWithTrend;
    trust: MetricWithTrend;
    relationship: MetricWithTrend;
    closing: MetricWithTrend;
  };
  engagement: {
    averageUpMeterPeak: number;
    label: string;
  };
  siteTraffic: {
    windows: {
      last7Days: { pageViews: number; uniqueVisitors: number; uniquePageSessions: number; trend: TrendDirection };
      last30Days: { pageViews: number; uniqueVisitors: number; uniqueSessions: number; uniquePageSessions: number; trend: TrendDirection };
      last90Days: { pageViews: number; uniqueVisitors: number; uniquePageSessions: number; trend: TrendDirection };
    };
    topPages: Array<{ label: string; count: number; uniqueSessions: number }>;
    landingPages: Array<{ label: string; count: number }>;
    topReferrers: Array<{ label: string; count: number }>;
    topCampaigns: Array<{ label: string; count: number }>;
    geo: {
      topCountries: Array<{ label: string; count: number }>;
      topRegions: Array<{ label: string; count: number }>;
      topCities: Array<{ label: string; count: number }>;
      geoCenter: { latitude: number; longitude: number; sampleSize: number } | null;
    };
    fromPages: Array<{ label: string; count: number }>;
    topNextSteps: Array<{ from: string; to: string; count: number }>;
    deviceBreakdown: Array<{ label: string; count: number }>;
    surfaceBreakdown: Array<{ label: string; count: number }>;
    timeline: Array<{ date: string; pageViews: number; uniqueVisitors: number }>;
    conversions30Days: {
      pageViews: number;
      uniqueVisitors: number;
      authenticatedVisitors: number;
      toolOpens: number;
      autoforgeLeads: number;
      sprocketSessions: number;
      marketingEvents: number;
    };
  };
  sessionActivity: {
    totalFreshUpSessions30Days: number;
    averageConversationLength: number;
  };
  dealerComparison: {
    topPerformingDealers: Array<{
      dealerId: string;
      dealerName: string;
      sessions: number;
      avgTrust: number;
      avgUpMeterPeak: number;
      participationRate: number;
    }>;
    dealersNeedingImprovement: Array<{
      dealerId: string;
      dealerName: string;
      sessions: number;
      avgTrust: number;
      avgUpMeterPeak: number;
      participationRate: number;
    }>;
  };
  outcomes: Array<{ label: string; count: number; percentage: number }>;
  trainingOpportunities: {
    flagged: Array<{ skill: string; score: number; module: string }>;
    primaryInsight: { skill: string; score: number; suggestedModule: string } | null;
  };
  scenarioPerformance: {
    topPerformingScenarios: Array<{
      scenarioId: string;
      scenarioName: string;
      sessions: number;
      avgUpMeterPeak: number;
      avgSkillScore: number;
      completionRate: number;
    }>;
    lowestPerformingScenarios: Array<{
      scenarioId: string;
      scenarioName: string;
      sessions: number;
      avgUpMeterPeak: number;
      avgSkillScore: number;
      completionRate: number;
    }>;
  };
};

type ExportTypeOption = 'raw_sessions' | 'dealer_summary' | 'consultant_trends' | 'manager_coaching' | 'autoforge_triggers' | 'marketing_insights' | 'benchmarks' | 'weekly_digest' | 'risk_radar' | 'command_center';
type ExportFormatOption = 'csv' | 'json' | 'structured';
type BenchmarkTypeOption =
  | 'consultant_vs_dealer'
  | 'dealer_vs_platform'
  | 'current_vs_previous_30'
  | 'archetype_vs_overall'
  | 'concern_vs_overall'
  | 'version_vs_previous_version'
  | 'team_segment_vs_other_segments';
type BenchmarkMetricOption =
  | 'all'
  | 'totalFreshUpSessions'
  | 'averageEmpathy'
  | 'averageListening'
  | 'averageTrust'
  | 'averageFollowUp'
  | 'averageClosing'
  | 'averageRelationship'
  | 'averageUpMeterPeak'
  | 'averageTrustShift'
  | 'averageConversationLength'
  | 'appointmentSetRate'
  | 'conversationBreakdownRate'
  | 'guardrailFlagRate';
type NarrativeTypeOption =
  | 'dealer_performance'
  | 'consultant_trend'
  | 'manager_coaching'
  | 'platform_insight'
  | 'archetype_insight'
  | 'version_comparison'
  | 'marketing_insight';
type NarrativeLengthOption = 'short' | 'standard' | 'extended';
type WeeklyDigestTypeOption =
  | 'dealer_weekly'
  | 'consultant_weekly'
  | 'platform_weekly'
  | 'manager_coaching_weekly'
  | 'version_monitoring_weekly';

type FreshUpExportResponse = {
  fileName: string;
  mimeType: string;
  content: string;
  preview: string;
  rowCount: number;
  generatedAt: string;
  sandboxIncluded: boolean;
  versionCoverage: string[];
};

type FreshUpBenchmarkResponse = {
  benchmarkType: BenchmarkTypeOption;
  generatedAt: string;
  subjectLabel: string;
  comparisonLabel: string;
  rows: Array<{
    benchmarkType: BenchmarkTypeOption;
    metricName: string;
    subjectValue: number;
    comparisonValue: number;
    difference: number;
    differencePercent: number;
    direction: 'above' | 'below' | 'equal';
    interpretationLabel: string;
  }>;
  outliers: Array<{
    metricName: string;
    difference: number;
    interpretationLabel: string;
  }>;
  sampleSize: {
    subjectSessions: number;
    comparisonSessions: number;
  };
  assumptions?: string[];
};

type FreshUpNarrativeResponse = {
  narrativeType: NarrativeTypeOption;
  lengthMode: NarrativeLengthOption;
  title: string;
  narrative: string;
  interpretationLabels: string[];
  generatedAt: string;
};

type FreshUpAlertSeverity = 'positive' | 'low' | 'medium' | 'high' | 'critical';
type FreshUpAlertType =
  | 'dealer_skill_drop'
  | 'dealer_skill_improvement'
  | 'consultant_coaching_opportunity'
  | 'archetype_friction'
  | 'concern_based_friction'
  | 'engagement_drop'
  | 'version_regression'
  | 'autoforge_recommendation'
  | 'usage_drop'
  | 'outcome_breakdown_increase';

type FreshUpAlertRow = {
  alertId: string;
  alertType: FreshUpAlertType;
  entityType: string;
  entityId: string;
  entityName: string;
  severity: FreshUpAlertSeverity;
  message: string;
  recommendedAction: string;
  createdAt: string;
  isRead: boolean;
  resolved: boolean;
  environment: 'sandbox' | 'production';
};

type FreshUpRiskRow = {
  riskId: string;
  riskType: string;
  entityType: string;
  entityId: string;
  entityName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  confidenceLevel: 'low' | 'medium' | 'high';
  message: string;
  recommendedAction: string;
  supportingMetrics: Record<string, unknown>;
  createdAt: string;
  isActive: boolean;
  environment: 'sandbox' | 'production';
};

type FreshUpWeeklyDigestResponse = {
  digestType: WeeklyDigestTypeOption;
  title: string;
  weekRange: string;
  headlineSummary: string;
  keyInsights: string[];
  recommendedAction: string;
  narrative?: string;
  lengthMode: NarrativeLengthOption;
  generatedAt: string;
  sampleSize: number;
  aggregates?: {
    totalSessions: number;
    activeConsultants: number;
    activeDealers: number;
    averageConversationLength: number;
    averageUpMeterPeak: number;
    averageTrustShift: number;
    topStrength: string;
    topImprovementArea: string;
  };
};

type FreshUpCommandCenterResponse = {
  generatedAt: string;
  entityMode: 'dealer' | 'consultant' | 'platform' | 'version';
  entityId: string;
  entityName: string;
  weeklyDigestSummary: {
    headline: string;
    topInsights: string[];
    recommendedAction: string;
  };
  activeRiskRadarSummary: {
    totalActiveRisks: number;
    topRisks: Array<{
      riskId: string;
      riskType: string;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      recommendedAction: string;
    }>;
  };
  goalsAndTargetsSummary: {
    activeGoals: number;
    onTrack: number;
    atRisk: number;
    exceeded: number;
    stalled: number;
    topGoalsNeedingAttention: Array<{
      goalId: string;
      goalTitle: string;
      currentValue: number;
      targetValue: number;
      progressPercent: number;
      status: 'on_track' | 'at_risk' | 'exceeded' | 'stalled';
    }>;
  };
  activeAlertsSummary: {
    totalActiveAlerts: number;
    highSeverityAlerts: number;
    goalRelatedAlerts: number;
    versionRelatedAlerts: number;
    topAlerts: Array<{
      alertId: string;
      alertType: string;
      severity: string;
      message: string;
      recommendedAction: string;
    }>;
  };
  freshUpPerformanceSnapshot: {
    totalFreshUpSessions: number;
    averageUpMeterPeak: number;
    averageTrustShift: number;
    averageConversationLength: number;
    averageEmpathy: number;
    averageListening: number;
    averageTrust: number;
    averageFollowUp: number;
    averageClosing: number;
    averageRelationship: number;
  };
  coachingIntelligence?: {
    coachingId?: string;
    priorityLevel: 'low' | 'medium' | 'high' | 'critical';
    coachingTopic: string;
    message: string;
    supportingEvidence: string;
    recommendedPractice: string;
    suggestedAutoForgeModule: string;
  };
  coachingPrioritySummary: string;
  autoForgeRecommendationSummary: {
    module: string;
    why: string;
    action: string;
  };
  trendHighlights: Array<{ label: string; delta: number; direction: 'up' | 'down' | 'stable' }>;
  benchmarkSnapshot: {
    benchmarkType: string;
    highlights: Array<{ metricName: string; difference: number; interpretationLabel: string }>;
  };
  narrativeSummary?: {
    title: string;
    narrative: string;
    interpretationLabels: string[];
  };
  environment: 'sandbox' | 'production';
};

type StoredWeeklyDigestRecord = {
  digestId: string;
  entityType: 'dealer' | 'consultant' | 'platform';
  entityId: string;
  entityName: string;
  weekStart: string;
  weekEnd: string;
  headline: string;
  keyInsights: string[];
  recommendedAction: string;
  narrativeSummary?: string;
  environment: 'sandbox' | 'production';
};

function TrendIcon({ trend }: { trend: TrendDirection }) {
  if (trend === 'up') return <ArrowUp className="h-4 w-4 text-emerald-600" aria-hidden="true" />;
  if (trend === 'down') return <ArrowDown className="h-4 w-4 text-red-600" aria-hidden="true" />;
  return <Minus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
}

const EXPORT_TYPE_OPTIONS: Array<{ value: ExportTypeOption; label: string }> = [
  { value: 'raw_sessions', label: 'Raw Session Export' },
  { value: 'dealer_summary', label: 'Dealer Summary Export' },
  { value: 'consultant_trends', label: 'Consultant Trend Export' },
  { value: 'manager_coaching', label: 'Manager Coaching Export' },
  { value: 'autoforge_triggers', label: 'AutoForge Trigger Export' },
  { value: 'marketing_insights', label: 'Marketing Insight Export' },
  { value: 'benchmarks', label: 'Benchmark Export' },
  { value: 'weekly_digest', label: 'Weekly Digest Export' },
  { value: 'risk_radar', label: 'CX Risk Radar Export' },
  { value: 'command_center', label: 'CX Command Center Export' },
];

const EXPORT_FORMAT_OPTIONS: Array<{ value: ExportFormatOption; label: string }> = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
  { value: 'structured', label: 'Structured Report' },
];

const BENCHMARK_TYPE_OPTIONS: Array<{ value: BenchmarkTypeOption; label: string }> = [
  { value: 'consultant_vs_dealer', label: 'Consultant vs Dealer Average' },
  { value: 'dealer_vs_platform', label: 'Dealer vs Platform Average' },
  { value: 'current_vs_previous_30', label: 'Current 30 Days vs Previous 30 Days' },
  { value: 'archetype_vs_overall', label: 'Archetype Performance vs Overall' },
  { value: 'concern_vs_overall', label: 'Concern-Based Performance vs Overall' },
  { value: 'version_vs_previous_version', label: 'Version Performance vs Previous Version' },
  { value: 'team_segment_vs_other_segments', label: 'Team Segment vs Other Team Segments' },
];

const BENCHMARK_METRIC_OPTIONS: Array<{ value: BenchmarkMetricOption; label: string }> = [
  { value: 'all', label: 'All Metrics' },
  { value: 'averageTrust', label: 'Average Trust' },
  { value: 'averageUpMeterPeak', label: 'Average Up Meter Peak' },
  { value: 'averageConversationLength', label: 'Average Conversation Length' },
  { value: 'appointmentSetRate', label: 'Appointment Set Rate' },
  { value: 'conversationBreakdownRate', label: 'Conversation Breakdown Rate' },
  { value: 'guardrailFlagRate', label: 'Guardrail Flag Rate' },
];

const NARRATIVE_TYPE_OPTIONS: Array<{ value: NarrativeTypeOption; label: string }> = [
  { value: 'dealer_performance', label: 'Dealer Performance Narrative' },
  { value: 'consultant_trend', label: 'Consultant Trend Narrative' },
  { value: 'manager_coaching', label: 'Manager Coaching Narrative' },
  { value: 'platform_insight', label: 'Platform Insight Narrative' },
  { value: 'archetype_insight', label: 'Archetype Insight Narrative' },
  { value: 'version_comparison', label: 'Version Comparison Narrative' },
  { value: 'marketing_insight', label: 'Marketing Insight Narrative' },
];

const NARRATIVE_LENGTH_OPTIONS: Array<{ value: NarrativeLengthOption; label: string }> = [
  { value: 'short', label: 'Short' },
  { value: 'standard', label: 'Standard' },
  { value: 'extended', label: 'Extended' },
];

const WEEKLY_DIGEST_TYPE_OPTIONS: Array<{ value: WeeklyDigestTypeOption; label: string }> = [
  { value: 'dealer_weekly', label: 'Dealer Weekly Digest' },
  { value: 'consultant_weekly', label: 'Consultant Weekly Digest' },
  { value: 'platform_weekly', label: 'Platform Weekly Digest' },
  { value: 'manager_coaching_weekly', label: 'Manager Coaching Weekly Digest' },
  { value: 'version_monitoring_weekly', label: 'Version Monitoring Weekly Digest' },
];

const COMMAND_CENTER_MODE_OPTIONS: Array<{ value: 'dealer' | 'consultant' | 'platform' | 'version'; label: string }> = [
  { value: 'platform', label: 'Platform' },
  { value: 'dealer', label: 'Dealer' },
  { value: 'consultant', label: 'Consultant' },
  { value: 'version', label: 'Version' },
];

const ALERT_SEVERITY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'positive', label: 'Positive' },
];

const ALERT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Alert Types' },
  { value: 'dealer_skill_drop', label: 'Dealer Skill Drop' },
  { value: 'dealer_skill_improvement', label: 'Dealer Skill Improvement' },
  { value: 'consultant_coaching_opportunity', label: 'Consultant Coaching Opportunity' },
  { value: 'archetype_friction', label: 'Archetype Friction' },
  { value: 'concern_based_friction', label: 'Concern-Based Friction' },
  { value: 'engagement_drop', label: 'Up Meter Engagement Drop' },
  { value: 'version_regression', label: 'Version Regression' },
  { value: 'autoforge_recommendation', label: 'AutoForge Recommendation' },
  { value: 'usage_drop', label: 'Usage Drop' },
  { value: 'outcome_breakdown_increase', label: 'Outcome Breakdown Increase' },
];

const RISK_LEVEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All Levels' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function AdminIntelligencePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const firebaseAuth = useFirebaseAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<IntelligenceResponse | null>(null);
  const [isGeneratingExport, setIsGeneratingExport] = useState(false);
  const [isGeneratingDigest, setIsGeneratingDigest] = useState(false);
  const [isGeneratingBenchmark, setIsGeneratingBenchmark] = useState(false);
  const [exportType, setExportType] = useState<ExportTypeOption>('raw_sessions');
  const [exportFormat, setExportFormat] = useState<ExportFormatOption>('csv');
  const [includeSandboxData, setIncludeSandboxData] = useState(false);
  const [benchmarkType, setBenchmarkType] = useState<BenchmarkTypeOption>('dealer_vs_platform');
  const [benchmarkMetric, setBenchmarkMetric] = useState<BenchmarkMetricOption>('all');
  const [benchmarkEntityId, setBenchmarkEntityId] = useState('');
  const [benchmarkComparisonId, setBenchmarkComparisonId] = useState('');
  const [benchmarkSegmentKey, setBenchmarkSegmentKey] = useState('');
  const [benchmarkSegmentValue, setBenchmarkSegmentValue] = useState('');
  const [benchmarkResult, setBenchmarkResult] = useState<FreshUpBenchmarkResponse | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [narrativeType, setNarrativeType] = useState<NarrativeTypeOption>('platform_insight');
  const [narrativeLength, setNarrativeLength] = useState<NarrativeLengthOption>('standard');
  const [narrativeEntityId, setNarrativeEntityId] = useState('');
  const [narrativeComparisonId, setNarrativeComparisonId] = useState('');
  const [narrativeResult, setNarrativeResult] = useState<FreshUpNarrativeResponse | null>(null);
  const [narrativeError, setNarrativeError] = useState<string | null>(null);
  const [isGeneratingNarrative, setIsGeneratingNarrative] = useState(false);
  const [weeklyDigestType, setWeeklyDigestType] = useState<WeeklyDigestTypeOption>('platform_weekly');
  const [weeklyDigestLength, setWeeklyDigestLength] = useState<NarrativeLengthOption>('standard');
  const [weeklyDigestEntityId, setWeeklyDigestEntityId] = useState('');
  const [weeklyDigestComparisonId, setWeeklyDigestComparisonId] = useState('');
  const [weeklyDigest, setWeeklyDigest] = useState<FreshUpWeeklyDigestResponse | null>(null);
  const [weeklyDigestError, setWeeklyDigestError] = useState<string | null>(null);
  const [isLoadingCommandCenter, setIsLoadingCommandCenter] = useState(false);
  const [commandCenterMode, setCommandCenterMode] = useState<'dealer' | 'consultant' | 'platform' | 'version'>('platform');
  const [commandCenterEntityId, setCommandCenterEntityId] = useState('');
  const [commandCenterComparisonId, setCommandCenterComparisonId] = useState('');
  const [commandCenterData, setCommandCenterData] = useState<FreshUpCommandCenterResponse | null>(null);
  const [commandCenterError, setCommandCenterError] = useState<string | null>(null);
  const [storedDigests, setStoredDigests] = useState<StoredWeeklyDigestRecord[]>([]);
  const [isLoadingStoredDigests, setIsLoadingStoredDigests] = useState(false);
  const [storedDigestEntityType, setStoredDigestEntityType] = useState<'dealer' | 'consultant' | 'platform'>('platform');
  const [storedDigestDealerId, setStoredDigestDealerId] = useState('');
  const [storedDigestConsultantId, setStoredDigestConsultantId] = useState('');
  const [storedDigestDateFrom, setStoredDigestDateFrom] = useState('');
  const [storedDigestDateTo, setStoredDigestDateTo] = useState('');
  const [alerts, setAlerts] = useState<FreshUpAlertRow[]>([]);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [isGeneratingAlerts, setIsGeneratingAlerts] = useState(false);
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<string>('all');
  const [alertTypeFilter, setAlertTypeFilter] = useState<string>('all');
  const [alertDealerFilter, setAlertDealerFilter] = useState('');
  const [alertConsultantFilter, setAlertConsultantFilter] = useState('');
  const [alertVersionFilter, setAlertVersionFilter] = useState('');
  const [alertDateFrom, setAlertDateFrom] = useState('');
  const [alertDateTo, setAlertDateTo] = useState('');
  const [alertReadFilter, setAlertReadFilter] = useState<string>('all');
  const [risks, setRisks] = useState<FreshUpRiskRow[]>([]);
  const [isLoadingRisks, setIsLoadingRisks] = useState(false);
  const [isGeneratingRisks, setIsGeneratingRisks] = useState(false);
  const [riskError, setRiskError] = useState<string | null>(null);
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>('all');
  const [riskTypeFilter, setRiskTypeFilter] = useState<string>('all');
  const [riskDealerFilter, setRiskDealerFilter] = useState('');
  const [riskConsultantFilter, setRiskConsultantFilter] = useState('');
  const [riskArchetypeFilter, setRiskArchetypeFilter] = useState('');
  const [riskConcernFilter, setRiskConcernFilter] = useState('');
  const [riskVersionFilter, setRiskVersionFilter] = useState('');
  const [riskDateFrom, setRiskDateFrom] = useState('');
  const [riskDateTo, setRiskDateTo] = useState('');
  const [riskActiveFilter, setRiskActiveFilter] = useState<string>('active');
  const [isSiteTrafficOpen, setIsSiteTrafficOpen] = useState(true);
  const [isFreshUpStatsOpen, setIsFreshUpStatsOpen] = useState(true);
  const [exportResult, setExportResult] = useState<FreshUpExportResponse | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    dealerId: '',
    userId: '',
    freshUpVersionId: '',
    environment: '',
    sourceType: '',
    difficultyLevel: '',
    archetypeCategory: '',
    primaryConcern: '',
    buyingStage: '',
    personalityType: '',
    outcomeTag: '',
    coachingTag: '',
    isSandbox: 'any',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }
    if (!loading && user && user.role !== 'Admin' && user.role !== 'Developer') {
      router.push('/');
    }
  }, [loading, user, router]);

  async function loadIntelligence() {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer')) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const token = await fbUser.getIdToken(true);
      const response = await fetch('/api/admin/fresh-up-intelligence', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load Fresh Up intelligence dashboard.');
      }
      setData(payload as IntelligenceResponse);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load Fresh Up intelligence dashboard.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function generateExport() {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer')) return;
    setIsGeneratingExport(true);
    setExportError(null);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required. Please sign in again.');
      }
      const token = await fbUser.getIdToken(true);
      const response = await fetch('/api/admin/fresh-up-exports', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exportType,
          format: exportFormat,
          includeBenchmarks: true,
          includeNarratives: true,
          benchmarkRequest: {
            benchmarkType,
            metricName: benchmarkMetric,
            entityId: benchmarkEntityId || undefined,
            comparisonEntityId: benchmarkComparisonId || undefined,
            segmentKey: benchmarkSegmentKey || undefined,
            segmentValue: benchmarkSegmentValue || undefined,
          },
          narrativeRequest: {
            narrativeType,
            lengthMode: narrativeLength,
          },
          digestRequest: {
            digestType: weeklyDigestType,
            lengthMode: weeklyDigestLength,
            entityId: weeklyDigestEntityId || undefined,
            comparisonEntityId: weeklyDigestComparisonId || undefined,
          },
          filters: {
            ...filters,
            isSandbox: filters.isSandbox === 'true' ? true : (filters.isSandbox === 'false' ? false : undefined),
            includeSandboxData,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to generate export.');
      }
      setExportResult(payload as FreshUpExportResponse);
    } catch (generateError) {
      const message = generateError instanceof Error ? generateError.message : 'Failed to generate export.';
      setExportError(message);
    } finally {
      setIsGeneratingExport(false);
    }
  }

  async function generateBenchmark() {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer')) return;
    setIsGeneratingBenchmark(true);
    setBenchmarkError(null);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required. Please sign in again.');
      }
      const token = await fbUser.getIdToken(true);
      const response = await fetch('/api/admin/fresh-up-benchmarks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          benchmarkType,
          entityId: benchmarkEntityId || undefined,
          comparisonEntityId: benchmarkComparisonId || undefined,
          metricName: benchmarkMetric,
          segmentKey: benchmarkSegmentKey || undefined,
          segmentValue: benchmarkSegmentValue || undefined,
          filters: {
            ...filters,
            isSandbox: filters.isSandbox === 'true' ? true : (filters.isSandbox === 'false' ? false : undefined),
            includeSandboxData,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to generate benchmark.');
      }
      setBenchmarkResult(payload as FreshUpBenchmarkResponse);
    } catch (benchError) {
      const message = benchError instanceof Error ? benchError.message : 'Failed to generate benchmark.';
      setBenchmarkError(message);
    } finally {
      setIsGeneratingBenchmark(false);
    }
  }

  async function generateNarrative() {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer')) return;
    setIsGeneratingNarrative(true);
    setNarrativeError(null);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required. Please sign in again.');
      }
      const token = await fbUser.getIdToken(true);
      const response = await fetch('/api/admin/fresh-up-narratives', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          narrativeType,
          lengthMode: narrativeLength,
          entityId: narrativeEntityId || undefined,
          comparisonEntityId: narrativeComparisonId || undefined,
          filters: {
            ...filters,
            isSandbox: filters.isSandbox === 'true' ? true : (filters.isSandbox === 'false' ? false : undefined),
            includeSandboxData,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to generate narrative.');
      }
      setNarrativeResult(payload as FreshUpNarrativeResponse);
    } catch (nError) {
      const message = nError instanceof Error ? nError.message : 'Failed to generate narrative.';
      setNarrativeError(message);
    } finally {
      setIsGeneratingNarrative(false);
    }
  }

  async function generateWeeklyDigest() {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer' && user.role !== 'manager')) return;
    setIsGeneratingDigest(true);
    setWeeklyDigestError(null);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required. Please sign in again.');
      }
      const token = await fbUser.getIdToken(true);
      const response = await fetch('/api/admin/fresh-up-weekly-digest', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          digestType: weeklyDigestType,
          lengthMode: weeklyDigestLength,
          entityId: weeklyDigestEntityId || undefined,
          comparisonEntityId: weeklyDigestComparisonId || undefined,
          filters: {
            ...filters,
            isSandbox: filters.isSandbox === 'true' ? true : (filters.isSandbox === 'false' ? false : undefined),
            includeSandboxData,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to generate weekly digest.');
      }
      setWeeklyDigest(payload as FreshUpWeeklyDigestResponse);
    } catch (dError) {
      const message = dError instanceof Error ? dError.message : 'Failed to generate weekly digest.';
      setWeeklyDigestError(message);
    } finally {
      setIsGeneratingDigest(false);
    }
  }

  async function loadCommandCenter() {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer')) return;
    setIsLoadingCommandCenter(true);
    setCommandCenterError(null);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) throw new Error('Authentication required. Please sign in again.');
      const token = await fbUser.getIdToken(true);
      const response = await fetch('/api/admin/fresh-up-command-center', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entityMode: commandCenterMode,
          entityId: commandCenterEntityId || undefined,
          comparisonEntityId: commandCenterComparisonId || undefined,
          filters: {
            ...filters,
            isSandbox: filters.isSandbox === 'true' ? true : (filters.isSandbox === 'false' ? false : undefined),
            includeSandboxData,
          },
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Failed to load CX Command Center.');
      setCommandCenterData(payload as FreshUpCommandCenterResponse);
    } catch (ccError) {
      const message = ccError instanceof Error ? ccError.message : 'Failed to load CX Command Center.';
      setCommandCenterError(message);
    } finally {
      setIsLoadingCommandCenter(false);
    }
  }

  async function loadStoredWeeklyDigests() {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer')) return;
    setIsLoadingStoredDigests(true);
    setWeeklyDigestError(null);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required. Please sign in again.');
      }
      const token = await fbUser.getIdToken(true);
      const params = new URLSearchParams();
      params.set('entityType', storedDigestEntityType);
      const resolvedEntityId = storedDigestEntityType === 'dealer'
        ? storedDigestDealerId.trim()
        : (storedDigestEntityType === 'consultant' ? storedDigestConsultantId.trim() : '');
      if (resolvedEntityId.length > 0) params.set('entityId', resolvedEntityId);
      if (storedDigestDateFrom) params.set('dateFrom', storedDigestDateFrom);
      if (storedDigestDateTo) params.set('dateTo', storedDigestDateTo);
      params.set('limit', '50');
      if (includeSandboxData) params.set('includeSandboxData', 'true');

      const response = await fetch(`/api/admin/fresh-up-weekly-digest?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load stored weekly digests.');
      }
      setStoredDigests(Array.isArray(payload?.records) ? payload.records as StoredWeeklyDigestRecord[] : []);
    } catch (sError) {
      const message = sError instanceof Error ? sError.message : 'Failed to load stored weekly digests.';
      setWeeklyDigestError(message);
      setStoredDigests([]);
    } finally {
      setIsLoadingStoredDigests(false);
    }
  }

  async function loadAlerts() {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer')) return;
    setIsLoadingAlerts(true);
    setAlertsError(null);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required. Please sign in again.');
      }
      const token = await fbUser.getIdToken(true);
      const params = new URLSearchParams();
      params.set('environment', includeSandboxData ? 'sandbox' : 'production');
      if (alertSeverityFilter !== 'all') params.set('severity', alertSeverityFilter);
      if (alertTypeFilter !== 'all') params.set('alertType', alertTypeFilter);
      if (alertDealerFilter.trim().length > 0) params.set('dealerId', alertDealerFilter.trim());
      if (alertConsultantFilter.trim().length > 0) params.set('consultantId', alertConsultantFilter.trim());
      if (alertVersionFilter.trim().length > 0) params.set('version', alertVersionFilter.trim());
      if (alertDateFrom) params.set('dateFrom', alertDateFrom);
      if (alertDateTo) params.set('dateTo', alertDateTo);
      if (alertReadFilter === 'read') params.set('isRead', 'true');
      if (alertReadFilter === 'unread') params.set('isRead', 'false');

      const response = await fetch(`/api/admin/fresh-up-alerts?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load alerts.');
      }
      setAlerts((payload.alerts || []) as FreshUpAlertRow[]);
    } catch (aError) {
      const message = aError instanceof Error ? aError.message : 'Failed to load alerts.';
      setAlertsError(message);
    } finally {
      setIsLoadingAlerts(false);
    }
  }

  async function generateAlerts() {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer')) return;
    setIsGeneratingAlerts(true);
    setAlertsError(null);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required. Please sign in again.');
      }
      const token = await fbUser.getIdToken(true);
      const response = await fetch('/api/admin/fresh-up-alerts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          includeSandboxData,
          environment: includeSandboxData ? 'sandbox' : 'production',
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to generate alerts.');
      }
      await loadAlerts();
    } catch (gError) {
      const message = gError instanceof Error ? gError.message : 'Failed to generate alerts.';
      setAlertsError(message);
    } finally {
      setIsGeneratingAlerts(false);
    }
  }

  async function loadRisks() {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer')) return;
    setIsLoadingRisks(true);
    setRiskError(null);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required. Please sign in again.');
      }
      const token = await fbUser.getIdToken(true);
      const params = new URLSearchParams();
      params.set('environment', includeSandboxData ? 'sandbox' : 'production');
      if (riskLevelFilter !== 'all') params.set('riskLevel', riskLevelFilter);
      if (riskTypeFilter !== 'all') params.set('riskType', riskTypeFilter);
      if (riskDealerFilter.trim().length > 0) params.set('dealer', riskDealerFilter.trim());
      if (riskConsultantFilter.trim().length > 0) params.set('consultant', riskConsultantFilter.trim());
      if (riskArchetypeFilter.trim().length > 0) params.set('archetype', riskArchetypeFilter.trim());
      if (riskConcernFilter.trim().length > 0) params.set('concern', riskConcernFilter.trim());
      if (riskVersionFilter.trim().length > 0) params.set('version', riskVersionFilter.trim());
      if (riskDateFrom) params.set('dateFrom', riskDateFrom);
      if (riskDateTo) params.set('dateTo', riskDateTo);
      if (riskActiveFilter === 'active') params.set('isActive', 'true');
      if (riskActiveFilter === 'resolved') params.set('isActive', 'false');

      const response = await fetch(`/api/admin/fresh-up-risk-radar?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to load risk radar.');
      }
      setRisks((payload.risks || []) as FreshUpRiskRow[]);
    } catch (rError) {
      const message = rError instanceof Error ? rError.message : 'Failed to load risk radar.';
      setRiskError(message);
    } finally {
      setIsLoadingRisks(false);
    }
  }

  async function generateRisks() {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer')) return;
    setIsGeneratingRisks(true);
    setRiskError(null);
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) {
        throw new Error('Authentication required. Please sign in again.');
      }
      const token = await fbUser.getIdToken(true);
      const response = await fetch('/api/admin/fresh-up-risk-radar', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          includeSandboxData,
          environment: includeSandboxData ? 'sandbox' : 'production',
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || 'Failed to generate risk radar.');
      }
      await loadRisks();
    } catch (rError) {
      const message = rError instanceof Error ? rError.message : 'Failed to generate risk radar.';
      setRiskError(message);
    } finally {
      setIsGeneratingRisks(false);
    }
  }

  async function markAlertRead(alertId: string) {
    if (!user || (user.role !== 'Admin' && user.role !== 'Developer')) return;
    try {
      const fbUser = firebaseAuth.currentUser;
      if (!fbUser) return;
      const token = await fbUser.getIdToken(true);
      await fetch('/api/admin/fresh-up-alerts', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alertId,
          isRead: true,
        }),
      });
      setAlerts((prev) => prev.map((alert) => alert.alertId === alertId ? { ...alert, isRead: true } : alert));
    } catch {
      // best effort
    }
  }

  function downloadExport() {
    if (!exportResult) return;
    const blob = new Blob([exportResult.content], { type: exportResult.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportResult.fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    void loadIntelligence();
  }, [user?.userId, user?.role]);

  useEffect(() => {
    void loadAlerts();
  }, [
    user?.userId,
    user?.role,
    includeSandboxData,
    alertSeverityFilter,
    alertTypeFilter,
    alertDealerFilter,
    alertConsultantFilter,
    alertVersionFilter,
    alertDateFrom,
    alertDateTo,
    alertReadFilter,
  ]);

  useEffect(() => {
    void loadStoredWeeklyDigests();
  }, [user?.userId, user?.role, includeSandboxData]);

  useEffect(() => {
    void loadCommandCenter();
  }, [user?.userId, user?.role, includeSandboxData]);

  useEffect(() => {
    void loadRisks();
  }, [
    user?.userId,
    user?.role,
    includeSandboxData,
    riskLevelFilter,
    riskTypeFilter,
    riskDealerFilter,
    riskConsultantFilter,
    riskArchetypeFilter,
    riskConcernFilter,
    riskVersionFilter,
    riskDateFrom,
    riskDateTo,
    riskActiveFilter,
  ]);

  const generatedAtText = useMemo(() => {
    if (!data?.generatedAt) return null;
    const parsed = new Date(data.generatedAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleString();
  }, [data?.generatedAt]);

  if (loading || !user || user.role !== 'Admin' && user.role !== 'Developer') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <Header />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Fresh Up Intelligence Dashboard</CardTitle>
            <CardDescription>
              Platform-level behavioral insight from the last 30 days of Fresh Up activity. Aggregate-only, no transcript exposure.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {generatedAtText ? `Last refreshed: ${generatedAtText}` : 'Fresh data snapshot'}
            </div>
            <Button type="button" variant="outline" onClick={() => void loadIntelligence()}>
              Refresh
            </Button>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <Card className="border-red-500/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <ShieldAlert className="h-5 w-5" />
                Dashboard unavailable
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </Card>
        ) : data ? (
          <>
            <Collapsible open={isSiteTrafficOpen} onOpenChange={setIsSiteTrafficOpen}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle>Site Traffic</CardTitle>
                    <CardDescription>
                      Live pageview tracking plus downstream product activity from tools, leads, Sprocket, and marketing events.
                    </CardDescription>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm">
                      <ChevronDown className={`h-4 w-4 transition-transform ${isSiteTrafficOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                      {[
                        { label: 'Raw Pageviews (7d)', value: data.siteTraffic.windows.last7Days.pageViews, trend: data.siteTraffic.windows.last7Days.trend },
                        { label: 'Raw Pageviews (30d)', value: data.siteTraffic.windows.last30Days.pageViews, trend: data.siteTraffic.windows.last30Days.trend },
                        { label: 'Unique Page Sessions (30d)', value: data.siteTraffic.windows.last30Days.uniquePageSessions, trend: 'stable' as TrendDirection },
                        { label: 'Visitors (30d)', value: data.siteTraffic.windows.last30Days.uniqueVisitors, trend: 'stable' as TrendDirection },
                        { label: 'Sessions (30d)', value: data.siteTraffic.windows.last30Days.uniqueSessions, trend: 'stable' as TrendDirection },
                        { label: 'Authed Visitors (30d)', value: data.siteTraffic.conversions30Days.authenticatedVisitors, trend: 'stable' as TrendDirection },
                      ].map((item) => (
                        <Card key={item.label}>
                          <CardHeader className="pb-2">
                            <CardDescription>{item.label}</CardDescription>
                            <CardTitle className="text-3xl">{item.value}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <TrendIcon trend={item.trend} />
                              <span>{item.trend === 'stable' ? 'Stable' : item.trend === 'up' ? 'Increasing' : 'Decreasing'}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>Traffic to Conversion Signals</CardTitle>
                          <CardDescription>30-day captured activity across the site and product surfaces. Raw pageviews include reloads; unique page sessions dedupe repeat hits on the same route within a session.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {[
                            { label: 'Raw Pageviews', value: data.siteTraffic.conversions30Days.pageViews },
                            { label: 'Unique Page Sessions', value: data.siteTraffic.windows.last30Days.uniquePageSessions },
                            { label: 'Unique Visitors', value: data.siteTraffic.conversions30Days.uniqueVisitors },
                            { label: 'Tool Opens', value: data.siteTraffic.conversions30Days.toolOpens },
                            { label: 'Marketing Events', value: data.siteTraffic.conversions30Days.marketingEvents },
                            { label: 'Sprocket Sessions', value: data.siteTraffic.conversions30Days.sprocketSessions },
                            { label: 'AutoForge Leads', value: data.siteTraffic.conversions30Days.autoforgeLeads },
                          ].map((row) => {
                            const base = Math.max(1, data.siteTraffic.windows.last30Days.uniquePageSessions);
                            const progress = Math.min(100, Math.round((row.value / base) * 100));
                            return (
                              <div key={row.label} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium">{row.label}</span>
                                  <span className="text-muted-foreground">{row.value}</span>
                                </div>
                                <Progress value={progress} />
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>14-Day Traffic Timeline</CardTitle>
                          <CardDescription>Recent pageviews and unique visitors by day.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {data.siteTraffic.timeline.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No site traffic captured yet.</p>
                          ) : (
                            data.siteTraffic.timeline.map((row) => {
                              const base = Math.max(1, data.siteTraffic.windows.last30Days.pageViews);
                              const progress = Math.min(100, Math.round((row.pageViews / base) * 100));
                              return (
                                <div key={row.date} className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span>{new Date(`${row.date}T00:00:00`).toLocaleDateString()}</span>
                                    <span className="text-muted-foreground">{row.pageViews} views • {row.uniqueVisitors} visitors</span>
                                  </div>
                                  <Progress value={progress} />
                                </div>
                              );
                            })
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>Top Pages</CardTitle>
                          <CardDescription>Most visited routes in the last 30 days.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {data.siteTraffic.topPages.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No pageview data yet.</p>
                          ) : (
                            data.siteTraffic.topPages.map((row) => (
                              <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{row.label}</p>
                                  <p className="text-muted-foreground">{row.uniqueSessions} sessions</p>
                                </div>
                                <Badge variant="secondary">{row.count} views</Badge>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Landing Pages</CardTitle>
                          <CardDescription>Where sessions most often begin.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {data.siteTraffic.landingPages.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No landing-page data yet.</p>
                          ) : (
                            data.siteTraffic.landingPages.map((row) => (
                              <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                                <span className="truncate font-medium">{row.label}</span>
                                <Badge variant="secondary">{row.count} landings</Badge>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>Top Referrers and Campaigns</CardTitle>
                          <CardDescription>External traffic sources and tagged campaigns in the last 30 days.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Referrers</p>
                            {data.siteTraffic.topReferrers.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No referrer data yet.</p>
                            ) : (
                              data.siteTraffic.topReferrers.map((row) => (
                                <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                                  <span className="truncate font-medium">{row.label}</span>
                                  <Badge variant="outline">{row.count}</Badge>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Campaigns</p>
                            {data.siteTraffic.topCampaigns.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No tagged campaigns yet.</p>
                            ) : (
                              data.siteTraffic.topCampaigns.map((row) => (
                                <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                                  <span className="truncate font-medium">{row.label}</span>
                                  <Badge variant="outline">{row.count}</Badge>
                                </div>
                              ))
                            )}
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Where They Came From</CardTitle>
                          <CardDescription>Prior page in-session, or external referrer when the session began.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {data.siteTraffic.fromPages.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No origin-path data yet.</p>
                          ) : (
                            data.siteTraffic.fromPages.map((row) => (
                              <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                                <span className="truncate font-medium">{row.label}</span>
                                <Badge variant="outline">{row.count}</Badge>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>Device Breakdown</CardTitle>
                          <CardDescription>Captured traffic split by device type.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {data.siteTraffic.deviceBreakdown.map((row) => (
                            <div key={row.label} className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium capitalize">{row.label}</span>
                                <span className="text-muted-foreground">{row.count}</span>
                              </div>
                              <Progress value={Math.min(100, Math.round((row.count / Math.max(1, data.siteTraffic.windows.last30Days.pageViews)) * 100))} />
                            </div>
                          ))}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Approximate Location from IP</CardTitle>
                          <CardDescription>Coarse geolocation based on request IP headers. Good for region-level patterns, not exact physical location.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Countries</p>
                            {data.siteTraffic.geo.topCountries.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No country data yet.</p>
                            ) : (
                              data.siteTraffic.geo.topCountries.map((row) => (
                                <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                                  <span className="truncate font-medium">{row.label}</span>
                                  <Badge variant="outline">{row.count}</Badge>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Regions</p>
                            {data.siteTraffic.geo.topRegions.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No region data yet.</p>
                            ) : (
                              data.siteTraffic.geo.topRegions.map((row) => (
                                <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                                  <span className="truncate font-medium">{row.label}</span>
                                  <Badge variant="outline">{row.count}</Badge>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Cities</p>
                            {data.siteTraffic.geo.topCities.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No city data yet.</p>
                            ) : (
                              data.siteTraffic.geo.topCities.map((row) => (
                                <div key={row.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                                  <span className="truncate font-medium">{row.label}</span>
                                  <Badge variant="outline">{row.count}</Badge>
                                </div>
                              ))
                            )}
                          </div>
                          <div className="md:col-span-3 rounded-lg border p-3 text-sm">
                            <p className="font-medium">Geographic Center</p>
                            {data.siteTraffic.geo.geoCenter ? (
                              <p className="mt-1 text-muted-foreground">
                                Approximate center at {data.siteTraffic.geo.geoCenter.latitude}, {data.siteTraffic.geo.geoCenter.longitude} from {data.siteTraffic.geo.geoCenter.sampleSize} geo-tagged visits.
                              </p>
                            ) : (
                              <p className="mt-1 text-muted-foreground">No latitude/longitude data captured yet.</p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>Surface Breakdown</CardTitle>
                          <CardDescription>Where traffic is concentrating across top-level app surfaces.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {data.siteTraffic.surfaceBreakdown.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No surface data yet.</p>
                          ) : (
                            data.siteTraffic.surfaceBreakdown.map((row) => (
                              <div key={row.label} className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="font-medium">{row.label}</span>
                                  <span className="text-muted-foreground">{row.count}</span>
                                </div>
                                <Progress value={Math.min(100, Math.round((row.count / Math.max(1, data.siteTraffic.windows.last30Days.pageViews)) * 100))} />
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Where They Went Next</CardTitle>
                          <CardDescription>Most common page-to-page transitions inside a session.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {data.siteTraffic.topNextSteps.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No transition-flow data yet.</p>
                          ) : (
                            data.siteTraffic.topNextSteps.map((row) => (
                              <div key={`${row.from}-${row.to}`} className="rounded-lg border p-3 text-sm">
                                <p className="font-medium">{row.from}</p>
                                <p className="text-muted-foreground">to {row.to}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{row.count} transitions</p>
                              </div>
                            ))
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            <Collapsible open={isFreshUpStatsOpen} onOpenChange={setIsFreshUpStatsOpen}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <div>
                    <CardTitle>Fresh Up Stats</CardTitle>
                    <CardDescription>
                      Platform-wide Fresh Up usage, performance, dealer comparisons, outcomes, training gaps, and scenario trends.
                    </CardDescription>
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" size="sm">
                      <ChevronDown className={`h-4 w-4 transition-transform ${isFreshUpStatsOpen ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-6">
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      {[
                        { label: 'Sessions (7d)', value: data.windows.usage.last7Days.sessions, trend: data.windows.usage.last7Days.trend },
                        { label: 'Sessions (30d)', value: data.windows.usage.last30Days.sessions, trend: data.windows.usage.last30Days.trend },
                        { label: 'Sessions (90d)', value: data.windows.usage.last90Days.sessions, trend: data.windows.usage.last90Days.trend },
                        { label: 'Active Dealers (30d)', value: data.windows.usage.activeDealers, trend: 'stable' as TrendDirection },
                        { label: 'Active Consultants (30d)', value: data.windows.usage.activeConsultants, trend: 'stable' as TrendDirection },
                      ].map((item) => (
                        <Card key={item.label}>
                          <CardHeader className="pb-2">
                            <CardDescription>{item.label}</CardDescription>
                            <CardTitle className="text-3xl">{item.value}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <TrendIcon trend={item.trend} />
                              <span>{item.trend === 'stable' ? 'Stable' : item.trend === 'up' ? 'Increasing' : 'Decreasing'}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </section>

                    <section className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Skill Trend Analysis</CardTitle>
                  <CardDescription>Platform averages compared with the prior 30-day period.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: 'Empathy', value: data.skillTrends.empathy },
                    { label: 'Listening', value: data.skillTrends.listening },
                    { label: 'Trust Building', value: data.skillTrends.trust },
                    { label: 'Relationship Building', value: data.skillTrends.relationship },
                    { label: 'Closing Ability', value: data.skillTrends.closing },
                  ].map((row) => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{row.label}</span>
                        <span className="flex items-center gap-1">
                          <TrendIcon trend={row.value.trend} />
                          {row.value.score}
                        </span>
                      </div>
                      <Progress value={row.value.score} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Up Meter Engagement Analysis</CardTitle>
                  <CardDescription>Average peak customer engagement across all Fresh Up sessions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-4xl font-semibold">{data.engagement.averageUpMeterPeak}</div>
                  <Progress value={data.engagement.averageUpMeterPeak} className="h-2" />
                  <p className="text-sm text-muted-foreground">{data.engagement.label}</p>
                  <div className="pt-3">
                    <p className="text-sm">
                      <span className="font-medium">Total Fresh Up Sessions (30d): </span>
                      {data.sessionActivity.totalFreshUpSessions30Days}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Average Conversation Length: </span>
                      {data.sessionActivity.averageConversationLength}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Dealer Performance Comparison</CardTitle>
                  <CardDescription>Top dealers by trust score, engagement, and Fresh Up participation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.dealerComparison.topPerformingDealers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No dealer-level data in the last 30 days.</p>
                  ) : (
                    data.dealerComparison.topPerformingDealers.map((dealer) => (
                      <div key={`top-${dealer.dealerId}`} className="rounded-md border p-3">
                        <p className="font-medium">{dealer.dealerName}</p>
                        <p className="text-sm text-muted-foreground">
                          Trust {dealer.avgTrust} • Up Meter Peak {dealer.avgUpMeterPeak} • Participation {dealer.participationRate}% • Sessions {dealer.sessions}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Dealers Needing Improvement</CardTitle>
                  <CardDescription>Criteria: average trust below 50 or average Up Meter peak below 45.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.dealerComparison.dealersNeedingImprovement.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No dealers currently flagging this threshold.</p>
                  ) : (
                    data.dealerComparison.dealersNeedingImprovement.map((dealer) => (
                      <div key={`watch-${dealer.dealerId}`} className="rounded-md border border-amber-500/30 p-3">
                        <p className="font-medium">{dealer.dealerName}</p>
                        <p className="text-sm text-muted-foreground">
                          Trust {dealer.avgTrust} • Up Meter Peak {dealer.avgUpMeterPeak} • Participation {dealer.participationRate}% • Sessions {dealer.sessions}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Conversation Outcomes</CardTitle>
                  <CardDescription>Distribution of Fresh Up outcomes across the platform (last 30 days).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.outcomes.map((outcome) => (
                    <div key={outcome.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{outcome.label}</span>
                        <span>{outcome.percentage}% ({outcome.count})</span>
                      </div>
                      <Progress value={outcome.percentage} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Training Opportunity Insights</CardTitle>
                  <CardDescription>Skills averaging below 55 are flagged for intervention.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.trainingOpportunities.primaryInsight ? (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                      <p className="font-semibold">Platform Insight</p>
                      <p className="text-sm">
                        {data.trainingOpportunities.primaryInsight.skill} is the lowest scoring skill across all dealers ({data.trainingOpportunities.primaryInsight.score}).
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Suggested AutoForge Module: {data.trainingOpportunities.primaryInsight.suggestedModule}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No platform-wide critical skill gaps detected this period.</p>
                  )}

                  {data.trainingOpportunities.flagged.length > 0 && (
                    <div className="space-y-2">
                      {data.trainingOpportunities.flagged.map((row) => (
                        <div key={row.skill} className="flex items-center justify-between rounded-md border p-2 text-sm">
                          <span>{row.skill} ({row.score})</span>
                          <Badge variant="secondary">{row.module}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Scenarios</CardTitle>
                  <CardDescription>Best scenario performance by skill score, engagement, and completion rate.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.scenarioPerformance.topPerformingScenarios.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No scenario data in the last 30 days.</p>
                  ) : (
                    data.scenarioPerformance.topPerformingScenarios.map((scenario) => (
                      <div key={`top-scenario-${scenario.scenarioId}`} className="rounded-md border p-3">
                        <p className="font-medium">{scenario.scenarioName}</p>
                        <p className="text-sm text-muted-foreground">
                          Avg Skill {scenario.avgSkillScore} • Up Meter Peak {scenario.avgUpMeterPeak} • Completion {scenario.completionRate}% • Sessions {scenario.sessions}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lowest Performing Scenarios</CardTitle>
                  <CardDescription>Scenarios where support content may need reinforcement.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.scenarioPerformance.lowestPerformingScenarios.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No scenario data in the last 30 days.</p>
                  ) : (
                    data.scenarioPerformance.lowestPerformingScenarios.map((scenario) => (
                      <div key={`low-scenario-${scenario.scenarioId}`} className="rounded-md border border-amber-500/30 p-3">
                        <p className="font-medium">{scenario.scenarioName}</p>
                        <p className="text-sm text-muted-foreground">
                          Avg Skill {scenario.avgSkillScore} • Up Meter Peak {scenario.avgUpMeterPeak} • Completion {scenario.completionRate}% • Sessions {scenario.sessions}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </section>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Fresh Up Alerts</CardTitle>
                  <CardDescription>
                    Proactive alerting for dealer and consultant risk, coaching opportunities, version regressions, and adoption changes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="space-y-2">
                      <Label>Severity</Label>
                      <Select value={alertSeverityFilter} onValueChange={setAlertSeverityFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ALERT_SEVERITY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Alert Type</Label>
                      <Select value={alertTypeFilter} onValueChange={setAlertTypeFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ALERT_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Dealer</Label>
                      <Input value={alertDealerFilter} onChange={(event) => setAlertDealerFilter(event.target.value)} placeholder="Dealer ID" />
                    </div>
                    <div className="space-y-2">
                      <Label>Consultant</Label>
                      <Input value={alertConsultantFilter} onChange={(event) => setAlertConsultantFilter(event.target.value)} placeholder="Consultant ID" />
                    </div>
                    <div className="space-y-2">
                      <Label>Version</Label>
                      <Input value={alertVersionFilter} onChange={(event) => setAlertVersionFilter(event.target.value)} placeholder="Version ID" />
                    </div>
                    <div className="space-y-2">
                      <Label>Date From</Label>
                      <Input type="date" value={alertDateFrom} onChange={(event) => setAlertDateFrom(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date To</Label>
                      <Input type="date" value={alertDateTo} onChange={(event) => setAlertDateTo(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Read State</Label>
                      <Select value={alertReadFilter} onValueChange={setAlertReadFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="unread">Unread</SelectItem>
                          <SelectItem value="read">Read</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={() => void loadAlerts()} disabled={isLoadingAlerts}>
                      {isLoadingAlerts ? 'Refreshing Alerts...' : 'Refresh Alerts'}
                    </Button>
                    <Button type="button" onClick={() => void generateAlerts()} disabled={isGeneratingAlerts}>
                      {isGeneratingAlerts ? 'Generating Alerts...' : 'Generate Alerts'}
                    </Button>
                  </div>

                  {alertsError && (
                    <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700">
                      {alertsError}
                    </div>
                  )}

                  <div className="space-y-3">
                    {alerts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No active alerts for this filter set.</p>
                    ) : (
                      alerts.map((alert) => (
                        <div key={alert.alertId} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={alert.severity === 'critical' || alert.severity === 'high' ? 'destructive' : (alert.severity === 'positive' ? 'default' : 'secondary')}>
                              {alert.severity}
                            </Badge>
                            <Badge variant="outline">{alert.alertType}</Badge>
                            <span className="text-xs text-muted-foreground">{alert.entityType}: {alert.entityName || alert.entityId}</span>
                            <span className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="mt-2 text-sm">{alert.message}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Recommended Action: {alert.recommendedAction}</p>
                          {!alert.isRead && (
                            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => void markAlertRead(alert.alertId)}>
                              Mark Read
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section>
              <Card>
                <CardHeader>
                  <CardTitle>CX Command Center</CardTitle>
                  <CardDescription>
                    Single leadership briefing view for weekly digest, risk radar, goals, alerts, performance, coaching priority, AutoForge next step, trend highlights, and benchmarks.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Entity Mode</Label>
                      <Select value={commandCenterMode} onValueChange={(value) => setCommandCenterMode(value as 'dealer' | 'consultant' | 'platform' | 'version')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COMMAND_CENTER_MODE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Entity ID</Label>
                      <Input value={commandCenterEntityId} onChange={(event) => setCommandCenterEntityId(event.target.value)} placeholder="Dealer/user/version ID (optional)" />
                    </div>
                    <div className="space-y-2">
                      <Label>Comparison ID</Label>
                      <Input value={commandCenterComparisonId} onChange={(event) => setCommandCenterComparisonId(event.target.value)} placeholder="Optional comparison ID" />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" className="w-full" onClick={() => void loadCommandCenter()} disabled={isLoadingCommandCenter}>
                        {isLoadingCommandCenter ? 'Loading...' : 'Refresh Command Center'}
                      </Button>
                    </div>
                  </div>
                  {commandCenterError && (
                    <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700">
                      {commandCenterError}
                    </div>
                  )}
                  {commandCenterData && (
                    <div className="space-y-4 rounded-md border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{commandCenterData.entityMode}</Badge>
                        <Badge variant="secondary">{commandCenterData.entityName}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(commandCenterData.generatedAt).toLocaleString()}</span>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-2">
                        <div className="rounded-md border p-3">
                          <p className="text-xs font-semibold">Weekly Digest Summary</p>
                          <p className="mt-1 text-sm">{commandCenterData.weeklyDigestSummary.headline}</p>
                          {commandCenterData.weeklyDigestSummary.topInsights.slice(0, 3).map((line, idx) => (
                            <p key={`w-${idx}`} className="mt-1 text-xs text-muted-foreground">• {line}</p>
                          ))}
                          <p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Action:</span> {commandCenterData.weeklyDigestSummary.recommendedAction}</p>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs font-semibold">Coaching Intelligence</p>
                          {commandCenterData.coachingIntelligence ? (
                            <>
                              <p className="mt-1 text-sm text-muted-foreground">{commandCenterData.coachingIntelligence.message}</p>
                              <p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Supporting Evidence:</span> {commandCenterData.coachingIntelligence.supportingEvidence}</p>
                              <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Recommended Practice:</span> {commandCenterData.coachingIntelligence.recommendedPractice}</p>
                              <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-foreground">AutoForge:</span> {commandCenterData.coachingIntelligence.suggestedAutoForgeModule}</p>
                            </>
                          ) : (
                            <>
                              <p className="mt-1 text-sm text-muted-foreground">{commandCenterData.coachingPrioritySummary}</p>
                              <p className="mt-2 text-xs text-muted-foreground"><span className="font-semibold text-foreground">AutoForge:</span> {commandCenterData.autoForgeRecommendationSummary.module}</p>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-3">
                        <div className="rounded-md border p-3">
                          <p className="text-xs font-semibold">Active Risk Radar</p>
                          <p className="text-xs text-muted-foreground mt-1">Total active risks: {commandCenterData.activeRiskRadarSummary.totalActiveRisks}</p>
                          {commandCenterData.activeRiskRadarSummary.topRisks.slice(0, 3).map((risk) => (
                            <p key={risk.riskId} className="mt-1 text-xs text-muted-foreground">• {risk.riskType.replace(/_/g, ' ')} ({risk.riskLevel})</p>
                          ))}
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs font-semibold">Goals Summary</p>
                          <p className="text-xs text-muted-foreground mt-1">Active: {commandCenterData.goalsAndTargetsSummary.activeGoals}</p>
                          <p className="text-xs text-muted-foreground">On Track: {commandCenterData.goalsAndTargetsSummary.onTrack} • At Risk: {commandCenterData.goalsAndTargetsSummary.atRisk}</p>
                          <p className="text-xs text-muted-foreground">Exceeded: {commandCenterData.goalsAndTargetsSummary.exceeded} • Stalled: {commandCenterData.goalsAndTargetsSummary.stalled}</p>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs font-semibold">Active Alerts</p>
                          <p className="text-xs text-muted-foreground mt-1">Total: {commandCenterData.activeAlertsSummary.totalActiveAlerts}</p>
                          <p className="text-xs text-muted-foreground">High: {commandCenterData.activeAlertsSummary.highSeverityAlerts} • Goal: {commandCenterData.activeAlertsSummary.goalRelatedAlerts} • Version: {commandCenterData.activeAlertsSummary.versionRelatedAlerts}</p>
                        </div>
                      </div>

                      <div className="grid gap-3 xl:grid-cols-2">
                        <div className="rounded-md border p-3">
                          <p className="text-xs font-semibold">Performance Snapshot</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Sessions {commandCenterData.freshUpPerformanceSnapshot.totalFreshUpSessions} • Up Meter Peak {commandCenterData.freshUpPerformanceSnapshot.averageUpMeterPeak} • Trust Shift {commandCenterData.freshUpPerformanceSnapshot.averageTrustShift}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Emp {commandCenterData.freshUpPerformanceSnapshot.averageEmpathy} • Lis {commandCenterData.freshUpPerformanceSnapshot.averageListening} • Trust {commandCenterData.freshUpPerformanceSnapshot.averageTrust} • Follow Up {commandCenterData.freshUpPerformanceSnapshot.averageFollowUp} • Closing {commandCenterData.freshUpPerformanceSnapshot.averageClosing} • Rel {commandCenterData.freshUpPerformanceSnapshot.averageRelationship}
                          </p>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs font-semibold">Trend + Benchmark Highlights</p>
                          {commandCenterData.trendHighlights.slice(0, 5).map((trend) => (
                            <p key={trend.label} className="mt-1 text-xs text-muted-foreground">• {trend.label}: {trend.delta > 0 ? '+' : ''}{trend.delta}</p>
                          ))}
                          {commandCenterData.benchmarkSnapshot.highlights.slice(0, 3).map((highlight, idx) => (
                            <p key={`bh-${idx}`} className="mt-1 text-xs text-muted-foreground">• {highlight.metricName}: {highlight.difference > 0 ? '+' : ''}{highlight.difference}</p>
                          ))}
                        </div>
                      </div>

                      {commandCenterData.narrativeSummary && (
                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-xs font-semibold">Leadership Narrative</p>
                          <p className="mt-1 text-sm text-muted-foreground">{commandCenterData.narrativeSummary.narrative}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section>
              <Card>
                <CardHeader>
                  <CardTitle>CX Risk Radar</CardTitle>
                  <CardDescription>
                    Predictive risk signals for trust, engagement, archetype/concern friction, skill decline, adoption, goals, and version stability.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="space-y-2">
                      <Label>Risk Level</Label>
                      <Select value={riskLevelFilter} onValueChange={setRiskLevelFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RISK_LEVEL_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Risk Type</Label>
                      <Input value={riskTypeFilter === 'all' ? '' : riskTypeFilter} onChange={(event) => setRiskTypeFilter(event.target.value || 'all')} placeholder="risk type (optional)" />
                    </div>
                    <div className="space-y-2">
                      <Label>Dealer</Label>
                      <Input value={riskDealerFilter} onChange={(event) => setRiskDealerFilter(event.target.value)} placeholder="Dealer ID" />
                    </div>
                    <div className="space-y-2">
                      <Label>Consultant</Label>
                      <Input value={riskConsultantFilter} onChange={(event) => setRiskConsultantFilter(event.target.value)} placeholder="Consultant ID" />
                    </div>
                    <div className="space-y-2">
                      <Label>Archetype</Label>
                      <Input value={riskArchetypeFilter} onChange={(event) => setRiskArchetypeFilter(event.target.value)} placeholder="Archetype category" />
                    </div>
                    <div className="space-y-2">
                      <Label>Concern</Label>
                      <Input value={riskConcernFilter} onChange={(event) => setRiskConcernFilter(event.target.value)} placeholder="Primary concern" />
                    </div>
                    <div className="space-y-2">
                      <Label>Version</Label>
                      <Input value={riskVersionFilter} onChange={(event) => setRiskVersionFilter(event.target.value)} placeholder="Version ID/Name" />
                    </div>
                    <div className="space-y-2">
                      <Label>Date From</Label>
                      <Input type="date" value={riskDateFrom} onChange={(event) => setRiskDateFrom(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date To</Label>
                      <Input type="date" value={riskDateTo} onChange={(event) => setRiskDateTo(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>State</Label>
                      <Select value={riskActiveFilter} onValueChange={setRiskActiveFilter}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Button type="button" variant="outline" onClick={() => void loadRisks()} disabled={isLoadingRisks}>
                      {isLoadingRisks ? 'Refreshing Risks...' : 'Refresh Risks'}
                    </Button>
                    <Button type="button" onClick={() => void generateRisks()} disabled={isGeneratingRisks}>
                      {isGeneratingRisks ? 'Generating Risks...' : 'Generate Risks'}
                    </Button>
                  </div>
                  {riskError && (
                    <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700">
                      {riskError}
                    </div>
                  )}
                  <div className="space-y-3">
                    {risks.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No risk radar findings for this filter set.</p>
                    ) : (
                      risks.map((risk) => (
                        <div key={risk.riskId} className="rounded-md border p-3">
                          <div className="flex flex-wrap gap-2 items-center">
                            <Badge variant={risk.riskLevel === 'critical' || risk.riskLevel === 'high' ? 'destructive' : 'secondary'}>
                              {risk.riskLevel}
                            </Badge>
                            <Badge variant="outline">{risk.riskType}</Badge>
                            <Badge variant="secondary">{risk.entityType}: {risk.entityName || risk.entityId}</Badge>
                            <span className="text-xs text-muted-foreground">{new Date(risk.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="mt-2 text-sm">{risk.message}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Action: {risk.recommendedAction}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Confidence: {risk.confidenceLevel}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Fresh Up Benchmarks</CardTitle>
                  <CardDescription>
                    Compare consultant, dealer, archetype, concern, version, and segment performance with consistent benchmark scoring.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Benchmark Type</Label>
                      <Select value={benchmarkType} onValueChange={(value) => setBenchmarkType(value as BenchmarkTypeOption)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BENCHMARK_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Metric</Label>
                      <Select value={benchmarkMetric} onValueChange={(value) => setBenchmarkMetric(value as BenchmarkMetricOption)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {BENCHMARK_METRIC_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Entity ID</Label>
                      <Input value={benchmarkEntityId} onChange={(event) => setBenchmarkEntityId(event.target.value)} placeholder="Consultant, dealer, concern, archetype, or version ID" />
                    </div>
                    <div className="space-y-2">
                      <Label>Comparison Entity ID</Label>
                      <Input value={benchmarkComparisonId} onChange={(event) => setBenchmarkComparisonId(event.target.value)} placeholder="Optional version/dealer comparison ID" />
                    </div>
                    <div className="space-y-2">
                      <Label>Segment Key</Label>
                      <Input value={benchmarkSegmentKey} onChange={(event) => setBenchmarkSegmentKey(event.target.value)} placeholder="Optional (e.g. user.experienceTier)" />
                    </div>
                    <div className="space-y-2">
                      <Label>Segment Value</Label>
                      <Input value={benchmarkSegmentValue} onChange={(event) => setBenchmarkSegmentValue(event.target.value)} placeholder="Optional (e.g. experienced)" />
                    </div>
                  </div>

                  <Button type="button" onClick={() => void generateBenchmark()} disabled={isGeneratingBenchmark}>
                    {isGeneratingBenchmark ? 'Generating Benchmark...' : 'Generate Benchmark'}
                  </Button>

                  {benchmarkError && (
                    <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700">
                      {benchmarkError}
                    </div>
                  )}

                  {benchmarkResult && (
                    <div className="space-y-4 rounded-md border p-4">
                      <div className="grid gap-3 sm:grid-cols-3 text-sm">
                        <p><span className="font-medium">Subject:</span> {benchmarkResult.subjectLabel}</p>
                        <p><span className="font-medium">Comparison:</span> {benchmarkResult.comparisonLabel}</p>
                        <p><span className="font-medium">Samples:</span> {benchmarkResult.sampleSize.subjectSessions} vs {benchmarkResult.sampleSize.comparisonSessions}</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {benchmarkResult.rows.map((row) => (
                          <div key={`${row.metricName}-${row.benchmarkType}`} className="rounded-md border p-3">
                            <p className="text-sm font-semibold">{row.metricName}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Subject {row.subjectValue} • Comparison {row.comparisonValue}
                            </p>
                            <p className="mt-1 text-sm">
                              Δ {row.difference > 0 ? '+' : ''}{row.difference} ({row.differencePercent > 0 ? '+' : ''}{row.differencePercent}%)
                            </p>
                            <Badge variant={row.direction === 'above' ? 'default' : row.direction === 'below' ? 'secondary' : 'outline'} className="mt-2">
                              {row.direction}
                            </Badge>
                            <p className="mt-2 text-xs text-muted-foreground">{row.interpretationLabel}</p>
                          </div>
                        ))}
                      </div>
                      {benchmarkResult.assumptions && benchmarkResult.assumptions.length > 0 && (
                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-xs font-medium">Assumptions</p>
                          {benchmarkResult.assumptions.map((assumption) => (
                            <p key={assumption} className="text-xs text-muted-foreground mt-1">{assumption}</p>
                          ))}
                        </div>
                      )}
                      {narrativeResult && (
                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-xs font-medium">Performance Narrative</p>
                          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{narrativeResult.narrative}</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Fresh Up Insight Narrative Engine</CardTitle>
                  <CardDescription>
                    Generate plain-English, data-grounded summaries for dealer, consultant, manager, platform, archetype, version, and marketing contexts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Narrative Type</Label>
                      <Select value={narrativeType} onValueChange={(value) => setNarrativeType(value as NarrativeTypeOption)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NARRATIVE_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Length Mode</Label>
                      <Select value={narrativeLength} onValueChange={(value) => setNarrativeLength(value as NarrativeLengthOption)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NARRATIVE_LENGTH_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Entity ID</Label>
                      <Input value={narrativeEntityId} onChange={(event) => setNarrativeEntityId(event.target.value)} placeholder="Dealer/user/archetype/version ID" />
                    </div>
                    <div className="space-y-2">
                      <Label>Comparison Entity ID</Label>
                      <Input value={narrativeComparisonId} onChange={(event) => setNarrativeComparisonId(event.target.value)} placeholder="Optional comparison version/entity" />
                    </div>
                  </div>

                  <Button type="button" onClick={() => void generateNarrative()} disabled={isGeneratingNarrative}>
                    {isGeneratingNarrative ? 'Generating Narrative...' : 'Generate Narrative'}
                  </Button>

                  {narrativeError && (
                    <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700">
                      {narrativeError}
                    </div>
                  )}

                  {narrativeResult && (
                    <div className="rounded-md border p-4 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {narrativeResult.interpretationLabels.map((label) => (
                          <Badge key={label} variant="outline">{label}</Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{narrativeResult.narrative}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Weekly Fresh Up Digest</CardTitle>
                  <CardDescription>
                    Weekly briefing view for dealer, consultant, platform, manager coaching, and version monitoring contexts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Digest Type</Label>
                      <Select value={weeklyDigestType} onValueChange={(value) => setWeeklyDigestType(value as WeeklyDigestTypeOption)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {WEEKLY_DIGEST_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Length Mode</Label>
                      <Select value={weeklyDigestLength} onValueChange={(value) => setWeeklyDigestLength(value as NarrativeLengthOption)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {NARRATIVE_LENGTH_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Entity ID</Label>
                      <Input value={weeklyDigestEntityId} onChange={(event) => setWeeklyDigestEntityId(event.target.value)} placeholder="Dealer/user/version ID (optional by type)" />
                    </div>
                    <div className="space-y-2">
                      <Label>Comparison Entity ID</Label>
                      <Input value={weeklyDigestComparisonId} onChange={(event) => setWeeklyDigestComparisonId(event.target.value)} placeholder="Optional comparison entity/version" />
                    </div>
                  </div>

                  <Button type="button" onClick={() => void generateWeeklyDigest()} disabled={isGeneratingDigest}>
                    {isGeneratingDigest ? 'Generating Weekly Digest...' : 'Generate Weekly Digest'}
                  </Button>

                  {weeklyDigestError && (
                    <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700">
                      {weeklyDigestError}
                    </div>
                  )}

                  {weeklyDigest && (
                    <div className="rounded-md border p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{weeklyDigest.title}</Badge>
                        <Badge variant="secondary">{weeklyDigest.weekRange}</Badge>
                        <span className="text-xs text-muted-foreground">Samples: {weeklyDigest.sampleSize}</span>
                      </div>
                      <p className="text-sm font-medium">{weeklyDigest.headlineSummary}</p>
                      <div className="space-y-2">
                        {weeklyDigest.keyInsights.map((insight) => (
                          <p key={insight} className="text-sm text-muted-foreground">• {insight}</p>
                        ))}
                      </div>
                      <div className="rounded-md border bg-muted/20 p-3">
                        <p className="text-xs font-medium">Recommended Action</p>
                        <p className="mt-1 text-sm text-muted-foreground">{weeklyDigest.recommendedAction}</p>
                      </div>
                      {weeklyDigest.narrative && (
                        <div className="rounded-md border bg-muted/20 p-3">
                          <p className="text-xs font-medium">Narrative Context</p>
                          <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{weeklyDigest.narrative}</p>
                        </div>
                      )}
                      {weeklyDigest.aggregates && (
                        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                          <p>Total Sessions: {weeklyDigest.aggregates.totalSessions}</p>
                          <p>Active Consultants: {weeklyDigest.aggregates.activeConsultants}</p>
                          <p>Avg Up Meter Peak: {weeklyDigest.aggregates.averageUpMeterPeak}</p>
                          <p>Avg Trust Shift: {weeklyDigest.aggregates.averageTrustShift}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="rounded-md border p-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <div className="space-y-2">
                        <Label>Stored Digest Type</Label>
                        <Select value={storedDigestEntityType} onValueChange={(value) => setStoredDigestEntityType(value as 'dealer' | 'consultant' | 'platform')}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="platform">Platform</SelectItem>
                            <SelectItem value="dealer">Dealer</SelectItem>
                            <SelectItem value="consultant">Consultant</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Dealer Filter</Label>
                        <Input value={storedDigestDealerId} onChange={(event) => setStoredDigestDealerId(event.target.value)} placeholder="Dealer ID (optional)" />
                      </div>
                      <div className="space-y-2">
                        <Label>Consultant Filter</Label>
                        <Input value={storedDigestConsultantId} onChange={(event) => setStoredDigestConsultantId(event.target.value)} placeholder="Consultant ID (optional)" />
                      </div>
                      <div className="space-y-2">
                        <Label>Date From</Label>
                        <Input type="date" value={storedDigestDateFrom} onChange={(event) => setStoredDigestDateFrom(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Date To</Label>
                        <Input type="date" value={storedDigestDateTo} onChange={(event) => setStoredDigestDateTo(event.target.value)} />
                      </div>
                      <div className="flex items-end">
                        <Button type="button" variant="outline" className="w-full" onClick={() => void loadStoredWeeklyDigests()} disabled={isLoadingStoredDigests}>
                          {isLoadingStoredDigests ? 'Loading...' : 'Load Stored Digests'}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {storedDigests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No stored digests for this filter set.</p>
                      ) : (
                        storedDigests.map((record) => (
                          <div key={record.digestId} className="rounded-md border p-3">
                            <div className="flex flex-wrap gap-2 items-center">
                              <Badge variant="outline">{record.entityType}</Badge>
                              <Badge variant="secondary">{record.entityName || record.entityId || 'Platform'}</Badge>
                              <span className="text-xs text-muted-foreground">{new Date(record.weekStart).toLocaleDateString()} - {new Date(record.weekEnd).toLocaleDateString()}</span>
                            </div>
                            <p className="mt-2 text-sm font-medium">{record.headline}</p>
                            <p className="mt-1 text-xs text-muted-foreground"><span className="font-semibold text-foreground">Action:</span> {record.recommendedAction}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section>
              <Card>
                <CardHeader>
                  <CardTitle>Fresh Up Analytics Export</CardTitle>
                  <CardDescription>
                    Generate raw extracts and structured internal reports for dealer summaries, coaching insights, AutoForge triggers, and marketing intelligence.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Export Type</Label>
                      <Select value={exportType} onValueChange={(value) => setExportType(value as ExportTypeOption)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EXPORT_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Format</Label>
                      <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as ExportFormatOption)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EXPORT_FORMAT_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="text-sm font-medium">Include Sandbox Data</p>
                        <p className="text-xs text-muted-foreground">Off by default to protect production-facing exports.</p>
                      </div>
                      <Switch checked={includeSandboxData} onCheckedChange={setIncludeSandboxData} />
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2">
                      <Label>Date From</Label>
                      <Input type="date" value={filters.dateFrom} onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date To</Label>
                      <Input type="date" value={filters.dateTo} onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Dealer ID</Label>
                      <Input value={filters.dealerId} onChange={(event) => setFilters((prev) => ({ ...prev, dealerId: event.target.value }))} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label>User ID</Label>
                      <Input value={filters.userId} onChange={(event) => setFilters((prev) => ({ ...prev, userId: event.target.value }))} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label>Version ID</Label>
                      <Input value={filters.freshUpVersionId} onChange={(event) => setFilters((prev) => ({ ...prev, freshUpVersionId: event.target.value }))} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label>Environment</Label>
                      <Input value={filters.environment} onChange={(event) => setFilters((prev) => ({ ...prev, environment: event.target.value }))} placeholder="production | sandbox" />
                    </div>
                    <div className="space-y-2">
                      <Label>Source Type</Label>
                      <Input value={filters.sourceType} onChange={(event) => setFilters((prev) => ({ ...prev, sourceType: event.target.value }))} placeholder="procedural | signature" />
                    </div>
                    <div className="space-y-2">
                      <Label>Difficulty Level</Label>
                      <Input value={filters.difficultyLevel} onChange={(event) => setFilters((prev) => ({ ...prev, difficultyLevel: event.target.value }))} placeholder="easy | medium | hard" />
                    </div>
                    <div className="space-y-2">
                      <Label>Archetype Category</Label>
                      <Input value={filters.archetypeCategory} onChange={(event) => setFilters((prev) => ({ ...prev, archetypeCategory: event.target.value }))} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label>Primary Concern</Label>
                      <Input value={filters.primaryConcern} onChange={(event) => setFilters((prev) => ({ ...prev, primaryConcern: event.target.value }))} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label>Buying Stage</Label>
                      <Input value={filters.buyingStage} onChange={(event) => setFilters((prev) => ({ ...prev, buyingStage: event.target.value }))} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label>Personality Type</Label>
                      <Input value={filters.personalityType} onChange={(event) => setFilters((prev) => ({ ...prev, personalityType: event.target.value }))} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label>Outcome Tag</Label>
                      <Input value={filters.outcomeTag} onChange={(event) => setFilters((prev) => ({ ...prev, outcomeTag: event.target.value }))} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label>Coaching Tag</Label>
                      <Input value={filters.coachingTag} onChange={(event) => setFilters((prev) => ({ ...prev, coachingTag: event.target.value }))} placeholder="Optional" />
                    </div>
                    <div className="space-y-2">
                      <Label>isSandbox</Label>
                        <Select value={filters.isSandbox} onValueChange={(value) => setFilters((prev) => ({ ...prev, isSandbox: value }))}>
                          <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                          <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="false">false</SelectItem>
                          <SelectItem value="true">true</SelectItem>
                          </SelectContent>
                        </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button type="button" onClick={() => void generateExport()} disabled={isGeneratingExport}>
                      {isGeneratingExport ? 'Generating Export...' : 'Generate Export'}
                    </Button>
                    <Button type="button" variant="outline" onClick={downloadExport} disabled={!exportResult}>
                      Download
                    </Button>
                  </div>

                  {exportError && (
                    <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700">
                      {exportError}
                    </div>
                  )}

                  {exportResult && (
                    <div className="space-y-3 rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>File: {exportResult.fileName}</span>
                        <span>Rows: {exportResult.rowCount}</span>
                        <span>Sandbox Included: {exportResult.sandboxIncluded ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Version Coverage: {exportResult.versionCoverage.length > 0 ? exportResult.versionCoverage.join(' | ') : 'N/A'}
                      </div>
                      <div className="space-y-2">
                        <Label>Structured Report Preview</Label>
                        <Textarea value={exportResult.preview} readOnly className="min-h-[260px] font-mono text-xs" />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

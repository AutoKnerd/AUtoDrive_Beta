import type { FreshUpExportFilters } from '@/lib/fresh-up-export/types';
import type { FreshUpBenchmarkResult } from '@/lib/fresh-up-benchmark/types';
import type { FreshUpNarrativeResult } from '@/lib/fresh-up-narrative/types';

export type FreshUpCommandCenterEntityMode = 'dealer' | 'consultant' | 'platform' | 'version';

export type FreshUpCommandCenterRequest = {
  entityMode: FreshUpCommandCenterEntityMode;
  entityId?: string;
  comparisonEntityId?: string;
  filters: FreshUpExportFilters;
};

export type FreshUpGoalStatus = 'on_track' | 'at_risk' | 'exceeded' | 'stalled';

export type FreshUpCommandCenterGoalRow = {
  goalId: string;
  goalTitle: string;
  currentValue: number;
  targetValue: number;
  progressPercent: number;
  status: FreshUpGoalStatus;
};

export type FreshUpCommandCenterRiskRow = {
  riskId: string;
  riskType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recommendedAction: string;
};

export type FreshUpCommandCenterAlertRow = {
  alertId: string;
  alertType: string;
  severity: string;
  message: string;
  recommendedAction: string;
};

export type FreshUpCommandCenterPerformanceSnapshot = {
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

export type FreshUpCommandCenterCoachingIntelligence = {
  coachingId?: string;
  priorityLevel: 'low' | 'medium' | 'high' | 'critical';
  coachingTopic: string;
  message: string;
  supportingEvidence: string;
  recommendedPractice: string;
  suggestedAutoForgeModule: string;
};

export type FreshUpCommandCenterResult = {
  generatedAt: string;
  entityMode: FreshUpCommandCenterEntityMode;
  entityId: string;
  entityName: string;
  weeklyDigestSummary: {
    headline: string;
    topInsights: string[];
    recommendedAction: string;
  };
  activeRiskRadarSummary: {
    totalActiveRisks: number;
    topRisks: FreshUpCommandCenterRiskRow[];
  };
  goalsAndTargetsSummary: {
    activeGoals: number;
    onTrack: number;
    atRisk: number;
    exceeded: number;
    stalled: number;
    topGoalsNeedingAttention: FreshUpCommandCenterGoalRow[];
  };
  activeAlertsSummary: {
    totalActiveAlerts: number;
    highSeverityAlerts: number;
    goalRelatedAlerts: number;
    versionRelatedAlerts: number;
    topAlerts: FreshUpCommandCenterAlertRow[];
  };
  freshUpPerformanceSnapshot: FreshUpCommandCenterPerformanceSnapshot;
  coachingIntelligence?: FreshUpCommandCenterCoachingIntelligence;
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
  narrativeSummary?: FreshUpNarrativeResult;
  benchmarkData?: FreshUpBenchmarkResult;
  environment: 'sandbox' | 'production';
};

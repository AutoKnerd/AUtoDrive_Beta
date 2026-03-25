import type { FreshUpExportFilters, FreshUpNormalizedSession } from '@/lib/fresh-up-export/types';
import type { FreshUpNarrativeLength, FreshUpNarrativeResult } from '@/lib/fresh-up-narrative/types';
import type { FreshUpBenchmarkResult } from '@/lib/fresh-up-benchmark/types';
import type { AisRoleType } from '@/lib/definitions';

export type FreshUpWeeklyDigestType =
  | 'dealer_weekly'
  | 'consultant_weekly'
  | 'platform_weekly'
  | 'manager_coaching_weekly'
  | 'version_monitoring_weekly';

export type FreshUpWeeklyDigestEntityType = 'dealer' | 'consultant' | 'platform';

export type FreshUpWeeklyDigestRequest = {
  digestType: FreshUpWeeklyDigestType;
  lengthMode: FreshUpNarrativeLength;
  filters: FreshUpExportFilters;
  entityId?: string;
  comparisonEntityId?: string;
};

export type FreshUpWeeklyDigestAggregates = {
  weekRangeLabel: string;
  totalSessions: number;
  activeConsultants: number;
  activeDealers: number;
  averageConversationLength: number;
  averageUpMeterPeak: number;
  averageTrustShift: number;
  averageEmpathy: number;
  averageListening: number;
  averageTrust: number;
  averageFollowUp: number;
  averageClosing: number;
  averageRelationship: number;
  topStrength: string;
  topImprovementArea: string;
  mostCommonCustomerFriction: string;
  mostCommonArchetypeFriction: string;
  mostCommonConcernFriction: string;
  dominantRoleType: AisRoleType;
  outcomes: {
    customerEngaged: number;
    trustEstablished: number;
    appointmentSet: number;
    lostMomentum: number;
    conversationBreakdown: number;
  };
  progressVsPreviousWeek: {
    trustDelta: number;
    upMeterDelta: number;
    sessionDeltaPercent: number;
  };
  versionNotes?: string;
};

export type FreshUpWeeklyDigestResult = {
  digestType: FreshUpWeeklyDigestType;
  title: string;
  headlineSummary: string;
  weekRange: string;
  keyInsights: string[];
  recommendedAction: string;
  narrative?: string;
  lengthMode: FreshUpNarrativeLength;
  generatedAt: string;
  aggregates: FreshUpWeeklyDigestAggregates;
  benchmark?: FreshUpBenchmarkResult | null;
  narrativeData?: FreshUpNarrativeResult | null;
  sampleSize: number;
};

export type FreshUpWeeklyDigestRecord = {
  digestId: string;
  entityType: FreshUpWeeklyDigestEntityType;
  entityId: string;
  entityName: string;
  weekStart: Date;
  weekEnd: Date;
  headline: string;
  keyInsights: string[];
  recommendedAction: string;
  narrativeSummary?: string;
  metricsSnapshot: Record<string, unknown>;
  createdAt: Date;
  environment: 'sandbox' | 'production';
};

export type FreshUpWeeklyDigestContext = {
  sessions: FreshUpNormalizedSession[];
  filters: FreshUpExportFilters;
  entityId?: string;
  comparisonEntityId?: string;
  dealerNameById?: Map<string, string>;
  userNameById?: Map<string, string>;
};

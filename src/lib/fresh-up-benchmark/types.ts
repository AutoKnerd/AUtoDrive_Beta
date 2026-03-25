import type { FreshUpExportFilters, FreshUpNormalizedSession } from '@/lib/fresh-up-export/types';

export type FreshUpBenchmarkType =
  | 'consultant_vs_dealer'
  | 'dealer_vs_platform'
  | 'current_vs_previous_30'
  | 'archetype_vs_overall'
  | 'concern_vs_overall'
  | 'version_vs_previous_version'
  | 'team_segment_vs_other_segments';

export type FreshUpBenchmarkMetric =
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

export type FreshUpBenchmarkDirection = 'above' | 'below' | 'equal';

export type FreshUpBenchmarkRow = {
  benchmarkType: FreshUpBenchmarkType;
  metricName: FreshUpBenchmarkMetric;
  subjectValue: number;
  comparisonValue: number;
  difference: number;
  differencePercent: number;
  direction: FreshUpBenchmarkDirection;
  interpretationLabel: string;
};

export type FreshUpBenchmarkRequest = {
  benchmarkType: FreshUpBenchmarkType;
  filters: FreshUpExportFilters;
  entityId?: string;
  comparisonEntityId?: string;
  metricName?: FreshUpBenchmarkMetric | 'all';
  dateRangeMode?: 'custom' | 'current_30_vs_previous_30';
  segmentKey?: string;
  segmentValue?: string;
};

export type FreshUpBenchmarkResult = {
  benchmarkType: FreshUpBenchmarkType;
  generatedAt: string;
  subjectLabel: string;
  comparisonLabel: string;
  rows: FreshUpBenchmarkRow[];
  outliers: FreshUpBenchmarkRow[];
  sampleSize: {
    subjectSessions: number;
    comparisonSessions: number;
  };
  assumptions?: string[];
};

export type FreshUpBenchmarkContext = {
  sessions: FreshUpNormalizedSession[];
  filters: FreshUpExportFilters;
  userNameById?: Map<string, string>;
  dealerNameById?: Map<string, string>;
  userMetadataById?: Map<string, Record<string, unknown>>;
  dealerMetadataById?: Map<string, Record<string, unknown>>;
};

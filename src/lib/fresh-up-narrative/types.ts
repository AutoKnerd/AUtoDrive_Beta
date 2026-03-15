import type { FreshUpExportFilters, FreshUpNormalizedSession } from '@/lib/fresh-up-export/types';
import type { FreshUpBenchmarkResult } from '@/lib/fresh-up-benchmark/types';

export type FreshUpNarrativeType =
  | 'dealer_performance'
  | 'consultant_trend'
  | 'manager_coaching'
  | 'platform_insight'
  | 'archetype_insight'
  | 'version_comparison'
  | 'marketing_insight';

export type FreshUpNarrativeLength = 'short' | 'standard' | 'extended';

export type FreshUpInterpretationLabel =
  | 'improving'
  | 'stable'
  | 'declining'
  | 'above average'
  | 'below average'
  | 'strongest area'
  | 'primary growth area'
  | 'recurring friction';

export type FreshUpNarrativeRequest = {
  narrativeType: FreshUpNarrativeType;
  lengthMode: FreshUpNarrativeLength;
  filters: FreshUpExportFilters;
  entityId?: string;
  comparisonEntityId?: string;
};

export type FreshUpNarrativeContext = {
  sessions: FreshUpNormalizedSession[];
  filters: FreshUpExportFilters;
  entityId?: string;
  comparisonEntityId?: string;
  dealerNameById?: Map<string, string>;
  userNameById?: Map<string, string>;
  benchmarkResult?: FreshUpBenchmarkResult | null;
};

export type FreshUpNarrativePreparedInput = {
  subjectLabel: string;
  periodLabel: string;
  usageVolume: number;
  strongestSkill: string;
  weakestSkill: string;
  upMeterAverage: number;
  trustShiftAverage: number;
  outcomeTop: string;
  recurringFriction: string;
  archetypeFriction: string;
  concernFriction: string;
  trendLabel: FreshUpInterpretationLabel;
  benchmarkLabel?: string;
  benchmarkSummary?: string;
  versionSummary?: string;
};

export type FreshUpNarrativeResult = {
  narrativeType: FreshUpNarrativeType;
  lengthMode: FreshUpNarrativeLength;
  title: string;
  narrative: string;
  interpretationLabels: FreshUpInterpretationLabel[];
  generatedAt: string;
};

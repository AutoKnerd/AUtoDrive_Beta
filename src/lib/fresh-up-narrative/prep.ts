import { runFreshUpBenchmark } from '@/lib/fresh-up-benchmark/engine';
import type { FreshUpBenchmarkResult } from '@/lib/fresh-up-benchmark/types';
import type { FreshUpNarrativeContext, FreshUpNarrativePreparedInput, FreshUpNarrativeType } from '@/lib/fresh-up-narrative/types';
import { trendLabelFromDelta } from '@/lib/fresh-up-narrative/labels';

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  let winner = '';
  let max = 0;
  counts.forEach((count, value) => {
    if (count > max) {
      winner = value;
      max = count;
    }
  });
  return winner;
}

function strongestAndWeakestSkill(rows: FreshUpNarrativeContext['sessions']): { strongest: string; weakest: string; strongestValue: number; weakestValue: number } {
  const skillRows = [
    { label: 'Empathy', value: avg(rows.map((row) => row.scores.empathy)) },
    { label: 'Listening', value: avg(rows.map((row) => row.scores.listening)) },
    { label: 'Trust', value: avg(rows.map((row) => row.scores.trust)) },
    { label: 'Follow Up', value: avg(rows.map((row) => row.scores.followUp)) },
    { label: 'Closing', value: avg(rows.map((row) => row.scores.closing)) },
    { label: 'Relationship', value: avg(rows.map((row) => row.scores.relationship)) },
  ].sort((a, b) => b.value - a.value);
  return {
    strongest: skillRows[0]?.label || 'N/A',
    weakest: skillRows[skillRows.length - 1]?.label || 'N/A',
    strongestValue: round(skillRows[0]?.value || 0),
    weakestValue: round(skillRows[skillRows.length - 1]?.value || 0),
  };
}

function resolveSubjectRows(input: FreshUpNarrativeContext, narrativeType: FreshUpNarrativeType) {
  if (narrativeType === 'consultant_trend') {
    return input.sessions.filter((row) => row.userId === (input.entityId || ''));
  }
  if (narrativeType === 'dealer_performance' || narrativeType === 'manager_coaching') {
    return input.sessions.filter((row) => row.dealerId === (input.entityId || ''));
  }
  if (narrativeType === 'archetype_insight') {
    return input.sessions.filter((row) => (
      row.archetypeId === (input.entityId || '')
      || row.archetypeName.toLowerCase() === String(input.entityId || '').toLowerCase()
      || row.archetypeCategory.toLowerCase() === String(input.entityId || '').toLowerCase()
    ));
  }
  if (narrativeType === 'version_comparison') {
    return input.sessions.filter((row) => row.freshUpVersionId === (input.entityId || ''));
  }
  return input.sessions;
}

function buildVersionSummary(input: FreshUpNarrativeContext, benchmarkResult: FreshUpBenchmarkResult | null): string {
  if (!benchmarkResult) return '';
  const upPeak = benchmarkResult.rows.find((row) => row.metricName === 'averageUpMeterPeak');
  const trust = benchmarkResult.rows.find((row) => row.metricName === 'averageTrustShift');
  const breakdown = benchmarkResult.rows.find((row) => row.metricName === 'conversationBreakdownRate');
  const label = upPeak?.difference && upPeak.difference > 0 ? 'improved engagement' : 'mixed engagement';
  return `${label}; trust delta ${trust?.difference ?? 0}; breakdown delta ${breakdown?.difference ?? 0}.`;
}

export function prepareNarrativeInput(input: {
  context: FreshUpNarrativeContext;
  narrativeType: FreshUpNarrativeType;
}): FreshUpNarrativePreparedInput {
  const subjectRows = resolveSubjectRows(input.context, input.narrativeType);
  const comparisonRows = input.context.sessions;
  const subject = strongestAndWeakestSkill(subjectRows);
  const recent30 = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const previous60 = Date.now() - (60 * 24 * 60 * 60 * 1000);
  const currentRows = subjectRows.filter((row) => row.timestamp.getTime() >= recent30);
  const previousRows = subjectRows.filter((row) => row.timestamp.getTime() >= previous60 && row.timestamp.getTime() < recent30);
  const currentTrust = avg(currentRows.map((row) => row.scores.trust));
  const previousTrust = avg(previousRows.map((row) => row.scores.trust));
  const trendLabel = trendLabelFromDelta(currentTrust - previousTrust);
  const outcomeTop = mostCommon(subjectRows.map((row) => row.outcomeTag));
  const recurringFriction = mostCommon(subjectRows.filter((row) => row.outcomeTag === 'Conversation Breakdown' || row.outcomeTag === 'Lost Momentum').map((row) => row.coachingTag || row.summaryTag || row.primaryConcern));
  const archetypeFriction = mostCommon(subjectRows.filter((row) => row.outcomeTag === 'Conversation Breakdown').map((row) => row.archetypeCategory || row.archetypeName));
  const concernFriction = mostCommon(subjectRows.filter((row) => row.outcomeTag === 'Conversation Breakdown').map((row) => row.primaryConcern));
  const benchmark = input.context.benchmarkResult ?? (
    input.narrativeType === 'version_comparison'
      ? runFreshUpBenchmark({
        request: {
          benchmarkType: 'version_vs_previous_version',
          entityId: input.context.entityId,
          comparisonEntityId: input.context.comparisonEntityId,
          filters: input.context.filters,
          metricName: 'all',
        },
        context: {
          sessions: input.context.sessions,
          filters: input.context.filters,
          dealerNameById: input.context.dealerNameById,
          userNameById: input.context.userNameById,
        },
      })
      : null
  );

  const benchmarkTop = benchmark?.outliers?.[0];
  const subjectLabel = input.narrativeType === 'consultant_trend'
    ? (input.context.userNameById?.get(input.context.entityId || '') || input.context.entityId || 'Consultant')
    : input.narrativeType === 'dealer_performance' || input.narrativeType === 'manager_coaching'
      ? (input.context.dealerNameById?.get(input.context.entityId || '') || input.context.entityId || 'Dealer')
      : input.narrativeType === 'platform_insight' || input.narrativeType === 'marketing_insight'
        ? 'Platform'
        : input.context.entityId || 'Selected Scope';

  return {
    subjectLabel,
    periodLabel: `${input.context.filters.dateFrom || 'recent'} to ${input.context.filters.dateTo || 'current'}`,
    usageVolume: subjectRows.length,
    strongestSkill: subject.strongest,
    weakestSkill: subject.weakest,
    upMeterAverage: round(avg(subjectRows.map((row) => row.upMeterPeak))),
    trustShiftAverage: round(avg(subjectRows.map((row) => row.trustShift))),
    outcomeTop: outcomeTop || 'Customer Engaged',
    recurringFriction: recurringFriction || 'trust inconsistency',
    archetypeFriction: archetypeFriction || mostCommon(comparisonRows.map((row) => row.archetypeCategory)),
    concernFriction: concernFriction || mostCommon(comparisonRows.map((row) => row.primaryConcern)),
    trendLabel,
    benchmarkLabel: benchmarkTop?.metricName,
    benchmarkSummary: benchmarkTop ? `${benchmarkTop.metricName} ${benchmarkTop.difference > 0 ? '+' : ''}${benchmarkTop.difference}` : undefined,
    versionSummary: input.narrativeType === 'version_comparison' ? buildVersionSummary(input.context, benchmark) : undefined,
  };
}

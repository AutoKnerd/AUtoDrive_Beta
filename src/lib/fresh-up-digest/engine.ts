import { aggregateWeeklyDigest } from '@/lib/fresh-up-digest/aggregate';
import { composeWeeklyDigestContent } from '@/lib/fresh-up-digest/compose';
import { buildWeeklyDigestRecommendation } from '@/lib/fresh-up-digest/recommend';
import type { FreshUpWeeklyDigestContext, FreshUpWeeklyDigestRequest, FreshUpWeeklyDigestResult } from '@/lib/fresh-up-digest/types';
import { runFreshUpBenchmark } from '@/lib/fresh-up-benchmark/engine';
import { generateFreshUpNarrative } from '@/lib/fresh-up-narrative/engine';
import type { FreshUpNarrativeType } from '@/lib/fresh-up-narrative/types';
import { buildCoachingInsight } from '@/lib/coaching-intelligence/coachingEngine';

function narrativeTypeForDigest(type: FreshUpWeeklyDigestRequest['digestType']): FreshUpNarrativeType {
  if (type === 'dealer_weekly') return 'dealer_performance';
  if (type === 'consultant_weekly') return 'consultant_trend';
  if (type === 'manager_coaching_weekly') return 'manager_coaching';
  if (type === 'version_monitoring_weekly') return 'version_comparison';
  return 'platform_insight';
}

function benchmarkTypeForDigest(type: FreshUpWeeklyDigestRequest['digestType']) {
  if (type === 'dealer_weekly') return 'dealer_vs_platform' as const;
  if (type === 'consultant_weekly') return 'consultant_vs_dealer' as const;
  if (type === 'manager_coaching_weekly') return 'dealer_vs_platform' as const;
  if (type === 'version_monitoring_weekly') return 'version_vs_previous_version' as const;
  return 'current_vs_previous_30' as const;
}

export function generateWeeklyDigest(input: {
  request: FreshUpWeeklyDigestRequest;
  context: FreshUpWeeklyDigestContext;
}): FreshUpWeeklyDigestResult {
  const aggregation = aggregateWeeklyDigest({
    context: input.context,
    digestType: input.request.digestType,
  });
  const benchmark = runFreshUpBenchmark({
    request: {
      benchmarkType: benchmarkTypeForDigest(input.request.digestType),
      filters: input.request.filters,
      entityId: input.request.entityId,
      comparisonEntityId: input.request.comparisonEntityId,
      metricName: 'all',
    },
    context: {
      sessions: input.context.sessions,
      filters: input.request.filters,
      userNameById: input.context.userNameById,
      dealerNameById: input.context.dealerNameById,
    },
  });
  const narrative = generateFreshUpNarrative({
    narrativeType: narrativeTypeForDigest(input.request.digestType),
    lengthMode: input.request.lengthMode === 'short' ? 'short' : 'standard',
    context: {
      sessions: input.context.sessions,
      filters: input.request.filters,
      entityId: input.request.entityId,
      comparisonEntityId: input.request.comparisonEntityId,
      dealerNameById: input.context.dealerNameById,
      userNameById: input.context.userNameById,
      benchmarkResult: benchmark,
    },
  });
  const recommendation = buildWeeklyDigestRecommendation({
    aggregates: aggregation.aggregates,
    digestType: input.request.digestType,
  });
  const composed = composeWeeklyDigestContent({
    digestType: input.request.digestType,
    lengthMode: input.request.lengthMode,
    aggregates: aggregation.aggregates,
    narrative: narrative.narrative,
  });
  const coachingInsight = buildCoachingInsight({
    entityType: input.request.digestType === 'consultant_weekly'
      ? 'consultant'
      : (input.request.digestType === 'platform_weekly' ? 'platform' : 'dealer'),
    entityId: input.request.entityId || 'platform',
    entityName: input.request.entityId || 'team',
    environment: input.request.filters.includeSandboxData === true ? 'sandbox' : 'production',
    context: {
      currentRows: aggregation.currentRows,
      previousRows: aggregation.previousRows,
    },
  });
  if (coachingInsight && (coachingInsight.priorityLevel === 'high' || coachingInsight.priorityLevel === 'critical')) {
    composed.keyInsights = [
      ...composed.keyInsights,
      `Coaching Focus This Week: ${coachingInsight.coachingTopic} (${coachingInsight.priorityLevel})`,
    ].slice(0, 8);
  }
  const composedRecommendation = coachingInsight
    ? `${coachingInsight.recommendedPractice} Suggested AutoForge: ${coachingInsight.suggestedAutoForgeModule}.`
    : (recommendation.suggestedAutoForgeModule
      ? `${recommendation.recommendedAction} Suggested AutoForge: ${recommendation.suggestedAutoForgeModule}.`
      : recommendation.recommendedAction);

  return {
    digestType: input.request.digestType,
    title: composed.title,
    weekRange: aggregation.aggregates.weekRangeLabel,
    headlineSummary: composed.headlineSummary,
    keyInsights: composed.keyInsights,
    recommendedAction: composedRecommendation,
    narrative: composed.narrative,
    lengthMode: input.request.lengthMode,
    generatedAt: new Date().toISOString(),
    aggregates: aggregation.aggregates,
    benchmark,
    narrativeData: narrative,
    sampleSize: aggregation.currentRows.length,
  };
}

import { buildNarrativeText } from '@/lib/fresh-up-narrative/templates';
import { prepareNarrativeInput } from '@/lib/fresh-up-narrative/prep';
import { addUniqueLabel, strongestWeakestLabels } from '@/lib/fresh-up-narrative/labels';
import type { FreshUpNarrativeContext, FreshUpNarrativeLength, FreshUpNarrativeResult, FreshUpNarrativeType } from '@/lib/fresh-up-narrative/types';

function narrativeTitle(type: FreshUpNarrativeType): string {
  if (type === 'dealer_performance') return 'Performance Narrative';
  if (type === 'consultant_trend') return 'Consultant Narrative';
  if (type === 'manager_coaching') return 'Coaching Narrative';
  if (type === 'platform_insight') return 'Platform Narrative';
  if (type === 'archetype_insight') return 'Archetype Narrative';
  if (type === 'version_comparison') return 'Version Summary';
  return 'Insight Summary';
}

export function generateFreshUpNarrative(input: {
  narrativeType: FreshUpNarrativeType;
  lengthMode: FreshUpNarrativeLength;
  context: FreshUpNarrativeContext;
}): FreshUpNarrativeResult {
  const prepared = prepareNarrativeInput({
    context: input.context,
    narrativeType: input.narrativeType,
  });
  let labels = strongestWeakestLabels({
    strongestValue: prepared.upMeterAverage,
    weakestValue: prepared.trustShiftAverage,
  });
  labels = addUniqueLabel(labels, prepared.trendLabel);
  if (prepared.recurringFriction) {
    labels = addUniqueLabel(labels, 'recurring friction');
  }

  return {
    narrativeType: input.narrativeType,
    lengthMode: input.lengthMode,
    title: narrativeTitle(input.narrativeType),
    narrative: buildNarrativeText({
      narrativeType: input.narrativeType,
      prepared,
      lengthMode: input.lengthMode,
    }),
    interpretationLabels: labels,
    generatedAt: new Date().toISOString(),
  };
}

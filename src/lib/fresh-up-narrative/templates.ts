import type { FreshUpNarrativeLength, FreshUpNarrativePreparedInput, FreshUpNarrativeType } from '@/lib/fresh-up-narrative/types';

type TemplateBuilder = (input: FreshUpNarrativePreparedInput, lengthMode: FreshUpNarrativeLength) => string;

function trimSentences(text: string, maxSentences: number): string {
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, maxSentences).join(' ');
}

function applyLength(base: string, lengthMode: FreshUpNarrativeLength): string {
  if (lengthMode === 'short') return trimSentences(base, 2);
  if (lengthMode === 'standard') return trimSentences(base, 5);
  return base;
}

const builders: Record<FreshUpNarrativeType, TemplateBuilder> = {
  dealer_performance: (input, lengthMode) => applyLength(
    `${input.subjectLabel} logged ${input.usageVolume} Fresh Up sessions in ${input.periodLabel}, with ${input.strongestSkill} as the strongest area and ${input.weakestSkill} as the primary growth area. `
      + `Average Up Meter peak reached ${input.upMeterAverage}, and outcome patterns were led by ${input.outcomeTop}. `
      + `${input.trendLabel === 'improving' ? 'Performance is improving' : input.trendLabel === 'declining' ? 'Performance is declining' : 'Performance is stable'}, but recurring friction remains around ${input.recurringFriction}, especially in ${input.concernFriction} conversations.`,
    lengthMode
  ),
  consultant_trend: (input, lengthMode) => applyLength(
    `${input.subjectLabel} shows consistent strength in ${input.strongestSkill}, while ${input.weakestSkill} remains the key coaching opportunity. `
      + `Across ${input.usageVolume} sessions, engagement averaged ${input.upMeterAverage} and trust shift averaged ${input.trustShiftAverage}. `
      + `The most common friction appears in ${input.archetypeFriction} scenarios linked to ${input.concernFriction}. `
      + `${input.trendLabel === 'improving' ? 'Recent results indicate coaching momentum is improving.' : input.trendLabel === 'declining' ? 'Recent outcomes suggest coaching reinforcement is needed.' : 'Recent outcomes are stable with moderate variation.'}`,
    lengthMode
  ),
  manager_coaching: (input, lengthMode) => applyLength(
    `Team pattern for ${input.subjectLabel} shows ${input.strongestSkill} as a reliable strength, while ${input.weakestSkill} is the most visible gap. `
      + `Most friction appears when conversations center on ${input.concernFriction}, with recurring tags around ${input.recurringFriction}. `
      + `Engagement remains ${input.upMeterAverage >= 70 ? 'healthy' : 'mixed'}, but trust consistency still needs attention. `
      + `Recommended coaching focus: reinforce discovery before numbers and align follow-up questions to customer concerns.`,
    lengthMode
  ),
  platform_insight: (input, lengthMode) => applyLength(
    `Platform-wide Fresh Up activity covered ${input.usageVolume} sessions in ${input.periodLabel}. `
      + `${input.strongestSkill} remains the strongest skill area, while ${input.weakestSkill} is the most common gap. `
      + `${input.archetypeFriction} archetypes and ${input.concernFriction} concerns are most associated with friction outcomes. `
      + `Overall trend is ${input.trendLabel}, and ${input.outcomeTop} remains the most frequent conversation outcome.`,
    lengthMode
  ),
  archetype_insight: (input, lengthMode) => applyLength(
    `For ${input.subjectLabel}, conversations show stronger ${input.strongestSkill} and weaker ${input.weakestSkill} versus broader performance. `
      + `Average engagement reached ${input.upMeterAverage}, but recurring friction appears around ${input.recurringFriction}. `
      + `The pattern suggests coaching value in balancing rapport with clearer progression to next steps.`,
    lengthMode
  ),
  version_comparison: (input, lengthMode) => applyLength(
    `${input.subjectLabel} compared with prior version data indicates ${input.versionSummary || 'mixed movement across core metrics'}. `
      + `The largest benchmark shift is ${input.benchmarkSummary || 'limited'}, while strongest performance remains in ${input.strongestSkill} and the main risk remains ${input.weakestSkill}. `
      + `${input.trendLabel === 'improving' ? 'Current release behavior trends positive and is a keep candidate.' : input.trendLabel === 'declining' ? 'Current release behavior needs review before broad expansion.' : 'Current release is stable but should be monitored on high-friction customer profiles.'}`,
    lengthMode
  ),
  marketing_insight: (input, lengthMode) => applyLength(
    `Across recent Fresh Up activity, ${input.weakestSkill} remains the most common CX gap while ${input.strongestSkill} continues to lead engagement outcomes. `
      + `${input.archetypeFriction} customer types and ${input.concernFriction} conversations are the most consistent friction points. `
      + `Dealers with higher relationship and trust consistency generally produce stronger Up Meter peaks and more positive endings. `
      + `Overall platform trend is ${input.trendLabel}, with ${input.outcomeTop} as the dominant outcome pattern.`,
    lengthMode
  ),
};

export function buildNarrativeText(input: {
  narrativeType: FreshUpNarrativeType;
  prepared: FreshUpNarrativePreparedInput;
  lengthMode: FreshUpNarrativeLength;
}): string {
  const builder = builders[input.narrativeType];
  return builder(input.prepared, input.lengthMode);
}

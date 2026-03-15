import type { FreshUpInterpretationLabel } from '@/lib/fresh-up-narrative/types';

export function trendLabelFromDelta(delta: number): FreshUpInterpretationLabel {
  if (delta > 1.5) return 'improving';
  if (delta < -1.5) return 'declining';
  return 'stable';
}

export function addUniqueLabel(labels: FreshUpInterpretationLabel[], label: FreshUpInterpretationLabel): FreshUpInterpretationLabel[] {
  if (labels.includes(label)) return labels;
  return [...labels, label];
}

export function strongestWeakestLabels(input: {
  strongestValue: number;
  weakestValue: number;
  benchmarkDelta?: number;
}): FreshUpInterpretationLabel[] {
  let labels: FreshUpInterpretationLabel[] = ['strongest area', 'primary growth area'];
  if (typeof input.benchmarkDelta === 'number') {
    labels = addUniqueLabel(labels, input.benchmarkDelta >= 0 ? 'above average' : 'below average');
  }
  if (input.weakestValue < 55) {
    labels = addUniqueLabel(labels, 'recurring friction');
  }
  return labels;
}

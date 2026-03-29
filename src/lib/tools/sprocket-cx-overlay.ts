import type { User } from '@/lib/definitions';
import { readUserCxStatScore } from '@/lib/tools/cx-stats';

type CxScoreKey = 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationship';

const CX_LABEL: Record<CxScoreKey, string> = {
  empathy: 'Empathy',
  listening: 'Listening',
  trust: 'Trust',
  followUp: 'Follow-Up',
  closing: 'Closing',
  relationship: 'Relationship',
};

const CX_COACHING: Record<CxScoreKey, string> = {
  empathy: 'Use one reflective line before asking for movement.',
  listening: 'Lead with a concise question, then mirror their exact language once.',
  trust: 'Add transparency and proof language before asking for commitment.',
  followUp: 'Set one explicit next step with a time-bound follow-up.',
  closing: 'Use a single clear commitment ask after confirming fit.',
  relationship: 'Reinforce long-term value and customer ownership in the next step.',
};

const TARGET_KEYS = [
  'deliveryCoaching',
  'sharperNextMove',
  'betterReframe',
  'smarterCadenceShift',
  'messageRewriteTip',
  'naturalRewrite',
  'likelyIssue',
  'probableReality',
  'tailoredReason',
] as const;

export function applySprocketCxOverlay<T>(output: T, user?: User | null): T {
  if (!output || typeof output !== 'object') return output;
  if (!user?.hasAutoDriveCX) return output;

  const scores: Record<CxScoreKey, number> = {
    empathy: readUserCxStatScore(user, 'empathy'),
    listening: readUserCxStatScore(user, 'listening'),
    trust: readUserCxStatScore(user, 'trust'),
    followUp: readUserCxStatScore(user, 'followUp'),
    closing: readUserCxStatScore(user, 'closing'),
    relationship: readUserCxStatScore(user, 'relationship'),
  };

  const weakest = (Object.keys(scores) as CxScoreKey[])
    .sort((a, b) => scores[a] - scores[b])[0];

  const weakestScore = scores[weakest];
  if (weakestScore >= 60) return output;

  const appendLine = `CX signal: ${CX_LABEL[weakest]} is low (${Math.round(weakestScore)}). ${CX_COACHING[weakest]}`;
  const clone = { ...(output as Record<string, unknown>) };

  for (const key of TARGET_KEYS) {
    const current = clone[key];
    if (typeof current !== 'string' || !current.trim()) continue;
    if (current.includes('CX signal:')) return output;
    clone[key] = `${current} ${appendLine}`;
    return clone as T;
  }

  return output;
}

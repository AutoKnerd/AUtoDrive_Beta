import type { Ratings } from '@/lib/definitions';
import { clampRatings } from '@/lib/stats/updateRollingStats';

export type BehaviorViolationAssessment = {
  violated: boolean;
  severity: 'normal' | 'behavior_violation';
  score: number;
  flags: string[];
  adjustedXpAwarded?: number;
  adjustedRatings?: Ratings;
};

type AssessmentInput = {
  userMessages: string[];
  ratings?: Partial<Ratings>;
  xpAwarded: number;
};

const PROFANITY_PATTERNS: RegExp[] = [
  /\bfuck(?:ing|ed|er|s)?\b/i,
  /\bshit(?:ty|s)?\b/i,
  /\bbitch(?:es)?\b/i,
  /\basshole\b/i,
  /\bdick\b/i,
  /\bmotherfucker\b/i,
];

const HARASSMENT_PATTERNS: RegExp[] = [
  /\byou(?:'re| are)?\s+(?:an?\s+)?(?:idiot|moron|stupid|dumb|pathetic|useless)\b/i,
  /\bshut\s+up\b/i,
  /\byou\s+suck\b/i,
  /\bthis\s+is\s+stupid\b/i,
];

const THREAT_PATTERNS: RegExp[] = [
  /\b(?:kill|hurt|hit|beat|attack|slap|punch|shoot)\s+(?:you|u|him|her|them)\b/i,
  /\bi\s+will\s+(?:kill|hurt|hit|beat|attack|slap|punch|shoot)\b/i,
];

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => (pattern.test(text) ? count + 1 : count), 0);
}

function uniqueFlags(flags: string[]): string[] {
  return Array.from(new Set(flags));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function assessBehaviorViolation(input: AssessmentInput): BehaviorViolationAssessment {
  const combined = input.userMessages.join('\n').toLowerCase();
  if (!combined.trim()) {
    return {
      violated: false,
      severity: 'normal',
      score: 0,
      flags: [],
    };
  }

  const profanityHits = countMatches(combined, PROFANITY_PATTERNS);
  const harassmentHits = countMatches(combined, HARASSMENT_PATTERNS);
  const threatHits = countMatches(combined, THREAT_PATTERNS);

  const flags: string[] = [];
  if (profanityHits > 0) flags.push('profanity');
  if (harassmentHits > 0) flags.push('harassment');
  if (threatHits > 0) flags.push('threatening_language');

  const weightedScore =
    profanityHits * 0.18 +
    harassmentHits * 0.35 +
    threatHits * 0.6;

  const score = clampScore(weightedScore);
  const violated = score >= 0.25;

  if (!violated) {
    return {
      violated: false,
      severity: 'normal',
      score,
      flags: uniqueFlags(flags),
    };
  }

  const safeRatings = clampRatings(input.ratings);
  const ratingReduction = 30 + score * 35;

  const adjustedRatings: Ratings = {
    empathy: Math.max(0, safeRatings.empathy - ratingReduction),
    listening: Math.max(0, safeRatings.listening - ratingReduction),
    trust: Math.max(0, safeRatings.trust - ratingReduction),
    followUp: Math.max(0, safeRatings.followUp - ratingReduction),
    closing: Math.max(0, safeRatings.closing - ratingReduction),
    relationship: Math.max(0, safeRatings.relationship - ratingReduction),
  };

  const adjustedXpAwarded = -Math.round(20 + score * 40);

  return {
    violated: true,
    severity: 'behavior_violation',
    score,
    flags: uniqueFlags(flags),
    adjustedXpAwarded,
    adjustedRatings,
  };
}

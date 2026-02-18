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

const VIOLATION_THRESHOLD = 0.35;
const MAX_XP_PENALTY = 100;
const MIN_XP_PENALTY = 10;

const PROFANITY_PATTERNS: RegExp[] = [
  /\bfuck(?:ing|ed|er|s)?\b/i,
  /\bshit(?:ty|s)?\b/i,
  /\bbullshit\b/i,
  /\bcrap\b/i,
  /\bbitch(?:es)?\b/i,
  /\bass(?:hole)?\b/i,
  /\bdick(?:head)?\b/i,
  /\bmotherfucker\b/i,
];

const HARASSMENT_PATTERNS: RegExp[] = [
  /\byou(?:'re| are)?\s+(?:an?\s+)?(?:idiot|moron|stupid|dumb|pathetic|useless)\b/i,
  /\byou(?:'re| are)\s+(?:trash|garbage|worthless)\b/i,
  /\bshut\s+up\b/i,
  /\byou\s+suck\b/i,
  /\bfuck\s+you\b/i,
];

const LESSON_CONTEMPT_PATTERNS: RegExp[] = [
  /\b(?:this|your)\s+(?:lesson|training|class|content)\s+(?:is|was)\s+(?:stupid|dumb|garbage|trash|pointless|useless|bullshit)\b/i,
  /\b(?:waste|wasting)\s+(?:my|our)\s+time\b/i,
  /\b(?:this|that)\s+is\s+(?:bullshit|garbage|trash)\b/i,
];

const THREAT_PATTERNS: RegExp[] = [
  /\b(?:kill|hurt|hit|beat|attack|slap|punch|shoot)\s+(?:you|u|him|her|them)\b/i,
  /\bi\s+will\s+(?:kill|hurt|hit|beat|attack|slap|punch|shoot)\b/i,
];

function toGlobalPattern(pattern: RegExp): RegExp {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return new RegExp(pattern.source, flags);
}

function countMatches(text: string, patterns: RegExp[]): number {
  return patterns.reduce((count, pattern) => {
    const globalPattern = toGlobalPattern(pattern);
    return count + Array.from(text.matchAll(globalPattern)).length;
  }, 0);
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
  const lessonContemptHits = countMatches(combined, LESSON_CONTEMPT_PATTERNS);
  const threatHits = countMatches(combined, THREAT_PATTERNS);

  const flags: string[] = [];
  if (profanityHits > 0) flags.push('profanity');
  if (harassmentHits > 0) flags.push('harassment');
  if (lessonContemptHits > 0) flags.push('lesson_disrespect');
  if (threatHits > 0) flags.push('threatening_language');

  const totalHits = profanityHits + harassmentHits + lessonContemptHits + threatHits;
  const repetitionBoost = totalHits >= 4 ? 0.2 : totalHits >= 2 ? 0.1 : 0;
  const weightedScore =
    profanityHits * 0.12 +
    harassmentHits * 0.3 +
    lessonContemptHits * 0.25 +
    threatHits * 0.75 +
    repetitionBoost;

  const score = clampScore(weightedScore);
  const violated = threatHits > 0 || score >= VIOLATION_THRESHOLD;

  if (!violated) {
    return {
      violated: false,
      severity: 'normal',
      score,
      flags: uniqueFlags(flags),
    };
  }

  const safeRatings = clampRatings(input.ratings);
  const normalizedSeverity = clampScore((score - VIOLATION_THRESHOLD) / (1 - VIOLATION_THRESHOLD));
  const ratingReduction = 20 + normalizedSeverity * 50;

  const adjustedRatings: Ratings = {
    empathy: Math.max(0, safeRatings.empathy - ratingReduction),
    listening: Math.max(0, safeRatings.listening - ratingReduction),
    trust: Math.max(0, safeRatings.trust - ratingReduction),
    followUp: Math.max(0, safeRatings.followUp - ratingReduction),
    closing: Math.max(0, safeRatings.closing - ratingReduction),
    relationship: Math.max(0, safeRatings.relationship - ratingReduction),
  };

  const penaltyMagnitude = Math.round(
    Math.max(
      MIN_XP_PENALTY,
      Math.min(MAX_XP_PENALTY, MIN_XP_PENALTY + normalizedSeverity * (MAX_XP_PENALTY - MIN_XP_PENALTY))
    )
  );
  const adjustedXpAwarded = -penaltyMagnitude;

  return {
    violated: true,
    severity: 'behavior_violation',
    score,
    flags: uniqueFlags(flags),
    adjustedXpAwarded,
    adjustedRatings,
  };
}

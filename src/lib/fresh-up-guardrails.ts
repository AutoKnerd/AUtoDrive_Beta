import type { FreshUpEndingType, FreshUpOutcomeTag, FreshUpProfile } from '@/lib/definitions';

export type FreshUpValidationFailureReason =
  | 'unrealistic_opening'
  | 'unrealistic_ending'
  | 'repetitive_structure'
  | 'weak_coaching_value'
  | 'too_absurd'
  | 'too_hostile'
  | 'memory_error'
  | 'low_variety'
  | 'unnatural_tone';

export type FreshUpContentValidationResult = {
  contentValidationPassed: boolean;
  validationFailureReasons: FreshUpValidationFailureReason[];
  guardrailFlags: FreshUpValidationFailureReason[];
};

const TRACKED_SKILLS = new Set(['empathy', 'listening', 'trust', 'follow up', 'follow_up', 'followup', 'closing', 'relationship', 'relationship building']);
const AI_SOURCING_PATTERNS = ['as an ai', 'language model', 'prompt', 'template', 'instruction'];
const HOSTILITY_PATTERNS = ['idiot', 'stupid', 'shut up', 'worthless', 'hate you'];

function normalize(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function countSentences(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .length;
}

function wordCount(text: string): number {
  return text
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .length;
}

function includesAny(text: string, patterns: string[]): boolean {
  const normalized = normalize(text);
  return patterns.some((pattern) => normalized.includes(pattern));
}

function hasCoachingValue(profile: FreshUpProfile): boolean {
  return profile.skillsTested.some((skill) => TRACKED_SKILLS.has(normalize(skill)));
}

function isHumorOverreach(profile: FreshUpProfile, opening: string): boolean {
  if (profile.humorLevel < 2) return false;
  const exclamationCount = (opening.match(/!/g) || []).length;
  const hasTooManyPunchlines = (opening.match(/\b(joke|lol|haha|funny)\b/gi) || []).length >= 3;
  return exclamationCount >= 4 || hasTooManyPunchlines;
}

function isPotentiallyHostile(opening: string): boolean {
  return includesAny(opening, HOSTILITY_PATTERNS);
}

export function validateFreshUpOpeningGuardrails(input: {
  profile: FreshUpProfile;
  openingMessage: string;
  recentProfiles?: Array<Pick<FreshUpProfile, 'archetypeId' | 'archetypeCategory' | 'primaryConcern'>>;
}): FreshUpContentValidationResult {
  const reasons = new Set<FreshUpValidationFailureReason>();
  const opening = input.openingMessage.trim();
  const openingWordCount = wordCount(opening);
  const sentenceCount = countSentences(opening);

  if (openingWordCount < 8 || openingWordCount > 65 || sentenceCount < 1 || sentenceCount > 3) {
    reasons.add('unrealistic_opening');
  }
  if (includesAny(opening, AI_SOURCING_PATTERNS)) {
    reasons.add('unnatural_tone');
  }
  if (isHumorOverreach(input.profile, opening)) {
    reasons.add('too_absurd');
  }
  if (isPotentiallyHostile(opening)) {
    reasons.add('too_hostile');
  }
  if (!hasCoachingValue(input.profile)) {
    reasons.add('weak_coaching_value');
  }

  const recent = input.recentProfiles ?? [];
  if (recent.length > 0) {
    const repeatedArchetype = recent.slice(0, 3).every((profile) => profile.archetypeId === input.profile.archetypeId);
    const repeatedConcern = recent.slice(0, 3).every((profile) => normalize(profile.primaryConcern) === normalize(input.profile.primaryConcern));
    if (repeatedArchetype || repeatedConcern) {
      reasons.add('low_variety');
      reasons.add('repetitive_structure');
    }
  }

  return {
    contentValidationPassed: reasons.size === 0,
    validationFailureReasons: Array.from(reasons),
    guardrailFlags: Array.from(reasons),
  };
}

export function validateFreshUpEndingGuardrails(input: {
  profile: FreshUpProfile;
  endingType: FreshUpEndingType;
  outcomeTag: FreshUpOutcomeTag;
  finalCustomerResponse: string;
  trustShift?: number;
}): FreshUpContentValidationResult {
  const reasons = new Set<FreshUpValidationFailureReason>();
  const endingLine = input.finalCustomerResponse.trim();
  const endingWords = wordCount(endingLine);

  if (endingWords < 6 || endingWords > 45) {
    reasons.add('unrealistic_ending');
  }
  if (includesAny(endingLine, AI_SOURCING_PATTERNS)) {
    reasons.add('unnatural_tone');
  }

  const shift = Number.isFinite(Number(input.trustShift)) ? Number(input.trustShift) : 0;
  if ((input.endingType === 'appointment_ready' || input.outcomeTag === 'Appointment Set') && shift < 0) {
    reasons.add('unrealistic_ending');
  }
  if ((input.endingType === 'trust_break' || input.outcomeTag === 'Conversation Breakdown') && shift > 10) {
    reasons.add('unrealistic_ending');
  }
  if (!hasCoachingValue(input.profile)) {
    reasons.add('weak_coaching_value');
  }

  return {
    contentValidationPassed: reasons.size === 0,
    validationFailureReasons: Array.from(reasons),
    guardrailFlags: Array.from(reasons),
  };
}

export function mergeFreshUpValidationResults(results: FreshUpContentValidationResult[]): FreshUpContentValidationResult {
  const reasons = new Set<FreshUpValidationFailureReason>();
  results.forEach((result) => result.validationFailureReasons.forEach((reason) => reasons.add(reason)));
  const merged = Array.from(reasons);
  return {
    contentValidationPassed: merged.length === 0,
    validationFailureReasons: merged,
    guardrailFlags: merged,
  };
}

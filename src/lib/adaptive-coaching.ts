import type { CxTrait } from '@/lib/definitions';

export type AdaptiveSkillKey = 'empathy' | 'listening' | 'trust' | 'relationship' | 'closing';

export type AdaptiveLessonSuggestion = {
  skill: AdaptiveSkillKey;
  skillLabel: string;
  recommendedLessonTitle: string;
  estimatedMinutes: number;
  associatedTrait: CxTrait;
};

export const ADAPTIVE_GAP_THRESHOLD = 60;
export const ADAPTIVE_IMPROVEMENT_TARGET = 10;
export const ADAPTIVE_MONITORING_WINDOW = 3;
export const ADAPTIVE_RECOMMENDATION_COOLDOWN_HOURS = 48;

export const ADAPTIVE_LESSON_MAP: Record<AdaptiveSkillKey, AdaptiveLessonSuggestion> = {
  empathy: {
    skill: 'empathy',
    skillLabel: 'Empathy',
    recommendedLessonTitle: 'Understanding Customer Emotions',
    estimatedMinutes: 3,
    associatedTrait: 'empathy',
  },
  listening: {
    skill: 'listening',
    skillLabel: 'Listening',
    recommendedLessonTitle: 'Active Listening Techniques',
    estimatedMinutes: 3,
    associatedTrait: 'listening',
  },
  trust: {
    skill: 'trust',
    skillLabel: 'Trust Building',
    recommendedLessonTitle: 'Building Trust Through Transparency',
    estimatedMinutes: 3,
    associatedTrait: 'trust',
  },
  relationship: {
    skill: 'relationship',
    skillLabel: 'Relationship Building',
    recommendedLessonTitle: 'Creating Personal Connection',
    estimatedMinutes: 3,
    associatedTrait: 'relationshipBuilding',
  },
  closing: {
    skill: 'closing',
    skillLabel: 'Closing Ability',
    recommendedLessonTitle: 'Guiding the Customer to the Next Step',
    estimatedMinutes: 3,
    associatedTrait: 'closing',
  },
};

export type AdaptiveSkillAverages = Record<AdaptiveSkillKey, number>;

export function emptyAdaptiveSkillAverages(): AdaptiveSkillAverages {
  return { empathy: 0, listening: 0, trust: 0, relationship: 0, closing: 0 };
}

export function toAdaptiveSkillFromTrait(trait: string | null | undefined): AdaptiveSkillKey | null {
  const normalized = String(trait || '').trim().toLowerCase();
  if (normalized === 'empathy') return 'empathy';
  if (normalized === 'listening') return 'listening';
  if (normalized === 'trust') return 'trust';
  if (normalized === 'closing') return 'closing';
  if (normalized === 'relationshipbuilding' || normalized === 'relationship') return 'relationship';
  return null;
}

export function pickLowestGapSkill(averages: AdaptiveSkillAverages): AdaptiveSkillKey | null {
  const rows = (Object.keys(averages) as AdaptiveSkillKey[])
    .map((key) => ({ key, score: averages[key] }))
    .filter((row) => Number.isFinite(row.score) && row.score < ADAPTIVE_GAP_THRESHOLD)
    .sort((a, b) => a.score - b.score);
  return rows[0]?.key ?? null;
}

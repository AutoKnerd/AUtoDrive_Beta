import type { User } from '@/lib/definitions';
import {
  SAAS_PPP_LEVEL_MAX,
  SAAS_PPP_LEVEL_MIN,
  type SaasLeadChannel,
  type SaasPppPhase,
  clampSaasPppLevel,
  getSaasPppLessonsForLevel,
  getSaasPppLevelBadge,
  sanitizeSaasLeadChannel,
} from '@/lib/saas-ppp/definitions';

export type SaasPppLessonsPassed = Record<string, string[]>;

export type SaasPppDefaultFields = Pick<
  User,
  | 'saas_ppp_enabled'
  | 'saas_ppp_level_completed'
  | 'saas_ppp_current_level'
  | 'saas_ppp_current_level_progress'
  | 'saas_ppp_primary_channel'
  | 'saas_ppp_secondary_channel'
  | 'saas_ppp_certified_timestamp'
  | 'saas_ppp_l2_phase'
  | 'saas_ppp_lessons_passed'
  | 'saas_ppp_abandonment_counter'
>;

export type NormalizedSaasPppState = {
  enabled: boolean;
  levelCompleted: number;
  currentLevel: number;
  currentLevelProgress: number;
  primaryChannel: SaasLeadChannel | null;
  secondaryChannel: SaasLeadChannel | null;
  certifiedTimestamp: string | null;
  l2Phase: SaasPppPhase;
  lessonsPassed: SaasPppLessonsPassed;
  abandonmentCounter: number;
  badge: string;
  currentLevelLessonCount: number;
  currentLevelPassedCount: number;
};

export function getSaasPppLevelKey(level: number, phase: SaasPppPhase = 'primary'): string {
  const safe = clampSaasPppLevel(level);
  if (safe === 2) return `lvl2-${phase}`;
  return `lvl${safe}`;
}

function normalizeLessonsPassed(raw: unknown): SaasPppLessonsPassed {
  if (!raw || typeof raw !== 'object') return {};

  const out: SaasPppLessonsPassed = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;
    const cleaned = value
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      .map((entry) => entry.trim());
    out[key] = Array.from(new Set(cleaned));
  }
  return out;
}

function clampPercent(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function clampLevelCompleted(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(SAAS_PPP_LEVEL_MAX, Math.round(numeric)));
}

function sanitizePhase(value: unknown): SaasPppPhase {
  return value === 'secondary' ? 'secondary' : 'primary';
}

export function buildDefaultSaasPppState(enabled: boolean = false): SaasPppDefaultFields {
  return {
    saas_ppp_enabled: enabled,
    saas_ppp_level_completed: 0,
    saas_ppp_current_level: SAAS_PPP_LEVEL_MIN,
    saas_ppp_current_level_progress: 0,
    saas_ppp_primary_channel: '',
    saas_ppp_secondary_channel: null,
    saas_ppp_certified_timestamp: null,
    saas_ppp_l2_phase: 'primary',
    saas_ppp_lessons_passed: { [getSaasPppLevelKey(SAAS_PPP_LEVEL_MIN)]: [] },
    saas_ppp_abandonment_counter: 0,
  };
}

export function normalizeSaasPppUserState(user: User): NormalizedSaasPppState {
  const certifiedTimestamp = typeof user.saas_ppp_certified_timestamp === 'string' && user.saas_ppp_certified_timestamp
    ? user.saas_ppp_certified_timestamp
    : null;

  const levelCompleted = certifiedTimestamp
    ? SAAS_PPP_LEVEL_MAX
    : clampLevelCompleted(user.saas_ppp_level_completed);

  const currentLevel = certifiedTimestamp
    ? SAAS_PPP_LEVEL_MAX
    : clampSaasPppLevel(
        typeof user.saas_ppp_current_level === 'number'
          ? user.saas_ppp_current_level
          : Math.min(SAAS_PPP_LEVEL_MAX, levelCompleted + 1)
      );

  const primaryChannel = sanitizeSaasLeadChannel(user.saas_ppp_primary_channel);
  const secondaryChannel = sanitizeSaasLeadChannel(user.saas_ppp_secondary_channel);
  const l2Phase = sanitizePhase(user.saas_ppp_l2_phase);
  const lessonsPassed = normalizeLessonsPassed(user.saas_ppp_lessons_passed);

  const currentLevelLessons = getSaasPppLessonsForLevel(currentLevel, {
    primaryChannel,
    secondaryChannel,
    phase: currentLevel === 2 ? l2Phase : undefined,
  });

  const levelKey = getSaasPppLevelKey(currentLevel, currentLevel === 2 ? l2Phase : 'primary');
  const passedSet = new Set(lessonsPassed[levelKey] || []);

  const currentLevelPassedCount = currentLevelLessons.reduce((count, lesson) => (
    passedSet.has(lesson.lessonId) ? count + 1 : count
  ), 0);

  const computedProgress = currentLevelLessons.length > 0
    ? Math.round((currentLevelPassedCount / currentLevelLessons.length) * 100)
    : 0;

  return {
    enabled: user.saas_ppp_enabled === true,
    levelCompleted,
    currentLevel,
    currentLevelProgress: clampPercent(user.saas_ppp_current_level_progress ?? computedProgress),
    primaryChannel,
    secondaryChannel,
    certifiedTimestamp,
    l2Phase,
    lessonsPassed,
    abandonmentCounter: Math.max(0, Math.round(Number(user.saas_ppp_abandonment_counter || 0))),
    badge: getSaasPppLevelBadge(currentLevel, certifiedTimestamp),
    currentLevelLessonCount: currentLevelLessons.length,
    currentLevelPassedCount,
  };
}

export function getNextSaasPppLevel(level: number): number {
  const safe = clampSaasPppLevel(level);
  if (safe >= SAAS_PPP_LEVEL_MAX) return SAAS_PPP_LEVEL_MAX;
  return safe + 1;
}


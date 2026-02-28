import type { User } from '@/lib/definitions';
import {
  PPP_DAILY_PASS_LIMIT,
  PPP_LEVEL_MIN,
  PPP_LEVEL_MAX,
  clampPppLevel,
  getPppLessonsForLevel,
  getPppLevelBadge,
} from '@/lib/ppp/definitions';

export type PppLessonsPassedByLevel = Record<string, string[]>;

export type PppDefaultFields = Pick<
  User,
  | 'ppp_enabled'
  | 'ppp_level'
  | 'ppp_lessons_passed'
  | 'ppp_progress_percentage'
  | 'ppp_badge'
  | 'ppp_abandonment_counter'
  | 'ppp_certified'
  | 'ppp_daily_pass_date'
  | 'ppp_daily_pass_count'
>;

export type NormalizedPppState = {
  enabled: boolean;
  level: number;
  lessonsPassed: PppLessonsPassedByLevel;
  progressPercentage: number;
  badge: string;
  abandonmentCounter: number;
  certified: boolean;
  dailyPassDate: string;
  dailyPassCount: number;
  dailyPassRemaining: number;
  dailyLimitReached: boolean;
  currentLevelLessonCount: number;
  currentLevelPassedCount: number;
};

export function getPppUtcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getPppLevelKey(level: number): string {
  return `lvl${clampPppLevel(level)}`;
}

export function buildDefaultPppState(enabled: boolean = false): PppDefaultFields {
  return {
    ppp_enabled: enabled,
    ppp_level: PPP_LEVEL_MIN,
    ppp_lessons_passed: { [getPppLevelKey(PPP_LEVEL_MIN)]: [] },
    ppp_progress_percentage: 0,
    ppp_badge: `ppp-lvl-${PPP_LEVEL_MIN}`,
    ppp_abandonment_counter: 0,
    ppp_certified: false,
    ppp_daily_pass_date: '',
    ppp_daily_pass_count: 0,
  };
}

function normalizeLessonsPassed(raw: unknown): PppLessonsPassedByLevel {
  if (!raw || typeof raw !== 'object') return {};

  const out: PppLessonsPassedByLevel = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(value)) continue;

    const cleaned = value
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());

    out[key] = Array.from(new Set(cleaned));
  }

  return out;
}

function clampPercent(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function normalizePppUserState(user: User): NormalizedPppState {
  const level = clampPppLevel(typeof user.ppp_level === 'number' ? user.ppp_level : PPP_LEVEL_MIN);
  const lessonsPassed = normalizeLessonsPassed(user.ppp_lessons_passed);
  const currentLevelLessons = getPppLessonsForLevel(level, user.role);
  const currentLevelKey = getPppLevelKey(level);
  const currentPassed = new Set(lessonsPassed[currentLevelKey] || []);

  const currentLevelPassedCount = currentLevelLessons.reduce((count, lesson) => (
    currentPassed.has(lesson.lessonId) ? count + 1 : count
  ), 0);

  const computedProgress = currentLevelLessons.length > 0
    ? Math.round((currentLevelPassedCount / currentLevelLessons.length) * 100)
    : 0;

  const certified = user.ppp_certified === true;
  const dailyPassDate = typeof user.ppp_daily_pass_date === 'string' ? user.ppp_daily_pass_date : '';
  const rawDailyPassCount = Math.max(0, Math.round(Number(user.ppp_daily_pass_count || 0)));
  const todayKey = getPppUtcDateKey();
  const dailyPassCount = dailyPassDate === todayKey ? rawDailyPassCount : 0;
  const dailyPassRemaining = Math.max(0, PPP_DAILY_PASS_LIMIT - dailyPassCount);

  return {
    enabled: user.ppp_enabled === true,
    level,
    lessonsPassed,
    progressPercentage: clampPercent(user.ppp_progress_percentage ?? computedProgress),
    badge: typeof user.ppp_badge === 'string'
      ? user.ppp_badge
      : getPppLevelBadge(level, certified),
    abandonmentCounter: Math.max(0, Math.round(Number(user.ppp_abandonment_counter || 0))),
    certified,
    dailyPassDate,
    dailyPassCount,
    dailyPassRemaining,
    dailyLimitReached: dailyPassRemaining === 0,
    currentLevelLessonCount: currentLevelLessons.length,
    currentLevelPassedCount,
  };
}

export function getNextPppLevel(level: number): number {
  const safe = clampPppLevel(level);
  if (safe >= PPP_LEVEL_MAX) return PPP_LEVEL_MAX;
  return safe + 1;
}

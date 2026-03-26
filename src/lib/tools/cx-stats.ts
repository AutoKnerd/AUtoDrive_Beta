import type { User } from '@/lib/definitions';

const DEFAULT_CX_STAT_SCORE = 60;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toFiniteNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function readCxStatScore(stat: unknown, fallback: number = DEFAULT_CX_STAT_SCORE): number {
  const fallbackSafe = clamp(
    Number.isFinite(fallback) ? fallback : DEFAULT_CX_STAT_SCORE,
    0,
    100
  );

  const direct = toFiniteNumber(stat);
  if (direct !== null) return clamp(direct, 0, 100);

  if (stat && typeof stat === 'object') {
    const score = toFiniteNumber((stat as { score?: unknown }).score);
    if (score !== null) return clamp(score, 0, 100);
  }

  return fallbackSafe;
}

export function readCxStatScoreOrNull(stat: unknown): number | null {
  const direct = toFiniteNumber(stat);
  if (direct !== null) return clamp(direct, 0, 100);

  if (stat && typeof stat === 'object') {
    const score = toFiniteNumber((stat as { score?: unknown }).score);
    if (score !== null) return clamp(score, 0, 100);
  }

  return null;
}

export function readUserCxStatScore(
  user: User | null | undefined,
  key: 'empathy' | 'listening' | 'trust' | 'followUp' | 'closing' | 'relationship',
  fallback: number = DEFAULT_CX_STAT_SCORE
): number {
  if (!user?.stats) return fallback;

  if (key === 'relationship') {
    const relationship = readCxStatScoreOrNull((user.stats as Record<string, unknown>).relationship);
    if (relationship !== null) return relationship;
    return readCxStatScore((user.stats as Record<string, unknown>).relationshipBuilding, fallback);
  }

  return readCxStatScore((user.stats as Record<string, unknown>)[key], fallback);
}

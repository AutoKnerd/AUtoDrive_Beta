import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase/init';
import type { RatingKey, Ratings, UserStats } from '@/lib/definitions';

export const BASELINE = 60;
export const LAMBDA = Math.log(2) / 30;
export const MIN_CX_AGGRESSIVENESS = 5;
export const MAX_CX_AGGRESSIVENESS = 60;
export const DEFAULT_CX_AGGRESSIVENESS = 25;
export const DEFAULT_CX_DELTA_GAIN = DEFAULT_CX_AGGRESSIVENESS / 100;
export const MAX_CX_DELTA_PER_LESSON = 10;

const MIN_SCORE = 0;
const MAX_SCORE = 100;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STAT_KEYS: RatingKey[] = [
  'empathy',
  'listening',
  'trust',
  'followUp',
  'closing',
  'relationship',
];

export type RollingStatScores = Record<RatingKey, number>;

export type RollingStatsUpdateResult = {
  before: RollingStatScores;
  after: RollingStatScores;
  updatedAt: Date;
};

type UpdateRollingStatsOptions = {
  weightMultiplier?: number;
};

function clamp(value: number, min: number = MIN_SCORE, max: number = MAX_SCORE): number {
  return Math.min(max, Math.max(min, value));
}

function clampDelta(value: number): number {
  return Math.max(-MAX_CX_DELTA_PER_LESSON, Math.min(MAX_CX_DELTA_PER_LESSON, value));
}

export function normalizeCxAggressiveness(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_CX_AGGRESSIVENESS;
  return Math.max(MIN_CX_AGGRESSIVENESS, Math.min(MAX_CX_AGGRESSIVENESS, Math.round(numeric)));
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (value && typeof value === 'object') {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp.toDate === 'function') {
      const converted = maybeTimestamp.toDate();
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted;
      }
    }
  }

  return null;
}

function getDefaultRatings(): Ratings {
  return {
    empathy: BASELINE,
    listening: BASELINE,
    trust: BASELINE,
    followUp: BASELINE,
    closing: BASELINE,
    relationship: BASELINE,
  };
}

export function clampRatings(ratings: Partial<Ratings> | null | undefined): Ratings {
  const input = ratings ?? {};
  const defaults = getDefaultRatings();

  return {
    empathy: clamp(toFiniteNumber(input.empathy, defaults.empathy)),
    listening: clamp(toFiniteNumber(input.listening, defaults.listening)),
    trust: clamp(toFiniteNumber(input.trust, defaults.trust)),
    followUp: clamp(toFiniteNumber(input.followUp, defaults.followUp)),
    closing: clamp(toFiniteNumber(input.closing, defaults.closing)),
    relationship: clamp(toFiniteNumber(input.relationship, defaults.relationship)),
  };
}

export async function updateRollingStats(
  userId: string,
  ratings: Ratings,
  options?: UpdateRollingStatsOptions
): Promise<RollingStatsUpdateResult> {
  if (!userId) {
    throw new Error('updateRollingStats requires a userId');
  }

  const { firestore: db } = initializeFirebase();
  const userRef = doc(db, 'users', userId);
  const now = new Date();
  const nowTimestamp = Timestamp.fromDate(now);
  const safeRatings = clampRatings(ratings);
  const weightMultiplier = Math.max(0.5, Math.min(2, Number(options?.weightMultiplier ?? 1)));

  return runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists()) {
      throw new Error(`User ${userId} not found`);
    }

    const userData = userSnap.data() ?? {};
    const rawStats = (userData.stats ?? {}) as Partial<
      Record<RatingKey, { score?: unknown; lastUpdated?: unknown }>
    >;
    let deltaGain = DEFAULT_CX_DELTA_GAIN;
    try {
      const cxConfigRef = doc(db, 'systemSettings', 'cx');
      const cxConfigSnap = await transaction.get(cxConfigRef);
      const aggressiveness = normalizeCxAggressiveness(cxConfigSnap.data()?.aggressiveness);
      deltaGain = aggressiveness / 100;
    } catch {
      // Fallback to default aggressiveness when system settings are unavailable.
    }

    const nextStats = {} as UserStats;
    const beforeScores = {} as RollingStatScores;
    const afterScores = {} as RollingStatScores;

    for (const key of STAT_KEYS) {
      const current = rawStats[key];
      const currentScore = clamp(toFiniteNumber(current?.score, BASELINE));
      const currentWhole = Math.round(currentScore);
      const lastUpdated = toDate(current?.lastUpdated) ?? now;
      const deltaDays = Math.max(0, (now.getTime() - lastUpdated.getTime()) / MS_PER_DAY);

      const driftedScore = BASELINE + (currentWhole - BASELINE) * Math.exp(-LAMBDA * deltaDays);
      const driftDelta = driftedScore - currentWhole;
      const ratingDelta = safeRatings[key] - currentWhole;
      const rawDelta = driftDelta + ratingDelta * deltaGain * weightMultiplier;
      const stepDelta = clampDelta(Math.round(rawDelta));
      const updatedScore = clamp(currentWhole + stepDelta);

      nextStats[key] = {
        score: updatedScore,
        lastUpdated: nowTimestamp,
      };
      beforeScores[key] = currentWhole;
      afterScores[key] = updatedScore;
    }

    transaction.set(
      userRef,
      {
        stats: nextStats,
      },
      { merge: true }
    );

    return {
      before: beforeScores,
      after: afterScores,
      updatedAt: now,
    };
  });
}

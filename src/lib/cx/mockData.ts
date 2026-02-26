import { subDays, format, startOfDay } from 'date-fns';
import { CxSkillId, CX_SKILLS } from './skills';

export interface CxDataPoint {
  date: string;
  scores: Record<CxSkillId, number>;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

const MOCK_CACHE: Record<string, CxDataPoint[]> = {};
const DEFAULT_FALLBACK_SCORE = 60;
const MAX_ANCHORED_DEVIATION = 12;

function resolveAnchoredScore(anchorScores: Partial<Record<CxSkillId, number>> | undefined, skillId: CxSkillId): number {
  const raw = anchorScores?.[skillId];
  const numeric = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(numeric)) return DEFAULT_FALLBACK_SCORE;
  return clampScore(numeric);
}

function hashSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateAnchoredTrend(target: number, length: number, seedKey: string): number[] {
  if (length <= 1) return [clampScore(target)];

  const rand = seededRandom(hashSeed(seedKey));
  const windowFactor = Math.min(1.8, Math.max(0.8, length / 30));
  const startOffset = (rand() - 0.5) * (10 * windowFactor);
  const midOffset = (rand() - 0.5) * (7 * windowFactor);
  const waveAmplitude = (1.4 + rand() * 2.4) * windowFactor;
  const waveFrequency = 0.8 + rand() * 1.2;
  const phase = rand() * Math.PI * 2;

  const start = target + startOffset;
  const control = target + midOffset;
  const series: number[] = [];

  for (let i = 0; i < length; i++) {
    const t = i / (length - 1);
    const curve = (
      (1 - t) * (1 - t) * start +
      2 * (1 - t) * t * control +
      t * t * target
    );
    const wave = Math.sin(phase + t * Math.PI * 2 * waveFrequency) * waveAmplitude * (1 - t * 0.8);
    const noise = (rand() - 0.5) * 0.8 * (1 - t);
    const raw = curve + wave + noise;
    const bounded = Math.max(target - MAX_ANCHORED_DEVIATION, Math.min(target + MAX_ANCHORED_DEVIATION, raw));
    series.push(clampScore(bounded));
  }

  // Always end exactly on the anchored/current score.
  series[length - 1] = clampScore(target);
  return series;
}

export function getMockCxTrend(id: string, days: number = 90, anchorScores?: Partial<Record<CxSkillId, number>>): CxDataPoint[] {
  const anchorKey = anchorScores ? JSON.stringify(anchorScores) : 'no-anchor';
  const cacheKey = `${id}-${days}-${anchorKey}`;
  
  if (MOCK_CACHE[cacheKey]) return MOCK_CACHE[cacheKey];

  const data: CxDataPoint[] = [];
  const skillTrends = CX_SKILLS.reduce((acc, skill) => {
    const target = resolveAnchoredScore(anchorScores, skill.id);
    acc[skill.id] = generateAnchoredTrend(target, days, `${id}-${skill.id}-${anchorKey}-${days}`);
    return acc;
  }, {} as Record<CxSkillId, number[]>);

  for (let i = 0; i < days; i++) {
    const date = format(subDays(startOfDay(new Date()), days - 1 - i), 'yyyy-MM-dd');
    const scores = CX_SKILLS.reduce((acc, skill) => {
      acc[skill.id] = skillTrends[skill.id][i];
      return acc;
    }, {} as Record<CxSkillId, number>);
    data.push({ date, scores });
  }

  MOCK_CACHE[cacheKey] = data;
  return data;
}

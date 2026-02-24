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

/**
 * Generates a random trend that is anchored to a specific target value at the end.
 */
function generateTrend(base: number, volatility: number, length: number, target?: number): number[] {
  const points = [clampScore(base)];
  for (let i = 1; i < length; i++) {
    const prev = points[i - 1];
    const change = (Math.random() - 0.5) * volatility;
    points.push(clampScore(prev + change));
  }

  // If a target is provided, adjust the series so it ends exactly at the target
  if (target !== undefined) {
    if (length <= 1) {
      return [clampScore(target)];
    }

    const currentEnd = points[points.length - 1];
    const diff = target - currentEnd;
    // Distribute the difference linearly across the points
    return points.map((p, i) => clampScore(p + (diff * (i / (length - 1)))));
  }

  return points.map(clampScore);
}

const MOCK_CACHE: Record<string, CxDataPoint[]> = {};

export function getMockCxTrend(id: string, days: number = 90, anchorScores?: Partial<Record<CxSkillId, number>>): CxDataPoint[] {
  const anchorKey = anchorScores ? JSON.stringify(anchorScores) : 'no-anchor';
  const cacheKey = `${id}-${days}-${anchorKey}`;
  
  if (MOCK_CACHE[cacheKey]) return MOCK_CACHE[cacheKey];

  const data: CxDataPoint[] = [];
  const skillTrends: Record<CxSkillId, number[]> = {} as any;

  CX_SKILLS.forEach((skill, idx) => {
    const target = anchorScores?.[skill.id];
    
    // Spread the base scores out significantly more vertically to fill the chart area
    const base = target !== undefined 
      ? clampScore(target + (Math.random() - 0.5) * 50)
      : clampScore(15 + idx * 18 + (Math.random() * 20));
      
    // Higher volatility (22) ensures the lines "spread out" and fill the empty space with energy
    skillTrends[skill.id] = generateTrend(base, 22, days, target);
  });

  for (let i = 0; i < days; i++) {
    const date = format(subDays(startOfDay(new Date()), days - 1 - i), 'yyyy-MM-dd');
    const scores: any = {};
    CX_SKILLS.forEach((skill) => {
      scores[skill.id] = skillTrends[skill.id][i];
    });
    data.push({ date, scores });
  }

  MOCK_CACHE[cacheKey] = data;
  return data;
}

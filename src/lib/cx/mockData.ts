import { subDays, format, startOfDay } from 'date-fns';
import { CxSkillId, CX_SKILLS } from './skills';

export interface CxDataPoint {
  date: string;
  scores: Record<CxSkillId, number>;
}

/**
 * Generates a random trend that is anchored to a specific target value at the end.
 */
function generateTrend(base: number, volatility: number, length: number, target?: number): number[] {
  const points = [base];
  for (let i = 1; i < length; i++) {
    const prev = points[i - 1];
    const change = (Math.random() - 0.5) * volatility;
    points.push(Math.max(20, Math.min(100, prev + change)));
  }

  // If a target is provided, adjust the series so it ends exactly at the target
  if (target !== undefined && length > 1) {
    const currentEnd = points[points.length - 1];
    const diff = target - currentEnd;
    // Distribute the difference linearly across the points
    return points.map((p, i) => Math.max(0, Math.min(100, p + (diff * (i / (length - 1))))));
  }

  return points;
}

const MOCK_CACHE: Record<string, CxDataPoint[]> = {};

export function getMockCxTrend(id: string, days: number = 90, anchorScores?: Partial<Record<CxSkillId, number>>): CxDataPoint[] {
  // We include the anchor scores in the cache key to ensure we recalculate if they change
  const anchorKey = anchorScores ? JSON.stringify(anchorScores) : 'no-anchor';
  const cacheKey = `${id}-${days}-${anchorKey}`;
  
  if (MOCK_CACHE[cacheKey]) return MOCK_CACHE[cacheKey];

  const data: CxDataPoint[] = [];
  const skillTrends: Record<CxSkillId, number[]> = {} as any;

  CX_SKILLS.forEach((skill, idx) => {
    // Determine a reasonable starting point based on the anchor or a random base
    const target = anchorScores?.[skill.id];
    const base = target !== undefined 
      ? Math.max(20, Math.min(100, target + (Math.random() - 0.5) * 20))
      : 65 + idx * 4 + (Math.random() * 5);
      
    skillTrends[skill.id] = generateTrend(base, 6, days, target);
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

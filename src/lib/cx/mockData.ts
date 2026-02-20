import { subDays, format, startOfDay } from 'date-fns';
import { CxSkillId, CX_SKILLS } from './skills';

export interface CxDataPoint {
  date: string;
  scores: Record<CxSkillId, number>;
}

function generateTrend(base: number, volatility: number, length: number): number[] {
  const points = [base];
  for (let i = 1; i < length; i++) {
    const prev = points[i - 1];
    const change = (Math.random() - 0.5) * volatility;
    points.push(Math.max(40, Math.min(100, prev + change)));
  }
  return points;
}

const MOCK_CACHE: Record<string, CxDataPoint[]> = {};

export function getMockCxTrend(id: string, days: number = 90): CxDataPoint[] {
  const cacheKey = `${id}-${days}`;
  if (MOCK_CACHE[cacheKey]) return MOCK_CACHE[cacheKey];

  const data: CxDataPoint[] = [];
  const skillTrends: Record<CxSkillId, number[]> = {} as any;

  CX_SKILLS.forEach((skill, idx) => {
    // Different bases for different skills to create visual separation
    const base = 65 + idx * 4 + (Math.random() * 5);
    skillTrends[skill.id] = generateTrend(base, 4, days);
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

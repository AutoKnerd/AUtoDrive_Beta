import { CxDataPoint, getMockCxTrend } from './mockData';
import { CxScope, getComparisonScope } from './scope';
import { CX_SKILLS, CxSkillId } from './skills';

export interface CxPoint {
  date: string;
  foreground: number;
  baseline: number;
}

export interface CxSeries {
  skillId: CxSkillId;
  label: string;
  color: string;
  points: CxPoint[];
}

export function rollupCxTrend(
  scope: CxScope, 
  days: number = 30, 
  anchorScores?: Partial<Record<CxSkillId, number>>
): CxSeries[] {
  // Use real data anchoring for the foreground if provided
  const fgData = getMockCxTrend(scope.userId || scope.storeId || scope.orgId, days, anchorScores);
  
  const comparison = getComparisonScope(scope);
  // For the baseline comparison, we don't anchor it to the same values (to show the "valley" delta)
  const bgData = comparison 
    ? getMockCxTrend(comparison.userId || comparison.storeId || comparison.orgId, days)
    : null;

  return CX_SKILLS.map((skill) => {
    const points: CxPoint[] = fgData.map((d, i) => ({
      date: d.date,
      foreground: d.scores[skill.id],
      baseline: bgData ? bgData[i].scores[skill.id] : d.scores[skill.id],
    }));

    return {
      skillId: skill.id,
      label: skill.label,
      color: skill.color,
      points,
    };
  });
}

import { getMockCxTrend } from './mockData';
import { CxScope, getComparisonScope } from './scope';
import { CX_SKILLS, CxSkillId, getTraitColor } from './skills';
import { differenceInDays, startOfDay } from 'date-fns';
import type { ThemePreference } from '@/lib/definitions';

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
  startDateIndex: number | null;
}

/**
 * Rolls up CX trend data, calculating the start date index based on user tenure.
 */
export function rollupCxTrend(
  scope: CxScope, 
  days: number = 30, 
  anchorScores?: Partial<Record<CxSkillId, number>>,
  memberSince?: string | null,
  themePreference: ThemePreference = 'vibrant'
): CxSeries[] {
  // Use real data anchoring for the foreground if provided
  const fgData = getMockCxTrend(scope.userId || scope.storeId || scope.orgId, days, anchorScores);
  
  const comparison = getComparisonScope(scope);
  // For the baseline comparison
  const bgData = comparison 
    ? getMockCxTrend(comparison.userId || comparison.storeId || comparison.orgId, days)
    : null;

  // Calculate where the "Start Date Line" should be
  let startDateIndex: number | null = null;
  if (memberSince && scope.userId) {
    const joinDate = startOfDay(new Date(memberSince));
    const today = startOfDay(new Date());
    const daysSinceJoining = differenceInDays(today, joinDate);
    
    // If they joined within the current view window
    if (daysSinceJoining < days) {
      startDateIndex = (days - 1) - daysSinceJoining;
    } else {
      // They joined before this window started
      startDateIndex = null;
    }
  }

  return CX_SKILLS.map((skill) => {
    const points: CxPoint[] = fgData.map((d, i) => {
      let foregroundValue = d.scores[skill.id];
      
      // If we have a start index, data before that point should be treated as "pre-history"
      // We'll keep the values for the visual wave but the line renderer can handle the break
      if (startDateIndex !== null && i < startDateIndex) {
        // Optional: darken or baseline pre-history values if needed
      }

      return {
        date: d.date,
        foreground: foregroundValue,
        baseline: bgData ? bgData[i].scores[skill.id] : d.scores[skill.id],
      };
    });

    return {
      skillId: skill.id,
      label: skill.label,
      color: getTraitColor(skill.id, themePreference),
      points,
      startDateIndex,
    };
  });
}
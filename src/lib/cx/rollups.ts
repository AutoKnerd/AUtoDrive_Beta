import { CxScope, getComparisonScope } from './scope';
import { CX_SKILLS, CxSkillId, getTraitColor } from './skills';
import { differenceInDays, startOfDay } from 'date-fns';
import type { ThemePreference } from '@/lib/definitions';
import { getCxTrendForScope } from '@/lib/data.client';

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
export async function rollupCxTrend(
  scope: CxScope, 
  days: number = 30, 
  anchorScores?: Partial<Record<CxSkillId, number>>,
  memberSince?: string | null,
  themePreference: ThemePreference = 'vibrant'
): Promise<CxSeries[]> {
  const fgData = await getCxTrendForScope(scope, days);
  const comparison = getComparisonScope(scope);
  const bgData = comparison ? await getCxTrendForScope(comparison, days) : null;
  const backgroundByDate = new Map((bgData || []).map((row) => [row.date, row.scores]));

  if (!fgData.length && anchorScores) {
    const today = new Date().toISOString().slice(0, 10);
    fgData.push({
      date: today,
      scores: {
        empathy: Number(anchorScores.empathy ?? 0),
        listening: Number(anchorScores.listening ?? 0),
        trust: Number(anchorScores.trust ?? 0),
        followUp: Number(anchorScores.followUp ?? 0),
        closing: Number(anchorScores.closing ?? 0),
        relationship: Number(anchorScores.relationship ?? 0),
      },
    });
  }

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
        baseline: backgroundByDate.get(d.date)?.[skill.id] ?? d.scores[skill.id],
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

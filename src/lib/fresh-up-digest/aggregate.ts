import type { FreshUpWeeklyDigestAggregates, FreshUpWeeklyDigestContext, FreshUpWeeklyDigestType } from '@/lib/fresh-up-digest/types';
import type { FreshUpNormalizedSession } from '@/lib/fresh-up-export/types';
import { inferAisRoleTypeFromSessions } from '@/lib/ais-score-interpretation';

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  let winner = '';
  let max = 0;
  counts.forEach((count, value) => {
    if (count > max) {
      winner = value;
      max = count;
    }
  });
  return winner;
}

function weekWindows(now = Date.now()): {
  currentStart: number;
  currentEnd: number;
  previousStart: number;
  previousEnd: number;
} {
  const d = 24 * 60 * 60 * 1000;
  return {
    currentStart: now - (7 * d),
    currentEnd: now,
    previousStart: now - (14 * d),
    previousEnd: now - (7 * d),
  };
}

function getScopeRows(input: {
  sessions: FreshUpNormalizedSession[];
  digestType: FreshUpWeeklyDigestType;
  entityId?: string;
}): FreshUpNormalizedSession[] {
  if (input.digestType === 'dealer_weekly' || input.digestType === 'manager_coaching_weekly') {
    return input.sessions.filter((row) => row.dealerId === (input.entityId || ''));
  }
  if (input.digestType === 'consultant_weekly') {
    return input.sessions.filter((row) => row.userId === (input.entityId || ''));
  }
  if (input.digestType === 'version_monitoring_weekly') {
    return input.sessions.filter((row) => row.freshUpVersionId === (input.entityId || ''));
  }
  return input.sessions;
}

function topStrengthAndWeakest(rows: FreshUpNormalizedSession[]): { topStrength: string; topImprovementArea: string } {
  const metrics = [
    { label: 'Empathy', value: avg(rows.map((row) => row.scores.empathy)) },
    { label: 'Listening', value: avg(rows.map((row) => row.scores.listening)) },
    { label: 'Trust', value: avg(rows.map((row) => row.scores.trust)) },
    { label: 'Follow Up', value: avg(rows.map((row) => row.scores.followUp)) },
    { label: 'Closing', value: avg(rows.map((row) => row.scores.closing)) },
    { label: 'Relationship', value: avg(rows.map((row) => row.scores.relationship)) },
  ].sort((a, b) => b.value - a.value);
  return {
    topStrength: metrics[0]?.label || 'N/A',
    topImprovementArea: metrics[metrics.length - 1]?.label || 'N/A',
  };
}

function weeklyOutcomeCounts(rows: FreshUpNormalizedSession[]) {
  return {
    customerEngaged: rows.filter((row) => row.outcomeTag === 'Customer Engaged').length,
    trustEstablished: rows.filter((row) => row.outcomeTag === 'Trust Established').length,
    appointmentSet: rows.filter((row) => row.outcomeTag === 'Appointment Set').length,
    lostMomentum: rows.filter((row) => row.outcomeTag === 'Lost Momentum').length,
    conversationBreakdown: rows.filter((row) => row.outcomeTag === 'Conversation Breakdown').length,
  };
}

export function aggregateWeeklyDigest(input: {
  context: FreshUpWeeklyDigestContext;
  digestType: FreshUpWeeklyDigestType;
}): { aggregates: FreshUpWeeklyDigestAggregates; currentRows: FreshUpNormalizedSession[]; previousRows: FreshUpNormalizedSession[] } {
  const scoped = getScopeRows({
    sessions: input.context.sessions,
    digestType: input.digestType,
    entityId: input.context.entityId,
  });
  const windows = weekWindows();
  const currentRows = scoped.filter((row) => row.timestamp.getTime() >= windows.currentStart && row.timestamp.getTime() < windows.currentEnd);
  const previousRows = scoped.filter((row) => row.timestamp.getTime() >= windows.previousStart && row.timestamp.getTime() < windows.previousEnd);
  const strengths = topStrengthAndWeakest(currentRows);
  const currentTrust = avg(currentRows.map((row) => row.scores.trust));
  const previousTrust = avg(previousRows.map((row) => row.scores.trust));
  const currentUp = avg(currentRows.map((row) => row.upMeterPeak));
  const previousUp = avg(previousRows.map((row) => row.upMeterPeak));
  const sessionDeltaPercent = pct(currentRows.length - previousRows.length, previousRows.length || 1);
  const weekStart = new Date(windows.currentStart).toLocaleDateString();
  const weekEnd = new Date(windows.currentEnd).toLocaleDateString();
  const breakdownFlags = currentRows
    .filter((row) => row.outcomeTag === 'Conversation Breakdown' || row.outcomeTag === 'Lost Momentum')
    .map((row) => row.coachingTag || row.summaryTag || row.primaryConcern);

  const aggregates: FreshUpWeeklyDigestAggregates = {
    weekRangeLabel: `${weekStart} - ${weekEnd}`,
    totalSessions: currentRows.length,
    activeConsultants: new Set(currentRows.map((row) => row.userId).filter(Boolean)).size,
    activeDealers: new Set(currentRows.map((row) => row.dealerId).filter(Boolean)).size,
    averageConversationLength: round(avg(currentRows.map((row) => row.conversationLength))),
    averageUpMeterPeak: round(currentUp),
    averageTrustShift: round(avg(currentRows.map((row) => row.trustShift))),
    averageEmpathy: round(avg(currentRows.map((row) => row.scores.empathy))),
    averageListening: round(avg(currentRows.map((row) => row.scores.listening))),
    averageTrust: round(currentTrust),
    averageFollowUp: round(avg(currentRows.map((row) => row.scores.followUp))),
    averageClosing: round(avg(currentRows.map((row) => row.scores.closing))),
    averageRelationship: round(avg(currentRows.map((row) => row.scores.relationship))),
    topStrength: strengths.topStrength,
    topImprovementArea: strengths.topImprovementArea,
    mostCommonCustomerFriction: mostCommon(breakdownFlags) || 'No major weekly friction trend',
    mostCommonArchetypeFriction: mostCommon(currentRows.filter((row) => row.outcomeTag === 'Conversation Breakdown').map((row) => row.archetypeCategory)) || 'N/A',
    mostCommonConcernFriction: mostCommon(currentRows.filter((row) => row.outcomeTag === 'Conversation Breakdown').map((row) => row.primaryConcern)) || 'N/A',
    dominantRoleType: inferAisRoleTypeFromSessions(currentRows),
    outcomes: weeklyOutcomeCounts(currentRows),
    progressVsPreviousWeek: {
      trustDelta: round(currentTrust - previousTrust),
      upMeterDelta: round(currentUp - previousUp),
      sessionDeltaPercent: round(sessionDeltaPercent),
    },
    versionNotes: input.digestType === 'version_monitoring_weekly'
      ? `Version ${input.context.entityId || 'selected'} weekly trend: trust ${round(currentTrust - previousTrust) >= 0 ? 'up' : 'down'} ${Math.abs(round(currentTrust - previousTrust))}, Up Meter ${round(currentUp - previousUp) >= 0 ? 'up' : 'down'} ${Math.abs(round(currentUp - previousUp))}.`
      : undefined,
  };
  return { aggregates, currentRows, previousRows };
}

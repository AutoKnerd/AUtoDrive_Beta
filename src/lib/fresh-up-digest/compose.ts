import type { FreshUpNarrativeLength } from '@/lib/fresh-up-narrative/types';
import type { FreshUpWeeklyDigestAggregates, FreshUpWeeklyDigestType } from '@/lib/fresh-up-digest/types';

function formatTrend(delta: number): string {
  if (delta > 1.5) return `improved ${delta.toFixed(1)} points`;
  if (delta < -1.5) return `declined ${Math.abs(delta).toFixed(1)} points`;
  return 'remained stable';
}

function headlineByType(input: {
  digestType: FreshUpWeeklyDigestType;
  aggregates: FreshUpWeeklyDigestAggregates;
}): string {
  const trustTrend = formatTrend(input.aggregates.progressVsPreviousWeek.trustDelta);
  if (input.digestType === 'platform_weekly') {
    return `Platform trust ${trustTrend} this week, while ${input.aggregates.topStrength} remained the strongest skill area.`;
  }
  if (input.digestType === 'version_monitoring_weekly') {
    return `Version monitoring shows trust ${trustTrend} with average Up Meter peak at ${input.aggregates.averageUpMeterPeak}.`;
  }
  return `Trust ${trustTrend} this week, with ${input.aggregates.topStrength} leading and ${input.aggregates.topImprovementArea} still needing attention.`;
}

function baseInsights(input: {
  digestType: FreshUpWeeklyDigestType;
  aggregates: FreshUpWeeklyDigestAggregates;
}): string[] {
  const a = input.aggregates;
  const insights = [
    `Total Fresh Up sessions: ${a.totalSessions} (${a.progressVsPreviousWeek.sessionDeltaPercent >= 0 ? '+' : ''}${a.progressVsPreviousWeek.sessionDeltaPercent}% vs previous week).`,
    `Average Up Meter Peak: ${a.averageUpMeterPeak} (${a.progressVsPreviousWeek.upMeterDelta >= 0 ? '+' : ''}${a.progressVsPreviousWeek.upMeterDelta} vs previous week).`,
    `Top strength: ${a.topStrength}. Primary growth area: ${a.topImprovementArea}.`,
    `Most common friction: ${a.mostCommonCustomerFriction}.`,
    `Friction drivers: archetype ${a.mostCommonArchetypeFriction}, concern ${a.mostCommonConcernFriction}.`,
  ];
  if (input.digestType === 'version_monitoring_weekly' && a.versionNotes) {
    insights.push(a.versionNotes);
  }
  if (input.digestType === 'platform_weekly') {
    insights.push(`Active dealers: ${a.activeDealers}. Active consultants: ${a.activeConsultants}.`);
  }
  if (input.digestType === 'consultant_weekly') {
    insights.push(`Weekly outcome mix: Engaged ${a.outcomes.customerEngaged}, Trust Established ${a.outcomes.trustEstablished}, Appointment Set ${a.outcomes.appointmentSet}.`);
  }
  return insights;
}

function limitInsights(insights: string[], lengthMode: FreshUpNarrativeLength): string[] {
  if (lengthMode === 'short') return insights.slice(0, 3);
  if (lengthMode === 'standard') return insights.slice(0, 5);
  return insights.slice(0, 8);
}

export function composeWeeklyDigestContent(input: {
  digestType: FreshUpWeeklyDigestType;
  lengthMode: FreshUpNarrativeLength;
  aggregates: FreshUpWeeklyDigestAggregates;
  narrative?: string;
}): { title: string; headlineSummary: string; keyInsights: string[]; narrative?: string } {
  const titleMap: Record<FreshUpWeeklyDigestType, string> = {
    dealer_weekly: 'Dealer Weekly Digest',
    consultant_weekly: 'Consultant Weekly Digest',
    platform_weekly: 'Platform Weekly Digest',
    manager_coaching_weekly: 'Manager Coaching Weekly Digest',
    version_monitoring_weekly: 'Version Monitoring Weekly Digest',
  };
  const headlineSummary = headlineByType({
    digestType: input.digestType,
    aggregates: input.aggregates,
  });
  const insights = limitInsights(baseInsights({
    digestType: input.digestType,
    aggregates: input.aggregates,
  }), input.lengthMode);

  return {
    title: titleMap[input.digestType] || 'Weekly Fresh Up Digest',
    headlineSummary,
    keyInsights: insights,
    narrative: input.lengthMode === 'short' ? undefined : input.narrative,
  };
}

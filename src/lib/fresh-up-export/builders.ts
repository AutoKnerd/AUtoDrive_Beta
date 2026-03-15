import type { FreshUpExportFilters, FreshUpNormalizedSession } from '@/lib/fresh-up-export/types';

type NamedSessionContext = {
  sessions: FreshUpNormalizedSession[];
  dealerNameById: Map<string, string>;
  userNameById: Map<string, string>;
  filters: FreshUpExportFilters;
};

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
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

function topStrengthAndGrowth(sessionList: FreshUpNormalizedSession[]): { topStrength: string; topGrowthArea: string } {
  const metrics = [
    { label: 'Empathy', value: avg(sessionList.map((row) => row.scores.empathy)) },
    { label: 'Listening', value: avg(sessionList.map((row) => row.scores.listening)) },
    { label: 'Trust', value: avg(sessionList.map((row) => row.scores.trust)) },
    { label: 'Follow Up', value: avg(sessionList.map((row) => row.scores.followUp)) },
    { label: 'Closing', value: avg(sessionList.map((row) => row.scores.closing)) },
    { label: 'Relationship', value: avg(sessionList.map((row) => row.scores.relationship)) },
  ];
  const sorted = [...metrics].sort((a, b) => b.value - a.value);
  return {
    topStrength: sorted[0]?.label ?? 'N/A',
    topGrowthArea: sorted[sorted.length - 1]?.label ?? 'N/A',
  };
}

function skillByLabel(input: FreshUpNormalizedSession[], label: string): number {
  if (label === 'Empathy') return avg(input.map((row) => row.scores.empathy));
  if (label === 'Listening') return avg(input.map((row) => row.scores.listening));
  if (label === 'Trust') return avg(input.map((row) => row.scores.trust));
  if (label === 'Follow Up') return avg(input.map((row) => row.scores.followUp));
  if (label === 'Closing') return avg(input.map((row) => row.scores.closing));
  return avg(input.map((row) => row.scores.relationship));
}

function topArchetypeByScore(input: FreshUpNormalizedSession[], best: boolean): string[] {
  const grouped = new Map<string, FreshUpNormalizedSession[]>();
  input.forEach((row) => {
    const key = row.archetypeName || row.archetypeCategory || 'Unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(row);
  });
  const ranked = Array.from(grouped.entries()).map(([name, rows]) => ({
    name,
    score: avg(rows.map((row) => (row.scores.trust + row.upMeterPeak + row.scores.relationship) / 3)),
  }));
  ranked.sort((a, b) => best ? b.score - a.score : a.score - b.score);
  return ranked.slice(0, 3).map((row) => row.name);
}

export function buildRawSessionRows(context: NamedSessionContext): Array<Record<string, unknown>> {
  return context.sessions.map((row) => ({
    sessionId: row.sessionId,
    userId: row.userId,
    consultantName: context.userNameById.get(row.userId) || '',
    dealerId: row.dealerId,
    dealerName: context.dealerNameById.get(row.dealerId) || '',
    timestamp: row.timestamp.toISOString(),
    freshUpVersionId: row.freshUpVersionId,
    freshUpVersionName: row.freshUpVersionName,
    environment: row.environment,
    isSandbox: row.isSandbox,
    sourceType: row.sourceType,
    roleType: row.roleType,
    interactionDisplayLabel: row.interactionDisplayLabel,
    concernCategoryRoleSpecific: row.concernCategoryRoleSpecific,
    nextStepType: row.nextStepType,
    interpretationVersion: row.interpretationVersion,
    customerName: row.customerName,
    vehicleInterest: row.vehicleInterest,
    buyingStage: row.buyingStage,
    personalityType: row.personalityType,
    communicationStyle: row.communicationStyle,
    difficultyLevel: row.difficultyLevel,
    primaryConcern: row.primaryConcern,
    secondaryConcern: row.secondaryConcern,
    startingMood: row.startingMood,
    endingEmotionalState: row.endingEmotionalState,
    archetypeId: row.archetypeId,
    archetypeName: row.archetypeName,
    archetypeCategory: row.archetypeCategory,
    humorLevel: row.humorLevel,
    openingMessage: row.openingMessage,
    finalCustomerResponse: row.finalCustomerResponse,
    endingType: row.endingType,
    outcomeTag: row.outcomeTag,
    recommendedNextStep: row.recommendedNextStep,
    upMeterStart: row.upMeterStart,
    upMeterPeak: row.upMeterPeak,
    upMeterEnd: row.upMeterEnd,
    trustShift: row.trustShift,
    empathyDelta: row.empathyDelta,
    listeningDelta: row.listeningDelta,
    trustDelta: row.trustDelta,
    followUpDelta: row.followUpDelta,
    closingDelta: row.closingDelta,
    relationshipDelta: row.relationshipDelta,
    coachingTag: row.coachingTag,
    summaryTag: row.summaryTag,
    conversationLength: row.conversationLength,
    messagesSent: row.messagesSent,
    xpAwarded: row.xpAwarded,
    guardrailFlags: row.guardrailFlags.join('|'),
    contentValidationPassed: row.contentValidationPassed,
    validationFailureReasons: row.validationFailureReasons.join('|'),
  }));
}

export function buildDealerSummaryRows(context: NamedSessionContext): Array<Record<string, unknown>> {
  const grouped = new Map<string, FreshUpNormalizedSession[]>();
  context.sessions.forEach((row) => {
    if (!grouped.has(row.dealerId)) grouped.set(row.dealerId, []);
    grouped.get(row.dealerId)?.push(row);
  });
  return Array.from(grouped.entries()).map(([dealerId, rows]) => {
    const { topStrength, topGrowthArea } = topStrengthAndGrowth(rows);
    return {
      dealerId,
      dealerName: context.dealerNameById.get(dealerId) || dealerId || 'Unknown Dealer',
      timeRange: `${context.filters.dateFrom || 'all'} to ${context.filters.dateTo || 'today'}`,
      totalFreshUpSessions: rows.length,
      activeConsultants: new Set(rows.map((row) => row.userId).filter(Boolean)).size,
      averageConversationLength: round(avg(rows.map((row) => row.conversationLength))),
      averageUpMeterPeak: round(avg(rows.map((row) => row.upMeterPeak))),
      averageTrustShift: round(avg(rows.map((row) => row.trustShift))),
      averageEmpathy: round(avg(rows.map((row) => row.scores.empathy))),
      averageListening: round(avg(rows.map((row) => row.scores.listening))),
      averageTrust: round(avg(rows.map((row) => row.scores.trust))),
      averageFollowUp: round(avg(rows.map((row) => row.scores.followUp))),
      averageClosing: round(avg(rows.map((row) => row.scores.closing))),
      averageRelationship: round(avg(rows.map((row) => row.scores.relationship))),
      topStrength,
      topImprovementArea: topGrowthArea,
      mostCommonCoachingTag: mostCommon(rows.map((row) => row.coachingTag)),
      mostCommonOutcomeTag: mostCommon(rows.map((row) => row.outcomeTag)),
      topArchetypesHandledWell: topArchetypeByScore(rows, true).join(' | '),
      topArchetypesHandledPoorly: topArchetypeByScore(rows, false).join(' | '),
      versionBreakdown: Array.from(new Set(rows.map((row) => row.freshUpVersionName || row.freshUpVersionId).filter(Boolean))).join(' | '),
    };
  });
}

export function buildConsultantTrendRows(context: NamedSessionContext): Array<Record<string, unknown>> {
  const grouped = new Map<string, FreshUpNormalizedSession[]>();
  context.sessions.forEach((row) => {
    if (!grouped.has(row.userId)) grouped.set(row.userId, []);
    grouped.get(row.userId)?.push(row);
  });
  return Array.from(grouped.entries()).map(([userId, rows]) => {
    const sorted = [...rows].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const midpoint = Math.floor(sorted.length / 2) || 1;
    const early = sorted.slice(0, midpoint);
    const late = sorted.slice(midpoint);
    const earlyTrust = avg(early.map((row) => row.scores.trust));
    const lateTrust = avg(late.map((row) => row.scores.trust));
    const { topStrength, topGrowthArea } = topStrengthAndGrowth(rows);
    const versionGroups = new Map<string, FreshUpNormalizedSession[]>();
    rows.forEach((row) => {
      const key = row.freshUpVersionName || row.freshUpVersionId || 'Unknown';
      if (!versionGroups.has(key)) versionGroups.set(key, []);
      versionGroups.get(key)?.push(row);
    });
    const versionComparison = Array.from(versionGroups.entries())
      .map(([version, versionRows]) => `${version}:${round(avg(versionRows.map((entry) => entry.upMeterPeak)))}`)
      .join(' | ');

    return {
      userId,
      consultantName: context.userNameById.get(userId) || userId,
      dealerId: mostCommon(rows.map((row) => row.dealerId)),
      totalFreshUpSessions: rows.length,
      averageUpMeterPeak: round(avg(rows.map((row) => row.upMeterPeak))),
      averageTrustShift: round(avg(rows.map((row) => row.trustShift))),
      averageConversationLength: round(avg(rows.map((row) => row.conversationLength))),
      averageEmpathy: round(avg(rows.map((row) => row.scores.empathy))),
      averageListening: round(avg(rows.map((row) => row.scores.listening))),
      averageTrust: round(avg(rows.map((row) => row.scores.trust))),
      averageFollowUp: round(avg(rows.map((row) => row.scores.followUp))),
      averageClosing: round(avg(rows.map((row) => row.scores.closing))),
      averageRelationship: round(avg(rows.map((row) => row.scores.relationship))),
      topStrength,
      topGrowthArea,
      mostCommonCoachingTag: mostCommon(rows.map((row) => row.coachingTag)),
      mostCommonArchetypeCategory: mostCommon(rows.map((row) => row.archetypeCategory)),
      improvementTrend: lateTrust >= earlyTrust ? 'improving' : 'needs_attention',
      versionComparison,
    };
  });
}

export function buildManagerCoachingReport(context: NamedSessionContext): Record<string, unknown> {
  const { topStrength, topGrowthArea } = topStrengthAndGrowth(context.sessions);
  const frictionTags = context.sessions.filter((row) => row.outcomeTag === 'Conversation Breakdown' || row.outcomeTag === 'Lost Momentum');
  const difficultCustomers = mostCommon(frictionTags.map((row) => row.archetypeCategory || row.primaryConcern));
  const coachingFocus = topGrowthArea;
  const moduleBySkill: Record<string, string> = {
    Empathy: 'Understanding Customer Emotions',
    Listening: 'Active Listening Techniques',
    Trust: 'Building Trust Through Transparency',
    'Follow Up': 'Follow Up Momentum Builder',
    Closing: 'Guiding the Customer to the Next Step',
    Relationship: 'Creating Personal Connection',
  };

  return {
    teamStrengthSnapshot: {
      topTeamStrength: topStrength,
      averageStrengthScore: round(skillByLabel(context.sessions, topStrength)),
    },
    commonFrictionAreas: {
      topGrowthArea,
      mostCommonBreakdownOutcome: mostCommon(frictionTags.map((row) => row.outcomeTag)),
      mostCommonCoachingTag: mostCommon(context.sessions.map((row) => row.coachingTag)),
    },
    customersThatCreateTheMostStruggle: {
      primaryCustomerType: difficultCustomers,
      mostChallengingConcern: mostCommon(frictionTags.map((row) => row.primaryConcern)),
    },
    recommendedCoachingFocus: coachingFocus,
    suggestedAutoForgeModule: moduleBySkill[coachingFocus] || 'Trust Through Discovery',
  };
}

export function buildAutoforgeTriggerRows(context: NamedSessionContext): Array<Record<string, unknown>> {
  const grouped = new Map<string, FreshUpNormalizedSession[]>();
  context.sessions.forEach((row) => {
    if (!grouped.has(row.dealerId)) grouped.set(row.dealerId, []);
    grouped.get(row.dealerId)?.push(row);
  });
  const thresholds = [
    { key: 'trust', label: 'Trust', module: 'Trust Through Discovery', score: (row: FreshUpNormalizedSession) => row.scores.trust },
    { key: 'listening', label: 'Listening', module: 'Active Listening Workshop', score: (row: FreshUpNormalizedSession) => row.scores.listening },
    { key: 'closing', label: 'Closing', module: 'Guiding the Customer to the Next Step', score: (row: FreshUpNormalizedSession) => row.scores.closing },
    { key: 'relationship', label: 'Relationship', module: 'Personal Connection Builder', score: (row: FreshUpNormalizedSession) => row.scores.relationship },
    { key: 'followUp', label: 'Follow Up', module: 'Follow Up Momentum Builder', score: (row: FreshUpNormalizedSession) => row.scores.followUp },
  ];

  return Array.from(grouped.entries()).map(([dealerId, rows]) => {
    const flagged = thresholds
      .map((rule) => ({ ...rule, avg: avg(rows.map((row) => rule.score(row))) }))
      .filter((rule) => rule.avg < 55);
    const confidence = flagged.length === 0 ? 0.35 : Math.min(0.95, 0.5 + (flagged.length * 0.1));
    return {
      dealerId,
      timeRange: `${context.filters.dateFrom || 'all'} to ${context.filters.dateTo || 'today'}`,
      flaggedSkillAreas: flagged.map((item) => item.label).join(' | '),
      recommendedAutoForgeModules: flagged.map((item) => item.module).join(' | '),
      supportingMetrics: flagged.map((item) => `${item.label}:${round(item.avg)}`).join(' | '),
      confidenceLevel: round(confidence * 100),
    };
  });
}

export function buildMarketingInsightReport(context: NamedSessionContext): Record<string, unknown> {
  const sessions = context.sessions;
  const mostImproved = [
    { label: 'Empathy', delta: avg(sessions.map((row) => row.empathyDelta)) },
    { label: 'Listening', delta: avg(sessions.map((row) => row.listeningDelta)) },
    { label: 'Trust', delta: avg(sessions.map((row) => row.trustDelta)) },
    { label: 'Follow Up', delta: avg(sessions.map((row) => row.followUpDelta)) },
    { label: 'Closing', delta: avg(sessions.map((row) => row.closingDelta)) },
    { label: 'Relationship', delta: avg(sessions.map((row) => row.relationshipDelta)) },
  ].sort((a, b) => b.delta - a.delta)[0];

  return {
    topIndustrySkillGap: topStrengthAndGrowth(sessions).topGrowthArea,
    averageUpMeterPeakAcrossDealers: round(avg(sessions.map((row) => row.upMeterPeak))),
    mostDifficultCustomerConcern: mostCommon(sessions.filter((row) => row.outcomeTag === 'Conversation Breakdown').map((row) => row.primaryConcern)),
    mostDifficultCustomerArchetype: mostCommon(sessions.filter((row) => row.outcomeTag === 'Conversation Breakdown').map((row) => row.archetypeCategory)),
    mostCommonBreakdownPoint: mostCommon(sessions.map((row) => row.outcomeTag)),
    mostImprovedSkillOverTime: mostImproved?.label || 'N/A',
    trustScoreByBuyerPersonality: Array.from(new Set(sessions.map((row) => row.personalityType).filter(Boolean))).map((personality) => ({
      personalityType: personality,
      trustAverage: round(avg(sessions.filter((row) => row.personalityType === personality).map((row) => row.scores.trust))),
    })),
    relationshipScoreByCustomerType: Array.from(new Set(sessions.map((row) => row.archetypeCategory).filter(Boolean))).map((category) => ({
      customerType: category,
      relationshipAverage: round(avg(sessions.filter((row) => row.archetypeCategory === category).map((row) => row.scores.relationship))),
    })),
  };
}

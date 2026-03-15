import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { loadFreshUpSessionsForExport, loadNamesById } from '@/lib/fresh-up-export/query';
import { generateWeeklyDigest } from '@/lib/fresh-up-digest/engine';
import { runFreshUpBenchmark } from '@/lib/fresh-up-benchmark/engine';
import { generateFreshUpNarrative } from '@/lib/fresh-up-narrative/engine';
import { buildCoachingInsight } from '@/lib/coaching-intelligence/coachingEngine';
import type {
  FreshUpCommandCenterEntityMode,
  FreshUpCommandCenterGoalRow,
  FreshUpCommandCenterRequest,
  FreshUpCommandCenterResult,
} from '@/lib/fresh-up-command-center/types';
import type { FreshUpNormalizedSession } from '@/lib/fresh-up-export/types';
import { buildRoleAdaptiveWeaknessLine, inferAisRoleTypeFromSessions } from '@/lib/ais-score-interpretation';

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

function splitWindows(rows: FreshUpNormalizedSession[]): { current: FreshUpNormalizedSession[]; previous: FreshUpNormalizedSession[] } {
  const now = Date.now();
  const d = 24 * 60 * 60 * 1000;
  const currentStart = now - (30 * d);
  const previousStart = now - (60 * d);
  return {
    current: rows.filter((row) => row.timestamp.getTime() >= currentStart),
    previous: rows.filter((row) => row.timestamp.getTime() >= previousStart && row.timestamp.getTime() < currentStart),
  };
}

function scopeSessions(rows: FreshUpNormalizedSession[], entityMode: FreshUpCommandCenterEntityMode, entityId?: string): FreshUpNormalizedSession[] {
  if (!entityId || entityMode === 'platform') return rows;
  if (entityMode === 'dealer') return rows.filter((row) => row.dealerId === entityId);
  if (entityMode === 'consultant') return rows.filter((row) => row.userId === entityId);
  if (entityMode === 'version') return rows.filter((row) => row.freshUpVersionId === entityId || row.freshUpVersionName === entityId);
  return rows;
}

function weakestSkill(rows: FreshUpNormalizedSession[]): { label: string; value: number } {
  const metrics = [
    { label: 'Empathy', value: avg(rows.map((row) => row.scores.empathy)) },
    { label: 'Listening', value: avg(rows.map((row) => row.scores.listening)) },
    { label: 'Trust', value: avg(rows.map((row) => row.scores.trust)) },
    { label: 'Follow Up', value: avg(rows.map((row) => row.scores.followUp)) },
    { label: 'Closing', value: avg(rows.map((row) => row.scores.closing)) },
    { label: 'Relationship', value: avg(rows.map((row) => row.scores.relationship)) },
  ].sort((a, b) => a.value - b.value);
  return metrics[0] || { label: 'Trust', value: 0 };
}

function strongestSkill(rows: FreshUpNormalizedSession[]): { label: string; value: number } {
  const metrics = [
    { label: 'Empathy', value: avg(rows.map((row) => row.scores.empathy)) },
    { label: 'Listening', value: avg(rows.map((row) => row.scores.listening)) },
    { label: 'Trust', value: avg(rows.map((row) => row.scores.trust)) },
    { label: 'Follow Up', value: avg(rows.map((row) => row.scores.followUp)) },
    { label: 'Closing', value: avg(rows.map((row) => row.scores.closing)) },
    { label: 'Relationship', value: avg(rows.map((row) => row.scores.relationship)) },
  ].sort((a, b) => b.value - a.value);
  return metrics[0] || { label: 'Relationship', value: 0 };
}

function trendDelta(current: number, previous: number): { delta: number; direction: 'up' | 'down' | 'stable' } {
  const delta = round(current - previous);
  if (Math.abs(delta) <= 1) return { delta, direction: 'stable' };
  return { delta, direction: delta > 0 ? 'up' : 'down' };
}

async function loadRiskRows(input: {
  db: Firestore;
  environment: 'sandbox' | 'production';
  entityMode: FreshUpCommandCenterEntityMode;
  entityId?: string;
}): Promise<Array<{
  riskId: string;
  riskType: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recommendedAction: string;
}>> {
  let query = input.db.collection('freshUpRiskRadar')
    .where('environment', '==', input.environment)
    .where('isActive', '==', true)
    .orderBy('createdAt', 'desc')
    .limit(200);
  const snap = await query.get();
  let rows = snap.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    return {
      riskId: String(data.riskId || docSnap.id),
      entityType: String(data.entityType || ''),
      entityId: String(data.entityId || ''),
      riskType: String(data.riskType || ''),
      riskLevel: (String(data.riskLevel || 'low') as 'low' | 'medium' | 'high' | 'critical'),
      message: String(data.message || ''),
      recommendedAction: String(data.recommendedAction || ''),
    };
  });
  if (input.entityMode === 'dealer' && input.entityId) rows = rows.filter((row) => row.entityId === input.entityId || row.entityType === 'platform');
  if (input.entityMode === 'consultant' && input.entityId) rows = rows.filter((row) => row.entityId === input.entityId || row.entityType === 'dealer' || row.entityType === 'platform');
  if (input.entityMode === 'version' && input.entityId) rows = rows.filter((row) => row.entityId === input.entityId || row.entityType === 'platform');
  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
  return rows.sort((a, b) => severityRank[b.riskLevel] - severityRank[a.riskLevel]).slice(0, 5);
}

async function loadAlertRows(input: {
  db: Firestore;
  environment: 'sandbox' | 'production';
  entityMode: FreshUpCommandCenterEntityMode;
  entityId?: string;
}): Promise<Array<{
  alertId: string;
  alertType: string;
  severity: string;
  message: string;
  recommendedAction: string;
}>> {
  const snap = await input.db.collection('freshUpAlerts')
    .where('environment', '==', input.environment)
    .where('resolved', '==', false)
    .orderBy('createdAt', 'desc')
    .limit(300)
    .get();
  let rows = snap.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    return {
      alertId: String(data.alertId || docSnap.id),
      entityType: String(data.entityType || ''),
      entityId: String(data.entityId || ''),
      alertType: String(data.alertType || ''),
      severity: String(data.severity || 'low'),
      message: String(data.message || ''),
      recommendedAction: String(data.recommendedAction || ''),
    };
  });
  if (input.entityMode === 'dealer' && input.entityId) rows = rows.filter((row) => row.entityId === input.entityId || row.entityType === 'platform');
  if (input.entityMode === 'consultant' && input.entityId) rows = rows.filter((row) => row.entityId === input.entityId || row.entityType === 'dealer' || row.entityType === 'platform');
  if (input.entityMode === 'version' && input.entityId) rows = rows.filter((row) => row.entityId === input.entityId || row.entityType === 'platform');
  return rows.slice(0, 3);
}

async function loadGoalRows(input: {
  db: Firestore;
  rows: FreshUpNormalizedSession[];
  entityMode: FreshUpCommandCenterEntityMode;
  entityId?: string;
}): Promise<FreshUpCommandCenterGoalRow[]> {
  try {
    const snap = await input.db.collection('freshUpGoals').where('status', '==', 'active').limit(500).get();
    const goals = snap.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        goalId: String(data.goalId || docSnap.id),
        goalTitle: String(data.name || data.goalTitle || 'Goal'),
        metric: String(data.metric || ''),
        targetValue: Number(data.targetValue ?? data.target ?? 0),
        dealerId: String(data.dealerId || ''),
        userId: String(data.userId || ''),
      };
    });
    const scopedGoals = goals.filter((goal) => {
      if (input.entityMode === 'dealer' && input.entityId) return goal.dealerId === input.entityId || !goal.dealerId;
      if (input.entityMode === 'consultant' && input.entityId) return goal.userId === input.entityId || !goal.userId;
      return true;
    });
    return scopedGoals.map((goal) => {
      const rows = goal.dealerId
        ? input.rows.filter((row) => row.dealerId === goal.dealerId)
        : (goal.userId ? input.rows.filter((row) => row.userId === goal.userId) : input.rows);
      const currentValue = goal.metric === 'trust'
        ? avg(rows.map((row) => row.scores.trust))
        : goal.metric === 'listening'
          ? avg(rows.map((row) => row.scores.listening))
          : goal.metric === 'closing'
            ? avg(rows.map((row) => row.scores.closing))
            : goal.metric === 'up_meter_peak'
              ? avg(rows.map((row) => row.upMeterPeak))
              : avg(rows.map((row) => row.scores.relationship));
      const progressPercent = goal.targetValue > 0 ? pct(currentValue, goal.targetValue) : 0;
      let status: FreshUpCommandCenterGoalRow['status'] = 'on_track';
      if (progressPercent >= 100) status = 'exceeded';
      else if (progressPercent < 60) status = 'at_risk';
      else if (progressPercent < 70) status = 'stalled';
      return {
        goalId: goal.goalId,
        goalTitle: goal.goalTitle,
        currentValue: round(currentValue),
        targetValue: round(goal.targetValue),
        progressPercent: round(progressPercent),
        status,
      };
    });
  } catch {
    return [];
  }
}

function entityNameFor(input: {
  entityMode: FreshUpCommandCenterEntityMode;
  entityId?: string;
  dealerNameById: Map<string, string>;
  userNameById: Map<string, string>;
}): string {
  if (input.entityMode === 'platform') return 'Platform';
  if (!input.entityId) return 'Unknown';
  if (input.entityMode === 'dealer') return input.dealerNameById.get(input.entityId) || input.entityId;
  if (input.entityMode === 'consultant') return input.userNameById.get(input.entityId) || input.entityId;
  return input.entityId;
}

function digestTypeForMode(mode: FreshUpCommandCenterEntityMode): 'dealer_weekly' | 'consultant_weekly' | 'platform_weekly' | 'version_monitoring_weekly' {
  if (mode === 'dealer') return 'dealer_weekly';
  if (mode === 'consultant') return 'consultant_weekly';
  if (mode === 'version') return 'version_monitoring_weekly';
  return 'platform_weekly';
}

function benchmarkTypeForMode(mode: FreshUpCommandCenterEntityMode): 'dealer_vs_platform' | 'consultant_vs_dealer' | 'current_vs_previous_30' | 'version_vs_previous_version' {
  if (mode === 'dealer') return 'dealer_vs_platform';
  if (mode === 'consultant') return 'consultant_vs_dealer';
  if (mode === 'version') return 'version_vs_previous_version';
  return 'current_vs_previous_30';
}

function narrativeTypeForMode(mode: FreshUpCommandCenterEntityMode): 'dealer_performance' | 'consultant_trend' | 'platform_insight' | 'version_comparison' {
  if (mode === 'dealer') return 'dealer_performance';
  if (mode === 'consultant') return 'consultant_trend';
  if (mode === 'version') return 'version_comparison';
  return 'platform_insight';
}

export async function buildFreshUpCommandCenter(input: {
  db: Firestore;
  request: FreshUpCommandCenterRequest;
}): Promise<FreshUpCommandCenterResult> {
  const filters = {
    includeSandboxData: false,
    ...(input.request.filters || {}),
  };
  const environment = filters.includeSandboxData === true
    ? ((filters.environment as 'sandbox' | 'production' | undefined) || 'sandbox')
    : 'production';
  const sessions = await loadFreshUpSessionsForExport({
    adminDb: input.db,
    filters,
  });
  const { dealerNameById, userNameById } = await loadNamesById({
    adminDb: input.db,
    sessions,
  });

  const scopedRows = scopeSessions(sessions, input.request.entityMode, input.request.entityId);
  const windows = splitWindows(scopedRows);
  const entityName = entityNameFor({
    entityMode: input.request.entityMode,
    entityId: input.request.entityId,
    dealerNameById,
    userNameById,
  });

  const weeklyDigest = generateWeeklyDigest({
    request: {
      digestType: digestTypeForMode(input.request.entityMode),
      lengthMode: 'standard',
      entityId: input.request.entityId,
      comparisonEntityId: input.request.comparisonEntityId,
      filters,
    },
    context: {
      sessions,
      filters,
      entityId: input.request.entityId,
      comparisonEntityId: input.request.comparisonEntityId,
      dealerNameById,
      userNameById,
    },
  });

  const risks = await loadRiskRows({
    db: input.db,
    environment,
    entityMode: input.request.entityMode,
    entityId: input.request.entityId,
  });
  const alerts = await loadAlertRows({
    db: input.db,
    environment,
    entityMode: input.request.entityMode,
    entityId: input.request.entityId,
  });
  const goals = await loadGoalRows({
    db: input.db,
    rows: windows.current,
    entityMode: input.request.entityMode,
    entityId: input.request.entityId,
  });

  const current = windows.current;
  const previous = windows.previous;
  const performanceSnapshot = {
    totalFreshUpSessions: current.length,
    averageUpMeterPeak: round(avg(current.map((row) => row.upMeterPeak))),
    averageTrustShift: round(avg(current.map((row) => row.trustShift))),
    averageConversationLength: round(avg(current.map((row) => row.conversationLength))),
    averageEmpathy: round(avg(current.map((row) => row.scores.empathy))),
    averageListening: round(avg(current.map((row) => row.scores.listening))),
    averageTrust: round(avg(current.map((row) => row.scores.trust))),
    averageFollowUp: round(avg(current.map((row) => row.scores.followUp))),
    averageClosing: round(avg(current.map((row) => row.scores.closing))),
    averageRelationship: round(avg(current.map((row) => row.scores.relationship))),
  };

  const weakSkill = weakestSkill(current);
  const strongSkill = strongestSkill(current);
  const dominantRoleType = inferAisRoleTypeFromSessions(current);
  const roleAdaptiveWeakness = buildRoleAdaptiveWeaknessLine({
    roleType: dominantRoleType,
    metricName: weakSkill.label === 'Empathy'
      ? 'empathy'
      : weakSkill.label === 'Listening'
        ? 'listening'
        : weakSkill.label === 'Trust'
          ? 'trust'
          : weakSkill.label === 'Follow Up'
            ? 'followUp'
            : weakSkill.label === 'Closing'
              ? 'closing'
              : 'relationship',
    concernCategory: mostCommon(current.map((row) => row.primaryConcern)) || undefined,
  });
  const topRisk = risks[0];
  const topGoalAtRisk = goals.filter((goal) => goal.status === 'at_risk' || goal.status === 'stalled')[0];

  const coachingIntelligence = buildCoachingInsight({
    entityType: input.request.entityMode === 'consultant'
      ? 'consultant'
      : (input.request.entityMode === 'platform' || input.request.entityMode === 'version' ? 'platform' : 'dealer'),
    entityId: input.request.entityId || 'platform',
    entityName,
    environment,
    context: {
      currentRows: current,
      previousRows: previous,
      riskSignals: risks.map((risk) => ({
        riskType: risk.riskType,
        riskLevel: risk.riskLevel,
        message: risk.message,
      })),
      alertSignals: alerts.map((alert) => ({
        alertType: alert.alertType,
        severity: alert.severity,
        message: alert.message,
      })),
      goalSignals: goals.map((goal) => ({
        metric: goal.goalTitle,
        status: goal.status,
        goalTitle: goal.goalTitle,
      })),
    },
  });

  const coachingPrioritySummary = coachingIntelligence
    ? `${coachingIntelligence.message} ${coachingIntelligence.recommendedPractice}`
    : (topRisk
      ? `${topRisk.message} Priority coaching move: ${topRisk.recommendedAction}`
      : `Current strongest area is ${strongSkill.label}. ${roleAdaptiveWeakness}`);

  const autoforgeModule = coachingIntelligence?.suggestedAutoForgeModule || 'Trust Through Discovery';
  const autoforgeReason = coachingIntelligence
    ? coachingIntelligence.supportingEvidence
    : (topRisk
      ? `Top risk signal is ${topRisk.riskType.replace(/_/g, ' ')}, and ${weakSkill.label} is currently the weakest skill in active conversations.`
      : `${weakSkill.label} is trending lowest in current sessions and is the highest leverage coaching focus.`);

  const trendHighlights = [
    {
      label: 'Trust',
      ...trendDelta(avg(current.map((row) => row.scores.trust)), avg(previous.map((row) => row.scores.trust))),
    },
    {
      label: 'Listening',
      ...trendDelta(avg(current.map((row) => row.scores.listening)), avg(previous.map((row) => row.scores.listening))),
    },
    {
      label: 'Closing',
      ...trendDelta(avg(current.map((row) => row.scores.closing)), avg(previous.map((row) => row.scores.closing))),
    },
    {
      label: 'Up Meter Peak',
      ...trendDelta(avg(current.map((row) => row.upMeterPeak)), avg(previous.map((row) => row.upMeterPeak))),
    },
    {
      label: 'Conversation Breakdown Rate',
      ...trendDelta(
        pct(current.filter((row) => row.outcomeTag === 'Conversation Breakdown').length, current.length),
        pct(previous.filter((row) => row.outcomeTag === 'Conversation Breakdown').length, previous.length),
      ),
    },
  ];

  const benchmarkData = runFreshUpBenchmark({
    request: {
      benchmarkType: benchmarkTypeForMode(input.request.entityMode),
      entityId: input.request.entityId,
      comparisonEntityId: input.request.comparisonEntityId,
      metricName: 'all',
      filters,
    },
    context: {
      sessions,
      filters,
      dealerNameById,
      userNameById,
    },
  });

  const narrativeSummary = generateFreshUpNarrative({
    narrativeType: narrativeTypeForMode(input.request.entityMode),
    lengthMode: 'short',
    context: {
      sessions,
      filters,
      entityId: input.request.entityId,
      comparisonEntityId: input.request.comparisonEntityId,
      dealerNameById,
      userNameById,
      benchmarkResult: benchmarkData,
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    entityMode: input.request.entityMode,
    entityId: input.request.entityId || 'platform',
    entityName,
    weeklyDigestSummary: {
      headline: weeklyDigest.headlineSummary,
      topInsights: weeklyDigest.keyInsights.slice(0, 3),
      recommendedAction: weeklyDigest.recommendedAction,
    },
    activeRiskRadarSummary: {
      totalActiveRisks: risks.length,
      topRisks: risks.slice(0, 5),
    },
    goalsAndTargetsSummary: {
      activeGoals: goals.length,
      onTrack: goals.filter((goal) => goal.status === 'on_track').length,
      atRisk: goals.filter((goal) => goal.status === 'at_risk').length,
      exceeded: goals.filter((goal) => goal.status === 'exceeded').length,
      stalled: goals.filter((goal) => goal.status === 'stalled').length,
      topGoalsNeedingAttention: goals
        .filter((goal) => goal.status === 'at_risk' || goal.status === 'stalled')
        .sort((a, b) => a.progressPercent - b.progressPercent)
        .slice(0, 3),
    },
    activeAlertsSummary: {
      totalActiveAlerts: alerts.length,
      highSeverityAlerts: alerts.filter((alert) => alert.severity === 'high' || alert.severity === 'critical').length,
      goalRelatedAlerts: alerts.filter((alert) => alert.alertType.includes('goal') || alert.message.toLowerCase().includes('goal')).length,
      versionRelatedAlerts: alerts.filter((alert) => alert.alertType.includes('version')).length,
      topAlerts: alerts.slice(0, 3),
    },
    freshUpPerformanceSnapshot: performanceSnapshot,
    coachingIntelligence: coachingIntelligence ? {
      coachingId: coachingIntelligence.coachingId,
      priorityLevel: coachingIntelligence.priorityLevel,
      coachingTopic: coachingIntelligence.coachingTopic,
      message: coachingIntelligence.message,
      supportingEvidence: coachingIntelligence.supportingEvidence,
      recommendedPractice: coachingIntelligence.recommendedPractice,
      suggestedAutoForgeModule: coachingIntelligence.suggestedAutoForgeModule,
    } : undefined,
    coachingPrioritySummary,
    autoForgeRecommendationSummary: {
      module: autoforgeModule,
      why: autoforgeReason,
      action: 'Launch AutoForge Session',
    },
    trendHighlights,
    benchmarkSnapshot: {
      benchmarkType: benchmarkData.benchmarkType,
      highlights: benchmarkData.outliers.slice(0, 5),
    },
    narrativeSummary,
    benchmarkData,
    environment,
  };
}

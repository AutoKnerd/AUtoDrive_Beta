import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { loadFreshUpSessionsForExport, loadNamesById } from '@/lib/fresh-up-export/query';
import type { FreshUpNormalizedSession } from '@/lib/fresh-up-export/types';
import type {
  CoachingEntityType,
  CoachingEngineRunOptions,
  CoachingInsightRecord,
  CoachingPriorityLevel,
  CoachingSignalContext,
  CoachingTopic,
} from '@/lib/coaching-intelligence/types';
import { buildRoleAdaptiveWeaknessLine, inferAisRoleTypeFromSessions } from '@/lib/ais-score-interpretation';

const DEFAULT_ENVIRONMENT: 'sandbox' | 'production' = 'production';
const LOOKBACK_DAYS = 30;
const CONSULTANT_RECENT_LIMIT = 5;

const PRIORITY_BY_SCORE: Array<{ min: number; level: CoachingPriorityLevel }> = [
  { min: 80, level: 'critical' },
  { min: 60, level: 'high' },
  { min: 35, level: 'medium' },
  { min: 0, level: 'low' },
];

const TOPIC_PRACTICE_MAP: Record<CoachingTopic, string> = {
  'Discovery and Needs Assessment': 'Ask one additional needs-based question before presenting options.',
  'Trust Building': 'Use transparent language and confirm concern understanding before numbers.',
  'Active Listening': 'Reflect the customer’s stated priority before moving to product details.',
  'Handling Price Conversations': 'Slow the price discussion and reconnect to value and needs first.',
  'Handling Trade Conversations': 'Acknowledge vehicle attachment before discussing appraisal details.',
  'Handling Payment Conversations': 'Clarify budget boundaries, then return to needs before payment math.',
  'Guiding the Next Step': 'Practice a clear, low-pressure next step ask at the right moment.',
  'Relationship Building': 'Add one genuine rapport checkpoint before transitioning to closing language.',
  'Technology Explanation': 'Use plain language and ask for confirmation after each feature explanation.',
  'Handling Skeptical Buyers': 'Lead with calm transparency and invite concerns early.',
  'Handling Analytical Buyers': 'Use structured comparisons and clear factual checkpoints.',
  'Handling Time-Pressed Buyers': 'Summarize quickly, prioritize core needs, and confirm timing expectations.',
};

const TOPIC_AUTOFORGE_MAP: Record<CoachingTopic, string> = {
  'Discovery and Needs Assessment': 'Discovery Before Numbers',
  'Trust Building': 'Trust Through Discovery',
  'Active Listening': 'Active Listening Workshop',
  'Handling Price Conversations': 'Discovery Before Numbers',
  'Handling Trade Conversations': 'Trust Through Discovery',
  'Handling Payment Conversations': 'Discovery Before Numbers',
  'Guiding the Next Step': 'Guiding the Customer to the Next Step',
  'Relationship Building': 'Personal Connection Builder',
  'Technology Explanation': 'Product Clarity and Confidence',
  'Handling Skeptical Buyers': 'Trust Through Discovery',
  'Handling Analytical Buyers': 'Structured Discovery for Analytical Buyers',
  'Handling Time-Pressed Buyers': 'Guiding the Customer to the Next Step',
};

const SKILL_KEYS = [
  { label: 'Empathy', selector: (row: FreshUpNormalizedSession) => row.scores.empathy },
  { label: 'Listening', selector: (row: FreshUpNormalizedSession) => row.scores.listening },
  { label: 'Trust', selector: (row: FreshUpNormalizedSession) => row.scores.trust },
  { label: 'Follow Up', selector: (row: FreshUpNormalizedSession) => row.scores.followUp },
  { label: 'Closing', selector: (row: FreshUpNormalizedSession) => row.scores.closing },
  { label: 'Relationship', selector: (row: FreshUpNormalizedSession) => row.scores.relationship },
] as const;

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
  let maxCount = 0;
  counts.forEach((count, value) => {
    if (count > maxCount) {
      winner = value;
      maxCount = count;
    }
  });
  return winner;
}

function hash(input: string): string {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = ((value << 5) - value) + input.charCodeAt(index);
    value |= 0;
  }
  return Math.abs(value).toString(36);
}

function toPriorityLevel(priorityScore: number): CoachingPriorityLevel {
  const match = PRIORITY_BY_SCORE.find((entry) => priorityScore >= entry.min);
  return match?.level || 'low';
}

function splitByRecentWindows(rows: FreshUpNormalizedSession[]): { currentRows: FreshUpNormalizedSession[]; previousRows: FreshUpNormalizedSession[] } {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const currentStart = now - (LOOKBACK_DAYS * dayMs);
  const previousStart = now - (LOOKBACK_DAYS * 2 * dayMs);
  return {
    currentRows: rows.filter((row) => row.timestamp.getTime() >= currentStart),
    previousRows: rows.filter((row) => row.timestamp.getTime() >= previousStart && row.timestamp.getTime() < currentStart),
  };
}

function weakestSkill(rows: FreshUpNormalizedSession[]): { label: string; value: number } {
  const ranked = SKILL_KEYS.map((skill) => ({
    label: skill.label,
    value: avg(rows.map((row) => skill.selector(row))),
  })).sort((a, b) => a.value - b.value);
  return ranked[0] || { label: 'Trust', value: 0 };
}

function negativeOutcomeRate(rows: FreshUpNormalizedSession[]): number {
  return pct(rows.filter((row) => (
    row.outcomeTag === 'Lost Momentum'
    || row.outcomeTag === 'Conversation Breakdown'
    || row.endingType === 'stalled_conversation'
    || row.endingType === 'trust_break'
  )).length, rows.length);
}

function concernToTopic(concern: string): CoachingTopic | null {
  const normalized = concern.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('price')) return 'Handling Price Conversations';
  if (normalized.includes('trade')) return 'Handling Trade Conversations';
  if (normalized.includes('payment')) return 'Handling Payment Conversations';
  if (normalized.includes('technology') || normalized.includes('tech')) return 'Technology Explanation';
  if (normalized.includes('time')) return 'Handling Time-Pressed Buyers';
  return null;
}

function archetypeToTopic(archetype: string): CoachingTopic | null {
  const normalized = archetype.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('skeptic')) return 'Handling Skeptical Buyers';
  if (normalized.includes('analytical') || normalized.includes('analytic')) return 'Handling Analytical Buyers';
  if (normalized.includes('time')) return 'Handling Time-Pressed Buyers';
  return null;
}

function skillToTopic(skillLabel: string): CoachingTopic {
  if (skillLabel === 'Listening') return 'Active Listening';
  if (skillLabel === 'Trust') return 'Trust Building';
  if (skillLabel === 'Closing') return 'Guiding the Next Step';
  if (skillLabel === 'Relationship') return 'Relationship Building';
  if (skillLabel === 'Empathy') return 'Discovery and Needs Assessment';
  if (skillLabel === 'Follow Up') return 'Guiding the Next Step';
  return 'Trust Building';
}

function topicFromSignals(input: {
  weakSkill: string;
  concernFriction: string;
  archetypeFriction: string;
  repeatedTag: string;
}): CoachingTopic {
  const concernTopic = concernToTopic(input.concernFriction);
  if (concernTopic) return concernTopic;
  const archetypeTopic = archetypeToTopic(input.archetypeFriction);
  if (archetypeTopic) return archetypeTopic;

  const tag = input.repeatedTag.toLowerCase();
  if (tag.includes('price')) return 'Handling Price Conversations';
  if (tag.includes('payment')) return 'Handling Payment Conversations';
  if (tag.includes('trade')) return 'Handling Trade Conversations';
  if (tag.includes('listen')) return 'Active Listening';
  if (tag.includes('trust')) return 'Trust Building';
  if (tag.includes('close')) return 'Guiding the Next Step';
  if (tag.includes('relationship')) return 'Relationship Building';

  return skillToTopic(input.weakSkill);
}

function computePriorityScore(input: {
  weakestSkillScore: number;
  negativeOutcomeRate: number;
  trustAverage: number;
  trustTrendDelta: number;
  frequencyScore: number;
  riskSignals: number;
  alertSignals: number;
  goalSignals: number;
}): number {
  const severity = Math.max(0, 60 - input.weakestSkillScore) * 1.8;
  const frequency = Math.max(0, Math.min(25, input.frequencyScore));
  const trustImpact = (Math.max(0, 62 - input.trustAverage) * 1.2) + Math.max(0, input.negativeOutcomeRate - 20) * 0.7;
  const trendImpact = input.trustTrendDelta < 0 ? Math.abs(input.trustTrendDelta) * 1.5 : 0;
  const signalBoost = (input.riskSignals * 6) + (input.alertSignals * 4) + (input.goalSignals * 5);
  const raw = severity + frequency + trustImpact + trendImpact + signalBoost;
  return Math.max(0, Math.min(100, round(raw)));
}

function messageForTopic(topic: CoachingTopic, entityName: string, roleHintLine: string): string {
  return `${entityName} should prioritize ${topic.toLowerCase()} next to improve trust and progression. ${roleHintLine}`;
}

function buildEvidence(input: {
  weakSkill: string;
  weakSkillScore: number;
  trustAverage: number;
  trustDelta: number;
  negativeOutcomeRate: number;
  repeatedTag: string;
  archetypeFriction: string;
  concernFriction: string;
}): string {
  const trendDirection = input.trustDelta >= 0 ? 'up' : 'down';
  return [
    `${input.weakSkill} averages ${round(input.weakSkillScore)}.`,
    `Trust is ${round(input.trustAverage)} (${trendDirection} ${Math.abs(round(input.trustDelta))} vs prior period).`,
    `Negative outcomes are ${round(input.negativeOutcomeRate)}%.`,
    input.repeatedTag ? `Recurring coaching tag: ${input.repeatedTag}.` : '',
    input.archetypeFriction ? `Friction archetype: ${input.archetypeFriction}.` : '',
    input.concernFriction ? `Friction concern: ${input.concernFriction}.` : '',
  ].filter(Boolean).join(' ');
}

export function buildCoachingInsight(input: {
  entityType: CoachingEntityType;
  entityId: string;
  entityName: string;
  environment: 'sandbox' | 'production';
  context: CoachingSignalContext;
}): CoachingInsightRecord | null {
  const currentRows = [...input.context.currentRows].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  if (!currentRows.length) return null;
  const rowsForScoring = input.entityType === 'consultant' ? currentRows.slice(0, CONSULTANT_RECENT_LIMIT) : currentRows;
  const previousRows = input.context.previousRows;
  const weakSkill = weakestSkill(rowsForScoring);
  const trustAverage = avg(rowsForScoring.map((row) => row.scores.trust));
  const previousTrust = avg(previousRows.map((row) => row.scores.trust));
  const trustDelta = trustAverage - previousTrust;
  const repeatedTag = mostCommon(rowsForScoring.map((row) => row.coachingTag || row.summaryTag));
  const concernFriction = mostCommon(rowsForScoring
    .filter((row) => row.outcomeTag === 'Lost Momentum' || row.outcomeTag === 'Conversation Breakdown')
    .map((row) => row.primaryConcern));
  const archetypeFriction = mostCommon(rowsForScoring
    .filter((row) => row.outcomeTag === 'Lost Momentum' || row.outcomeTag === 'Conversation Breakdown')
    .map((row) => row.archetypeCategory || row.personalityType));
  const negativeRate = negativeOutcomeRate(rowsForScoring);
  const weakFrequency = pct(rowsForScoring.filter((row) => (
    row.scores.trust < 60
    || row.scores.listening < 60
    || row.scores.closing < 60
  )).length, rowsForScoring.length);
  const riskSignals = (input.context.riskSignals || []).length;
  const alertSignals = (input.context.alertSignals || []).length;
  const goalSignals = (input.context.goalSignals || []).filter((goal) => (
    String(goal.status || '').toLowerCase() === 'at_risk'
    || String(goal.status || '').toLowerCase() === 'stalled'
  )).length;

  const priorityScore = computePriorityScore({
    weakestSkillScore: weakSkill.value,
    negativeOutcomeRate: negativeRate,
    trustAverage,
    trustTrendDelta: trustDelta,
    frequencyScore: weakFrequency,
    riskSignals,
    alertSignals,
    goalSignals,
  });
  const priorityLevel = toPriorityLevel(priorityScore);
  const roleType = inferAisRoleTypeFromSessions(rowsForScoring);
  const roleWeaknessLine = buildRoleAdaptiveWeaknessLine({
    roleType,
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
    concernCategory: concernFriction || undefined,
  });
  const coachingTopic = topicFromSignals({
    weakSkill: weakSkill.label,
    concernFriction,
    archetypeFriction,
    repeatedTag,
  });
  const recommendedPractice = TOPIC_PRACTICE_MAP[coachingTopic];
  const suggestedAutoForgeModule = TOPIC_AUTOFORGE_MAP[coachingTopic];
  const supportingEvidence = buildEvidence({
    weakSkill: weakSkill.label,
    weakSkillScore: weakSkill.value,
    trustAverage,
    trustDelta,
    negativeOutcomeRate: negativeRate,
    repeatedTag,
    archetypeFriction,
    concernFriction,
  });
  const now = new Date();
  const coachingId = `fuci-${hash([
    input.entityType,
    input.entityId || 'platform',
    coachingTopic,
    input.environment,
    `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`,
  ].join('|'))}`;

  return {
    coachingId,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.entityName,
    priorityLevel,
    priorityScore,
    coachingTopic,
    message: messageForTopic(coachingTopic, input.entityName, roleWeaknessLine),
    supportingEvidence,
    recommendedPractice,
    suggestedAutoForgeModule,
    createdAt: now,
    environment: input.environment,
    sourceSignals: {
      weakestSkill: weakSkill.label,
      weakestSkillScore: round(weakSkill.value),
      repeatedCoachingTag: repeatedTag,
      archetypeFriction,
      concernFriction,
      negativeOutcomeRate: round(negativeRate),
      trustAverage: round(trustAverage),
      upMeterPeakAverage: round(avg(rowsForScoring.map((row) => row.upMeterPeak))),
      goalSignals,
      riskSignals,
      alertSignals,
      sessionsAnalyzed: rowsForScoring.length,
    },
  };
}

async function loadRiskSignals(input: {
  db: Firestore;
  environment: 'sandbox' | 'production';
}): Promise<Array<{ entityType: string; entityId: string; riskType: string; riskLevel: string; message: string }>> {
  try {
    const snap = await input.db.collection('freshUpRiskRadar')
      .where('environment', '==', input.environment)
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();
    return snap.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        entityType: String(data.entityType || ''),
        entityId: String(data.entityId || ''),
        riskType: String(data.riskType || ''),
        riskLevel: String(data.riskLevel || 'low'),
        message: String(data.message || ''),
      };
    });
  } catch {
    return [];
  }
}

async function loadAlertSignals(input: {
  db: Firestore;
  environment: 'sandbox' | 'production';
}): Promise<Array<{ entityType: string; entityId: string; alertType: string; severity: string; message: string }>> {
  try {
    const snap = await input.db.collection('freshUpAlerts')
      .where('environment', '==', input.environment)
      .where('resolved', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(500)
      .get();
    return snap.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        entityType: String(data.entityType || ''),
        entityId: String(data.entityId || ''),
        alertType: String(data.alertType || ''),
        severity: String(data.severity || 'low'),
        message: String(data.message || ''),
      };
    });
  } catch {
    return [];
  }
}

async function loadGoalSignals(input: {
  db: Firestore;
}): Promise<Array<{ dealerId: string; userId: string; metric: string; status: string; goalTitle: string }>> {
  try {
    const snap = await input.db.collection('freshUpGoals').where('status', '==', 'active').limit(500).get();
    return snap.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        dealerId: String(data.dealerId || ''),
        userId: String(data.userId || ''),
        metric: String(data.metric || ''),
        status: String(data.status || 'active'),
        goalTitle: String(data.name || data.goalTitle || 'Goal'),
      };
    });
  } catch {
    return [];
  }
}

function entityScopedSignals(input: {
  entityType: CoachingEntityType;
  entityId: string;
  risks: Array<{ entityType: string; entityId: string; riskType: string; riskLevel: string; message: string }>;
  alerts: Array<{ entityType: string; entityId: string; alertType: string; severity: string; message: string }>;
  goals: Array<{ dealerId: string; userId: string; metric: string; status: string; goalTitle: string }>;
}): CoachingSignalContext {
  const riskSignals = input.risks.filter((risk) => {
    if (input.entityType === 'platform') return true;
    if (risk.entityId === input.entityId) return true;
    if (input.entityType === 'consultant') return risk.entityType === 'dealer' || risk.entityType === 'platform';
    return risk.entityType === 'platform';
  }).map((risk) => ({
    riskType: risk.riskType,
    riskLevel: risk.riskLevel,
    message: risk.message,
  }));

  const alertSignals = input.alerts.filter((alert) => {
    if (input.entityType === 'platform') return true;
    if (alert.entityId === input.entityId) return true;
    if (input.entityType === 'consultant') return alert.entityType === 'dealer' || alert.entityType === 'platform';
    return alert.entityType === 'platform';
  }).map((alert) => ({
    alertType: alert.alertType,
    severity: alert.severity,
    message: alert.message,
  }));

  const goalSignals = input.goals.filter((goal) => {
    if (input.entityType === 'platform') return true;
    if (input.entityType === 'consultant') return goal.userId === input.entityId;
    return goal.dealerId === input.entityId;
  }).map((goal) => ({
    metric: goal.metric,
    status: goal.status,
    goalTitle: goal.goalTitle,
  }));

  return {
    currentRows: [],
    previousRows: [],
    riskSignals,
    alertSignals,
    goalSignals,
  };
}

function weekAgo(now: Date): Date {
  return new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
}

async function suppressRecentDuplicates(input: {
  db: Firestore;
  records: CoachingInsightRecord[];
}): Promise<CoachingInsightRecord[]> {
  const cutoff = weekAgo(new Date());
  const snap = await input.db.collection('freshUpCoachingInsights')
    .where('createdAt', '>=', Timestamp.fromDate(cutoff))
    .limit(1000)
    .get();
  const existingByEntityTopic = new Map<string, CoachingInsightRecord>();
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const key = [
      String(data.entityType || ''),
      String(data.entityId || ''),
      String(data.coachingTopic || ''),
      String(data.environment || ''),
    ].join('|');
    const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(0);
    const priorityLevel = String(data.priorityLevel || 'low') as CoachingPriorityLevel;
    existingByEntityTopic.set(key, {
      coachingId: String(data.coachingId || docSnap.id),
      entityType: String(data.entityType || 'dealer') as CoachingEntityType,
      entityId: String(data.entityId || ''),
      entityName: String(data.entityName || ''),
      priorityLevel,
      priorityScore: Number(data.priorityScore || 0),
      coachingTopic: String(data.coachingTopic || 'Trust Building') as CoachingTopic,
      message: String(data.message || ''),
      supportingEvidence: String(data.supportingEvidence || ''),
      recommendedPractice: String(data.recommendedPractice || ''),
      suggestedAutoForgeModule: String(data.suggestedAutoForgeModule || ''),
      createdAt,
      resolvedAt: data.resolvedAt instanceof Timestamp ? data.resolvedAt.toDate() : undefined,
      environment: String(data.environment || 'production') === 'sandbox' ? 'sandbox' : 'production',
      sourceSignals: {
        weakestSkill: '',
        weakestSkillScore: 0,
        repeatedCoachingTag: '',
        archetypeFriction: '',
        concernFriction: '',
        negativeOutcomeRate: 0,
        trustAverage: 0,
        upMeterPeakAverage: 0,
        goalSignals: 0,
        riskSignals: 0,
        alertSignals: 0,
        sessionsAnalyzed: 0,
      },
    });
  });

  const rank: Record<CoachingPriorityLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  return input.records.filter((record) => {
    const key = [record.entityType, record.entityId, record.coachingTopic, record.environment].join('|');
    const existing = existingByEntityTopic.get(key);
    if (!existing) return true;
    return rank[record.priorityLevel] > rank[existing.priorityLevel];
  });
}

async function persistInsights(input: {
  db: Firestore;
  insights: CoachingInsightRecord[];
}): Promise<void> {
  if (!input.insights.length) return;
  const batch = input.db.batch();
  input.insights.forEach((insight) => {
    const ref = input.db.collection('freshUpCoachingInsights').doc(insight.coachingId);
    batch.set(ref, {
      coachingId: insight.coachingId,
      entityType: insight.entityType,
      entityId: insight.entityId,
      entityName: insight.entityName,
      priorityLevel: insight.priorityLevel,
      priorityScore: insight.priorityScore,
      coachingTopic: insight.coachingTopic,
      message: insight.message,
      supportingEvidence: insight.supportingEvidence,
      recommendedPractice: insight.recommendedPractice,
      suggestedAutoForgeModule: insight.suggestedAutoForgeModule,
      sourceSignals: insight.sourceSignals,
      createdAt: FieldValue.serverTimestamp(),
      resolvedAt: null,
      environment: insight.environment,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();
}

function selectRowsByEntity(rows: FreshUpNormalizedSession[], entityType: CoachingEntityType, entityId: string): FreshUpNormalizedSession[] {
  if (entityType === 'consultant') return rows.filter((row) => row.userId === entityId);
  if (entityType === 'dealer' || entityType === 'team') return rows.filter((row) => row.dealerId === entityId);
  return rows;
}

export async function generateCoachingIntelligence(input: {
  db: Firestore;
  options?: CoachingEngineRunOptions;
}): Promise<{
  generatedCount: number;
  savedCount: number;
  environment: 'sandbox' | 'production';
  records: CoachingInsightRecord[];
}> {
  const includeSandboxData = input.options?.includeSandboxData === true;
  const environment = input.options?.environment || (includeSandboxData ? 'sandbox' : DEFAULT_ENVIRONMENT);
  const sessions = await loadFreshUpSessionsForExport({
    adminDb: input.db,
    filters: {
      includeSandboxData,
      environment: includeSandboxData ? undefined : environment,
      dateFrom: new Date(Date.now() - (LOOKBACK_DAYS * 2 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10),
    },
  });
  const scoped = includeSandboxData ? sessions : sessions.filter((session) => session.environment === environment);
  const { dealerNameById, userNameById } = await loadNamesById({
    adminDb: input.db,
    sessions: scoped,
  });
  const risks = await loadRiskSignals({ db: input.db, environment });
  const alerts = await loadAlertSignals({ db: input.db, environment });
  const goals = await loadGoalSignals({ db: input.db });

  const consultantIds = Array.from(new Set(scoped.map((row) => row.userId).filter(Boolean)));
  const dealerIds = Array.from(new Set(scoped.map((row) => row.dealerId).filter(Boolean)));
  const targets: Array<{ entityType: CoachingEntityType; entityId: string; entityName: string }> = [];

  if (input.options?.entityType && input.options?.entityId) {
    const entityType = input.options.entityType;
    const entityId = input.options.entityId;
    const entityName = entityType === 'consultant'
      ? (userNameById.get(entityId) || entityId)
      : entityType === 'platform'
        ? 'Platform'
        : (dealerNameById.get(entityId) || entityId);
    targets.push({ entityType, entityId, entityName });
  } else {
    targets.push({ entityType: 'platform', entityId: 'platform', entityName: 'Platform' });
    dealerIds.forEach((dealerId) => {
      const dealerName = dealerNameById.get(dealerId) || dealerId;
      targets.push({ entityType: 'dealer', entityId: dealerId, entityName: dealerName });
      targets.push({ entityType: 'team', entityId: dealerId, entityName: `${dealerName} Team` });
    });
    consultantIds.forEach((consultantId) => {
      targets.push({
        entityType: 'consultant',
        entityId: consultantId,
        entityName: userNameById.get(consultantId) || consultantId,
      });
    });
  }

  const insights: CoachingInsightRecord[] = [];
  targets.forEach((target) => {
    const entityRows = selectRowsByEntity(scoped, target.entityType, target.entityId);
    const windows = splitByRecentWindows(entityRows);
    const scopedSignals = entityScopedSignals({
      entityType: target.entityType,
      entityId: target.entityId,
      risks,
      alerts,
      goals,
    });
    const insight = buildCoachingInsight({
      entityType: target.entityType,
      entityId: target.entityId,
      entityName: target.entityName,
      environment,
      context: {
        currentRows: windows.currentRows,
        previousRows: windows.previousRows,
        riskSignals: scopedSignals.riskSignals,
        alertSignals: scopedSignals.alertSignals,
        goalSignals: scopedSignals.goalSignals,
      },
    });
    if (insight) insights.push(insight);
  });

  const filteredInsights = await suppressRecentDuplicates({
    db: input.db,
    records: insights,
  });
  await persistInsights({
    db: input.db,
    insights: filteredInsights,
  });

  return {
    generatedCount: insights.length,
    savedCount: filteredInsights.length,
    environment,
    records: filteredInsights,
  };
}

export async function loadCoachingInsights(input: {
  db: Firestore;
  entityType?: CoachingEntityType;
  entityId?: string;
  includeResolved?: boolean;
  includeSandboxData?: boolean;
  environment?: 'sandbox' | 'production';
  limit?: number;
}): Promise<CoachingInsightRecord[]> {
  const environment = input.environment || (input.includeSandboxData ? 'sandbox' : DEFAULT_ENVIRONMENT);
  let query = input.db.collection('freshUpCoachingInsights')
    .where('environment', '==', environment)
    .orderBy('createdAt', 'desc')
    .limit(Math.max(1, Math.min(500, input.limit ?? 100)));
  if (input.entityType) query = query.where('entityType', '==', input.entityType);
  if (input.entityId) query = query.where('entityId', '==', input.entityId);

  const snap = await query.get();
  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      const resolvedAt = data.resolvedAt instanceof Timestamp ? data.resolvedAt.toDate() : undefined;
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(0);
      return {
        coachingId: String(data.coachingId || docSnap.id),
        entityType: String(data.entityType || 'dealer') as CoachingEntityType,
        entityId: String(data.entityId || ''),
        entityName: String(data.entityName || ''),
        priorityLevel: String(data.priorityLevel || 'low') as CoachingPriorityLevel,
        priorityScore: Number(data.priorityScore || 0),
        coachingTopic: String(data.coachingTopic || 'Trust Building') as CoachingTopic,
        message: String(data.message || ''),
        supportingEvidence: String(data.supportingEvidence || ''),
        recommendedPractice: String(data.recommendedPractice || ''),
        suggestedAutoForgeModule: String(data.suggestedAutoForgeModule || ''),
        createdAt,
        resolvedAt,
        environment: (String(data.environment || 'production') === 'sandbox' ? 'sandbox' : 'production') as 'sandbox' | 'production',
        sourceSignals: (data.sourceSignals as CoachingInsightRecord['sourceSignals'] | undefined) || {
          weakestSkill: '',
          weakestSkillScore: 0,
          repeatedCoachingTag: '',
          archetypeFriction: '',
          concernFriction: '',
          negativeOutcomeRate: 0,
          trustAverage: 0,
          upMeterPeakAverage: 0,
          goalSignals: 0,
          riskSignals: 0,
          alertSignals: 0,
          sessionsAnalyzed: 0,
        },
      };
    })
    .filter((row) => input.includeResolved === true ? true : !row.resolvedAt);
}

export async function markCoachingInsightResolved(input: {
  db: Firestore;
  coachingId: string;
  resolved: boolean;
}): Promise<void> {
  await input.db.collection('freshUpCoachingInsights').doc(input.coachingId).set({
    resolvedAt: input.resolved ? FieldValue.serverTimestamp() : null,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

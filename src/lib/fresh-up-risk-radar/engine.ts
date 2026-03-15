import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { loadFreshUpSessionsForExport, loadNamesById } from '@/lib/fresh-up-export/query';
import type { FreshUpNormalizedSession } from '@/lib/fresh-up-export/types';
import type {
  FreshUpRiskConfidence,
  FreshUpRiskEntityType,
  FreshUpRiskLevel,
  FreshUpRiskRadarGenerationInput,
  FreshUpRiskRecord,
  FreshUpRiskType,
} from '@/lib/fresh-up-risk-radar/types';

const SKILLS = [
  { key: 'empathy', label: 'Empathy' },
  { key: 'listening', label: 'Listening' },
  { key: 'trust', label: 'Trust' },
  { key: 'followUp', label: 'Follow Up' },
  { key: 'closing', label: 'Closing' },
  { key: 'relationship', label: 'Relationship' },
] as const;

const LEVEL_RANK: Record<FreshUpRiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function makeRiskId(input: {
  riskType: FreshUpRiskType;
  entityType: FreshUpRiskEntityType;
  entityId: string;
  key?: string;
  environment: 'sandbox' | 'production';
}): string {
  const raw = [input.riskType, input.entityType, input.entityId, input.key || '', input.environment].join('|');
  const hash = [...raw].reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0);
  return `fur-${Math.abs(hash).toString(36)}`;
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

function skillValue(row: FreshUpNormalizedSession, skill: (typeof SKILLS)[number]['key']): number {
  if (skill === 'empathy') return row.scores.empathy;
  if (skill === 'listening') return row.scores.listening;
  if (skill === 'trust') return row.scores.trust;
  if (skill === 'followUp') return row.scores.followUp;
  if (skill === 'closing') return row.scores.closing;
  return row.scores.relationship;
}

function negativeOutcomeRate(rows: FreshUpNormalizedSession[]): number {
  const negative = rows.filter((row) => (
    row.outcomeTag === 'Lost Momentum'
    || row.outcomeTag === 'Conversation Breakdown'
    || row.endingType === 'stalled_conversation'
    || row.endingType === 'trust_break'
  )).length;
  return pct(negative, rows.length);
}

function levelByMagnitude(magnitude: number): FreshUpRiskLevel {
  if (magnitude >= 20) return 'critical';
  if (magnitude >= 12) return 'high';
  if (magnitude >= 7) return 'medium';
  return 'low';
}

function confidenceForSample(sampleSize: number, hasTrend = true): FreshUpRiskConfidence {
  if (sampleSize >= 60 && hasTrend) return 'high';
  if (sampleSize >= 20) return 'medium';
  return 'low';
}

function topByCount(values: string[]): { value: string; count: number } {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  let winner = '';
  let count = 0;
  counts.forEach((c, value) => {
    if (c > count) {
      winner = value;
      count = c;
    }
  });
  return { value: winner, count };
}

function compare(current: number, previous: number): { delta: number; deltaPercent: number } {
  const delta = current - previous;
  const deltaPercent = previous === 0 ? 0 : (delta / previous) * 100;
  return { delta: round(delta), deltaPercent: round(deltaPercent) };
}

function buildRisk(input: {
  riskType: FreshUpRiskType;
  entityType: FreshUpRiskEntityType;
  entityId: string;
  entityName: string;
  riskLevel: FreshUpRiskLevel;
  confidenceLevel: FreshUpRiskConfidence;
  message: string;
  recommendedAction: string;
  supportingMetrics: Record<string, number | string | boolean>;
  environment: 'sandbox' | 'production';
  key?: string;
}): FreshUpRiskRecord {
  return {
    riskId: makeRiskId({
      riskType: input.riskType,
      entityType: input.entityType,
      entityId: input.entityId,
      key: input.key,
      environment: input.environment,
    }),
    riskType: input.riskType,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.entityName,
    riskLevel: input.riskLevel,
    confidenceLevel: input.confidenceLevel,
    timeRange: 'current_30_vs_previous_30',
    message: input.message,
    recommendedAction: input.recommendedAction,
    supportingMetrics: input.supportingMetrics,
    createdAt: new Date(),
    isActive: true,
    environment: input.environment,
  };
}

async function loadExistingRisks(db: Firestore, environment: 'sandbox' | 'production'): Promise<Map<string, FreshUpRiskRecord>> {
  const snap = await db.collection('freshUpRiskRadar')
    .where('environment', '==', environment)
    .where('createdAt', '>=', Timestamp.fromDate(new Date(Date.now() - (120 * 24 * 60 * 60 * 1000))))
    .get();
  const map = new Map<string, FreshUpRiskRecord>();
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    map.set(docSnap.id, {
      riskId: String(data.riskId || docSnap.id),
      riskType: String(data.riskType || '') as FreshUpRiskType,
      entityType: String(data.entityType || '') as FreshUpRiskEntityType,
      entityId: String(data.entityId || ''),
      entityName: String(data.entityName || ''),
      riskLevel: String(data.riskLevel || 'low') as FreshUpRiskLevel,
      confidenceLevel: String(data.confidenceLevel || 'low') as FreshUpRiskConfidence,
      timeRange: String(data.timeRange || ''),
      message: String(data.message || ''),
      recommendedAction: String(data.recommendedAction || ''),
      supportingMetrics: (data.supportingMetrics as Record<string, number | string | boolean> | undefined) || {},
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
      resolvedAt: data.resolvedAt instanceof Timestamp ? data.resolvedAt.toDate() : undefined,
      isActive: data.isActive !== false,
      environment: String(data.environment || 'production') === 'sandbox' ? 'sandbox' : 'production',
    });
  });
  return map;
}

function dedupeKey(risk: FreshUpRiskRecord): string {
  return [
    risk.riskType,
    risk.entityType,
    risk.entityId,
    JSON.stringify(risk.supportingMetrics),
    risk.environment,
  ].join('|');
}

function shouldSuppress(existing: FreshUpRiskRecord | undefined, next: FreshUpRiskRecord): boolean {
  if (!existing) return false;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const recent = (Date.now() - existing.createdAt.getTime()) < sevenDaysMs;
  if (!recent) return false;
  if (!existing.isActive) return false;
  return LEVEL_RANK[next.riskLevel] <= LEVEL_RANK[existing.riskLevel];
}

async function loadGoalRecords(db: Firestore): Promise<Array<Record<string, unknown>>> {
  try {
    const snap = await db.collection('freshUpGoals').where('status', '==', 'active').limit(1000).get();
    return snap.docs.map((docSnap) => docSnap.data() as Record<string, unknown>);
  } catch {
    return [];
  }
}

function riskRowsForDealer(input: {
  dealerId: string;
  dealerName: string;
  rows: FreshUpNormalizedSession[];
  platformRows: FreshUpNormalizedSession[];
  environment: 'sandbox' | 'production';
}): FreshUpRiskRecord[] {
  const risks: FreshUpRiskRecord[] = [];
  const windows = splitWindows(input.rows);
  const current = windows.current;
  const previous = windows.previous;
  if (!current.length) return risks;

  const currentTrust = avg(current.map((row) => row.scores.trust));
  const previousTrust = avg(previous.map((row) => row.scores.trust));
  const trustShiftCurrent = avg(current.map((row) => row.trustShift));
  const trustShiftPrevious = avg(previous.map((row) => row.trustShift));
  const trustCompare = compare(currentTrust, previousTrust);
  const trustShiftCompare = compare(trustShiftCurrent, trustShiftPrevious);
  const breakdownCurrent = negativeOutcomeRate(current);
  const breakdownPrevious = negativeOutcomeRate(previous);
  const breakdownCompare = compare(breakdownCurrent, breakdownPrevious);
  if (currentTrust < 60 || trustCompare.delta <= -6 || trustShiftCompare.delta <= -4) {
    const severityMagnitude = Math.max(Math.abs(trustCompare.delta), Math.abs(trustShiftCompare.delta), breakdownCompare.delta);
    risks.push(buildRisk({
      riskType: 'trust_risk',
      entityType: 'dealer',
      entityId: input.dealerId,
      entityName: input.dealerName,
      riskLevel: levelByMagnitude(severityMagnitude),
      confidenceLevel: confidenceForSample(current.length, true),
      message: 'Trust is weakening in high-pressure conversations. If this trend continues, early defensiveness is likely to increase.',
      recommendedAction: 'Coach discovery before numbers and reinforce transparent trust-building responses.',
      supportingMetrics: {
        currentTrust: round(currentTrust),
        previousTrust: round(previousTrust),
        trustDelta: trustCompare.delta,
        currentTrustShift: round(trustShiftCurrent),
        previousTrustShift: round(trustShiftPrevious),
        trustShiftDelta: trustShiftCompare.delta,
        breakdownRateDelta: breakdownCompare.delta,
      },
      environment: input.environment,
    }));
  }

  const upCurrent = avg(current.map((row) => row.upMeterPeak));
  const upPrevious = avg(previous.map((row) => row.upMeterPeak));
  const upCompare = compare(upCurrent, upPrevious);
  if (upCompare.delta <= -8) {
    risks.push(buildRisk({
      riskType: 'engagement_risk',
      entityType: 'dealer',
      entityId: input.dealerId,
      entityName: input.dealerName,
      riskLevel: levelByMagnitude(Math.abs(upCompare.delta)),
      confidenceLevel: confidenceForSample(current.length, true),
      message: 'Customers are engaging less deeply in recent sessions, with weaker momentum into later conversation stages.',
      recommendedAction: 'Focus on early acknowledgment language and reduce premature transitions.',
      supportingMetrics: {
        currentUpMeterPeak: round(upCurrent),
        previousUpMeterPeak: round(upPrevious),
        upMeterPeakDelta: upCompare.delta,
      },
      environment: input.environment,
    }));
  }

  const byArchetype = new Map<string, FreshUpNormalizedSession[]>();
  current.forEach((row) => {
    const key = row.archetypeCategory || row.archetypeName || '';
    if (!key) return;
    if (!byArchetype.has(key)) byArchetype.set(key, []);
    byArchetype.get(key)?.push(row);
  });
  const overallTrust = avg(current.map((row) => row.scores.trust));
  byArchetype.forEach((rows, key) => {
    if (rows.length < 5) return;
    const trust = avg(rows.map((row) => row.scores.trust));
    const up = avg(rows.map((row) => row.upMeterPeak));
    const breakdown = negativeOutcomeRate(rows);
    const gap = overallTrust - trust;
    if (gap >= 10 || breakdown >= (breakdownCurrent + 10)) {
      risks.push(buildRisk({
        riskType: 'archetype_risk',
        entityType: 'archetype',
        entityId: key,
        entityName: key,
        riskLevel: levelByMagnitude(Math.max(gap, breakdown - breakdownCurrent)),
        confidenceLevel: confidenceForSample(rows.length, true),
        message: `${key} customer types are becoming a growing friction point, with declining trust and weaker progression.`,
        recommendedAction: `Run a focused coaching block on ${key.toLowerCase()} interactions this week.`,
        supportingMetrics: {
          archetypeTrust: round(trust),
          dealerTrust: round(overallTrust),
          trustGap: round(gap),
          archetypeUpMeterPeak: round(up),
          archetypeBreakdownRate: round(breakdown),
        },
        environment: input.environment,
        key,
      }));
    }
  });

  const byConcern = new Map<string, FreshUpNormalizedSession[]>();
  current.forEach((row) => {
    const key = row.primaryConcern || '';
    if (!key) return;
    if (!byConcern.has(key)) byConcern.set(key, []);
    byConcern.get(key)?.push(row);
  });
  byConcern.forEach((rows, key) => {
    if (rows.length < 5) return;
    const trust = avg(rows.map((row) => row.scores.trust));
    const breakdown = negativeOutcomeRate(rows);
    const appointmentSetRate = pct(rows.filter((row) => row.outcomeTag === 'Appointment Set').length, rows.length);
    if (trust <= (currentTrust - 8) || breakdown >= (breakdownCurrent + 10)) {
      risks.push(buildRisk({
        riskType: 'concern_risk',
        entityType: 'concern',
        entityId: key,
        entityName: key,
        riskLevel: levelByMagnitude(Math.max((currentTrust - trust), breakdown - breakdownCurrent)),
        confidenceLevel: confidenceForSample(rows.length, true),
        message: `${key} conversations are showing rising trust loss and lower progression to next steps.`,
        recommendedAction: `Review ${key.toLowerCase()} handling and reinforce structured discovery before objection handling.`,
        supportingMetrics: {
          concernTrust: round(trust),
          dealerTrust: round(currentTrust),
          concernBreakdownRate: round(breakdown),
          dealerBreakdownRate: round(breakdownCurrent),
          concernAppointmentSetRate: round(appointmentSetRate),
        },
        environment: input.environment,
        key,
      }));
    }
  });

  for (const skill of SKILLS) {
    const c = avg(current.map((row) => skillValue(row, skill.key)));
    const p = avg(previous.map((row) => skillValue(row, skill.key)));
    const cmp = compare(c, p);
    if (cmp.delta <= -6) {
      risks.push(buildRisk({
        riskType: 'skill_decline_risk',
        entityType: 'dealer',
        entityId: input.dealerId,
        entityName: input.dealerName,
        riskLevel: levelByMagnitude(Math.abs(cmp.delta)),
        confidenceLevel: confidenceForSample(current.length, true),
        message: `${skill.label} is trending downward and may soon affect conversation quality if unaddressed.`,
        recommendedAction: `Coach ${skill.label.toLowerCase()} through targeted role-play and immediate follow-up practice.`,
        supportingMetrics: {
          skill: skill.label,
          current: round(c),
          previous: round(p),
          delta: cmp.delta,
        },
        environment: input.environment,
        key: skill.label,
      }));
    }
  }

  if (breakdownCompare.delta >= 10) {
    const most = topByCount(current
      .filter((row) => row.outcomeTag === 'Conversation Breakdown' || row.outcomeTag === 'Lost Momentum')
      .map((row) => row.archetypeCategory || row.primaryConcern || row.coachingTag));
    risks.push(buildRisk({
      riskType: 'breakdown_risk',
      entityType: 'dealer',
      entityId: input.dealerId,
      entityName: input.dealerName,
      riskLevel: levelByMagnitude(Math.abs(breakdownCompare.delta)),
      confidenceLevel: confidenceForSample(current.length, true),
      message: `Negative conversation outcomes are rising, with repeated friction around ${most.value || 'key customer patterns'}.`,
      recommendedAction: 'Prioritize trust + follow-up coaching in next team huddle and review breakdown transcripts.',
      supportingMetrics: {
        currentNegativeOutcomeRate: round(breakdownCurrent),
        previousNegativeOutcomeRate: round(breakdownPrevious),
        delta: breakdownCompare.delta,
        topFrictionPattern: most.value,
        topFrictionCount: most.count,
      },
      environment: input.environment,
    }));
  }

  const usageCurrent = current.length;
  const usagePrevious = previous.length;
  const usageDeltaPct = compare(usageCurrent, usagePrevious).deltaPercent;
  const activeConsultantsCurrent = new Set(current.map((row) => row.userId).filter(Boolean)).size;
  const activeConsultantsPrevious = new Set(previous.map((row) => row.userId).filter(Boolean)).size;
  if (usageDeltaPct <= -30 || activeConsultantsCurrent < Math.max(1, Math.floor(activeConsultantsPrevious * 0.7))) {
    risks.push(buildRisk({
      riskType: 'adoption_risk',
      entityType: 'dealer',
      entityId: input.dealerId,
      entityName: input.dealerName,
      riskLevel: levelByMagnitude(Math.abs(usageDeltaPct)),
      confidenceLevel: confidenceForSample(current.length, true),
      message: 'Fresh Up participation is declining enough to reduce coaching visibility if not corrected.',
      recommendedAction: 'Re-establish weekly practice cadence and assign one targeted Fresh Up block per consultant.',
      supportingMetrics: {
        currentSessions: usageCurrent,
        previousSessions: usagePrevious,
        sessionDeltaPercent: round(usageDeltaPct),
        currentActiveConsultants: activeConsultantsCurrent,
        previousActiveConsultants: activeConsultantsPrevious,
      },
      environment: input.environment,
    }));
  }

  const recurringCoachingTag = topByCount(current.map((row) => row.coachingTag));
  const repeatedWeak = recurringCoachingTag.count >= 6 && (breakdownCurrent >= 30 || currentTrust <= 60);
  if (repeatedWeak) {
    risks.push(buildRisk({
      riskType: 'coaching_delay_risk',
      entityType: 'dealer',
      entityId: input.dealerId,
      entityName: input.dealerName,
      riskLevel: levelByMagnitude(recurringCoachingTag.count),
      confidenceLevel: confidenceForSample(current.length, true),
      message: `Recurring coaching issue (${recurringCoachingTag.value}) is persisting without visible improvement trend.`,
      recommendedAction: 'Link this pattern to a specific AutoForge module and track the next three sessions for lift.',
      supportingMetrics: {
        recurringCoachingTag: recurringCoachingTag.value,
        recurringTagCount: recurringCoachingTag.count,
        currentTrust: round(currentTrust),
        currentNegativeOutcomeRate: round(breakdownCurrent),
      },
      environment: input.environment,
    }));
  }

  const currentVersion = topByCount(current.map((row) => row.freshUpVersionName || row.freshUpVersionId));
  const previousVersion = topByCount(previous.map((row) => row.freshUpVersionName || row.freshUpVersionId));
  if (currentVersion.value && previousVersion.value && currentVersion.value !== previousVersion.value) {
    const currentRowsForVersion = current.filter((row) => (row.freshUpVersionName || row.freshUpVersionId) === currentVersion.value);
    const previousRowsForVersion = previous.filter((row) => (row.freshUpVersionName || row.freshUpVersionId) === previousVersion.value);
    if (currentRowsForVersion.length >= 8 && previousRowsForVersion.length >= 8) {
      const curUp = avg(currentRowsForVersion.map((row) => row.upMeterPeak));
      const prevUp = avg(previousRowsForVersion.map((row) => row.upMeterPeak));
      const curBreak = negativeOutcomeRate(currentRowsForVersion);
      const prevBreak = negativeOutcomeRate(previousRowsForVersion);
      const curTrustShift = avg(currentRowsForVersion.map((row) => row.trustShift));
      const prevTrustShift = avg(previousRowsForVersion.map((row) => row.trustShift));
      if ((curUp <= prevUp - 6) || (curBreak >= prevBreak + 8) || (curTrustShift <= prevTrustShift - 4)) {
        risks.push(buildRisk({
          riskType: 'version_stability_risk',
          entityType: 'version',
          entityId: currentVersion.value,
          entityName: currentVersion.value,
          riskLevel: levelByMagnitude(Math.max(prevUp - curUp, curBreak - prevBreak, prevTrustShift - curTrustShift)),
          confidenceLevel: confidenceForSample(currentRowsForVersion.length, true),
          message: `Current Fresh Up version is underperforming prior version trends in trust or engagement for this dealer.`,
          recommendedAction: 'Pause rollout expansion and compare behavior with previous stable version.',
          supportingMetrics: {
            currentVersion: currentVersion.value,
            previousVersion: previousVersion.value,
            currentUpMeterPeak: round(curUp),
            previousUpMeterPeak: round(prevUp),
            currentNegativeOutcomeRate: round(curBreak),
            previousNegativeOutcomeRate: round(prevBreak),
            currentTrustShift: round(curTrustShift),
            previousTrustShift: round(prevTrustShift),
          },
          environment: input.environment,
        }));
      }
    }
  }

  return risks;
}

function riskRowsForConsultant(input: {
  rows: FreshUpNormalizedSession[];
  userNameById: Map<string, string>;
  environment: 'sandbox' | 'production';
}): FreshUpRiskRecord[] {
  const risks: FreshUpRiskRecord[] = [];
  const byConsultant = new Map<string, FreshUpNormalizedSession[]>();
  input.rows.forEach((row) => {
    if (!row.userId) return;
    if (!byConsultant.has(row.userId)) byConsultant.set(row.userId, []);
    byConsultant.get(row.userId)?.push(row);
  });

  byConsultant.forEach((rows, userId) => {
    const recent = [...rows].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);
    if (recent.length < 3) return;
    const trustAvg = avg(recent.map((row) => row.scores.trust));
    const recurringTag = topByCount(recent.map((row) => row.coachingTag || row.summaryTag));
    if (trustAvg < 60 || recurringTag.count >= 3) {
      risks.push(buildRisk({
        riskType: 'coaching_delay_risk',
        entityType: 'consultant',
        entityId: userId,
        entityName: input.userNameById.get(userId) || userId,
        riskLevel: levelByMagnitude(Math.max(60 - trustAvg, recurringTag.count * 4)),
        confidenceLevel: confidenceForSample(recent.length, true),
        message: `Repeated friction is emerging in recent sessions${recurringTag.value ? ` (${recurringTag.value})` : ''}, suggesting coaching action is overdue.`,
        recommendedAction: 'Assign targeted trust/listening lesson and review next 3 Fresh Ups for improvement.',
        supportingMetrics: {
          recentSessionCount: recent.length,
          averageTrustRecent5: round(trustAvg),
          recurringCoachingTag: recurringTag.value,
          recurringCoachingTagCount: recurringTag.count,
        },
        environment: input.environment,
      }));
    }
  });

  return risks;
}

async function riskRowsForGoals(input: {
  db: Firestore;
  environment: 'sandbox' | 'production';
  currentRows: FreshUpNormalizedSession[];
}): Promise<FreshUpRiskRecord[]> {
  const risks: FreshUpRiskRecord[] = [];
  const goals = await loadGoalRecords(input.db);
  if (!goals.length) return risks;

  for (const goal of goals) {
    const metric = String(goal.metric || '').toLowerCase();
    const target = Number(goal.targetValue ?? goal.target ?? 0);
    const deadline = goal.deadline instanceof Timestamp
      ? goal.deadline.toDate()
      : (goal.deadline ? new Date(String(goal.deadline)) : null);
    if (!metric || !Number.isFinite(target) || target <= 0 || !deadline || Number.isNaN(deadline.getTime())) continue;
    if (deadline.getTime() < Date.now()) continue;

    const dealerId = String(goal.dealerId || '');
    const rows = dealerId ? input.currentRows.filter((row) => row.dealerId === dealerId) : input.currentRows;
    if (!rows.length) continue;
    const currentValue = metric === 'trust'
      ? avg(rows.map((row) => row.scores.trust))
      : metric === 'listening'
        ? avg(rows.map((row) => row.scores.listening))
        : metric === 'closing'
          ? avg(rows.map((row) => row.scores.closing))
          : metric === 'up_meter_peak'
            ? avg(rows.map((row) => row.upMeterPeak))
            : avg(rows.map((row) => row.scores.relationship));
    const remainingDays = Math.max(1, Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
    const gap = target - currentValue;
    const requiredDailyLift = gap / remainingDays;
    if (gap > 0 && requiredDailyLift > 0.2) {
      risks.push(buildRisk({
        riskType: 'goal_failure_risk',
        entityType: 'goal',
        entityId: String(goal.goalId || goal.id || `${metric}-${dealerId || 'platform'}`),
        entityName: String(goal.name || `${metric.toUpperCase()} Goal`),
        riskLevel: levelByMagnitude(gap),
        confidenceLevel: confidenceForSample(rows.length, true),
        message: `Current pace is unlikely to reach the ${metric} target by deadline without intervention.`,
        recommendedAction: 'Increase coaching cadence this week and focus practice blocks on the target metric.',
        supportingMetrics: {
          metric,
          targetValue: round(target),
          currentValue: round(currentValue),
          gap: round(gap),
          daysToDeadline: remainingDays,
          requiredDailyLift: round(requiredDailyLift),
        },
        environment: input.environment,
      }));
    }
  }

  return risks;
}

async function persistRisks(input: {
  db: Firestore;
  generated: FreshUpRiskRecord[];
  existingById: Map<string, FreshUpRiskRecord>;
}): Promise<{ created: number; suppressed: number; resolved: number }> {
  let created = 0;
  let suppressed = 0;
  let resolved = 0;
  const batch = input.db.batch();
  const nextIds = new Set(input.generated.map((risk) => risk.riskId));

  input.generated.forEach((risk) => {
    const existing = input.existingById.get(risk.riskId);
    if (shouldSuppress(existing, risk)) {
      suppressed += 1;
      return;
    }
    const ref = input.db.collection('freshUpRiskRadar').doc(risk.riskId);
    batch.set(ref, {
      riskId: risk.riskId,
      riskType: risk.riskType,
      entityType: risk.entityType,
      entityId: risk.entityId,
      entityName: risk.entityName,
      riskLevel: risk.riskLevel,
      confidenceLevel: risk.confidenceLevel,
      timeRange: risk.timeRange,
      message: risk.message,
      recommendedAction: risk.recommendedAction,
      supportingMetrics: risk.supportingMetrics,
      createdAt: FieldValue.serverTimestamp(),
      resolvedAt: null,
      isActive: true,
      environment: risk.environment,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    created += 1;
  });

  input.existingById.forEach((existing, id) => {
    if (!existing.isActive) return;
    if (nextIds.has(id)) return;
    if (Date.now() - existing.createdAt.getTime() > (14 * 24 * 60 * 60 * 1000)) {
      const ref = input.db.collection('freshUpRiskRadar').doc(id);
      batch.set(ref, {
        isActive: false,
        resolvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      resolved += 1;
    }
  });

  if (created > 0 || resolved > 0) {
    await batch.commit();
  }
  return { created, suppressed, resolved };
}

async function createReinforcementAlerts(input: {
  db: Firestore;
  risks: FreshUpRiskRecord[];
  environment: 'sandbox' | 'production';
}): Promise<number> {
  const highRisks = input.risks.filter((risk) => risk.riskLevel === 'high' || risk.riskLevel === 'critical');
  if (!highRisks.length) return 0;
  const batch = input.db.batch();
  let count = 0;
  for (const risk of highRisks.slice(0, 25)) {
    const alertId = `risk-${risk.riskId}`;
    const ref = input.db.collection('freshUpAlerts').doc(alertId);
    batch.set(ref, {
      alertId,
      alertType: 'concern_based_friction',
      entityType: risk.entityType === 'dealer' ? 'dealer' : 'platform',
      entityId: risk.entityId || 'platform',
      entityName: risk.entityName || 'Platform',
      timeRange: risk.timeRange,
      metricName: risk.riskType,
      currentValue: Number(risk.supportingMetrics.currentValue || 0),
      comparisonValue: Number(risk.supportingMetrics.previousValue || 0),
      difference: Number(risk.supportingMetrics.delta || 0),
      differencePercent: Number(risk.supportingMetrics.deltaPercent || 0),
      severity: risk.riskLevel === 'critical' ? 'critical' : 'high',
      message: `CX Risk Radar: ${risk.message}`,
      recommendedAction: risk.recommendedAction,
      relatedSkill: typeof risk.supportingMetrics.skill === 'string' ? String(risk.supportingMetrics.skill) : undefined,
      createdAt: FieldValue.serverTimestamp(),
      isRead: false,
      resolved: false,
      environment: input.environment,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    count += 1;
  }
  if (count > 0) await batch.commit();
  return count;
}

export async function generateFreshUpRiskRadar(input: {
  db: Firestore;
  options: FreshUpRiskRadarGenerationInput;
}): Promise<{ created: number; suppressed: number; resolved: number; scannedSessions: number; reinforcedAlerts: number }> {
  const environment = input.options.environment || 'production';
  const sessions = await loadFreshUpSessionsForExport({
    adminDb: input.db,
    filters: {
      includeSandboxData: input.options.includeSandboxData === true,
    },
  });
  const scoped = sessions.filter((row) => row.environment === environment);
  const { dealerNameById, userNameById } = await loadNamesById({
    adminDb: input.db,
    sessions: scoped,
  });
  const platformRows = splitWindows(scoped).current;

  const byDealer = new Map<string, FreshUpNormalizedSession[]>();
  scoped.forEach((row) => {
    if (!row.dealerId) return;
    if (!byDealer.has(row.dealerId)) byDealer.set(row.dealerId, []);
    byDealer.get(row.dealerId)?.push(row);
  });

  const generated: FreshUpRiskRecord[] = [];
  byDealer.forEach((rows, dealerId) => {
    generated.push(...riskRowsForDealer({
      dealerId,
      dealerName: dealerNameById.get(dealerId) || dealerId,
      rows,
      platformRows,
      environment,
    }));
  });
  generated.push(...riskRowsForConsultant({
    rows: scoped,
    userNameById,
    environment,
  }));
  generated.push(...await riskRowsForGoals({
    db: input.db,
    environment,
    currentRows: platformRows,
  }));

  const dedupedByKey = new Map<string, FreshUpRiskRecord>();
  generated.forEach((risk) => {
    const key = dedupeKey(risk);
    const prev = dedupedByKey.get(key);
    if (!prev || LEVEL_RANK[risk.riskLevel] > LEVEL_RANK[prev.riskLevel]) {
      dedupedByKey.set(key, risk);
    }
  });
  const deduped = Array.from(dedupedByKey.values());

  const existing = await loadExistingRisks(input.db, environment);
  const persisted = await persistRisks({
    db: input.db,
    generated: deduped,
    existingById: existing,
  });
  const reinforcedAlerts = await createReinforcementAlerts({
    db: input.db,
    risks: deduped,
    environment,
  });
  return {
    ...persisted,
    scannedSessions: scoped.length,
    reinforcedAlerts,
  };
}

export async function loadActiveRiskHighlights(input: {
  db: Firestore;
  environment: 'sandbox' | 'production';
  entityType?: FreshUpRiskEntityType;
  entityId?: string;
  limit?: number;
}): Promise<string[]> {
  let query = input.db.collection('freshUpRiskRadar')
    .where('environment', '==', input.environment)
    .where('isActive', '==', true);
  if (input.entityType) query = query.where('entityType', '==', input.entityType);
  if (input.entityId) query = query.where('entityId', '==', input.entityId);
  query = query.orderBy('createdAt', 'desc').limit(input.limit ?? 3);
  const snap = await query.get();
  return snap.docs.map((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    return String(data.message || '').trim();
  }).filter(Boolean);
}

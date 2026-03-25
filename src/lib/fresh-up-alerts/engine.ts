import type { Firestore } from 'firebase-admin/firestore';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { loadFreshUpSessionsForExport, loadNamesById } from '@/lib/fresh-up-export/query';
import type { FreshUpNormalizedSession } from '@/lib/fresh-up-export/types';
import type { FreshUpAlertGenerationInput, FreshUpAlertRecord, FreshUpAlertSeverity } from '@/lib/fresh-up-alerts/types';

const SKILLS = [
  { key: 'empathy', label: 'Empathy' },
  { key: 'listening', label: 'Listening' },
  { key: 'trust', label: 'Trust' },
  { key: 'followUp', label: 'Follow Up' },
  { key: 'closing', label: 'Closing' },
  { key: 'relationship', label: 'Relationship' },
] as const;

const SEVERITY_RANK: Record<FreshUpAlertSeverity, number> = {
  positive: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const AUTOFORGE_MAP: Record<string, string> = {
  Trust: 'Trust Through Discovery',
  Listening: 'Active Listening Workshop',
  Closing: 'Guiding the Customer to the Next Step',
  Relationship: 'Personal Connection Builder',
  'Follow Up': 'Follow Up Momentum Builder',
  Empathy: 'Understanding Customer Emotions',
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

function skillValue(row: FreshUpNormalizedSession, skillKey: (typeof SKILLS)[number]['key']): number {
  if (skillKey === 'empathy') return row.scores.empathy;
  if (skillKey === 'listening') return row.scores.listening;
  if (skillKey === 'trust') return row.scores.trust;
  if (skillKey === 'followUp') return row.scores.followUp;
  if (skillKey === 'closing') return row.scores.closing;
  return row.scores.relationship;
}

function severityForDelta(delta: number, positive = false): FreshUpAlertSeverity {
  const abs = Math.abs(delta);
  if (positive) return 'positive';
  if (abs >= 15) return 'critical';
  if (abs >= 12) return 'high';
  if (abs >= 8) return 'medium';
  return 'low';
}

function makeAlertId(input: {
  alertType: string;
  entityType: string;
  entityId: string;
  metricName: string;
  relatedArchetype?: string;
  relatedConcern?: string;
  relatedVersion?: string;
}): string {
  const raw = [
    input.alertType,
    input.entityType,
    input.entityId,
    input.metricName,
    input.relatedArchetype || '',
    input.relatedConcern || '',
    input.relatedVersion || '',
  ].join('|');
  const hash = [...raw].reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0);
  return `fua-${Math.abs(hash).toString(36)}`;
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

function negativeOutcomeRate(rows: FreshUpNormalizedSession[]): number {
  const negative = rows.filter((row) => (
    row.outcomeTag === 'Lost Momentum'
    || row.outcomeTag === 'Conversation Breakdown'
    || row.endingType === 'stalled_conversation'
    || row.endingType === 'trust_break'
  )).length;
  return pct(negative, rows.length);
}

function dedupeKey(alert: FreshUpAlertRecord): string {
  return [
    alert.alertType,
    alert.entityType,
    alert.entityId,
    alert.metricName,
    alert.relatedArchetype || '',
    alert.relatedConcern || '',
    alert.relatedVersion || '',
    alert.environment,
  ].join('|');
}

function shouldSuppress(existing: FreshUpAlertRecord | null, next: FreshUpAlertRecord): boolean {
  if (!existing) return false;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const withinWindow = (Date.now() - existing.createdAt.getTime()) < sevenDays;
  if (!withinWindow) return false;
  if (existing.resolved) return false;
  return SEVERITY_RANK[next.severity] <= SEVERITY_RANK[existing.severity];
}

function compareRows(subject: number, comparison: number): { difference: number; differencePercent: number } {
  const difference = subject - comparison;
  const differencePercent = comparison === 0 ? 0 : (difference / comparison) * 100;
  return { difference: round(difference), differencePercent: round(differencePercent) };
}

function buildAlertsForDealer(input: {
  dealerId: string;
  dealerName: string;
  rows: FreshUpNormalizedSession[];
  platformRows: FreshUpNormalizedSession[];
  environment: 'sandbox' | 'production';
}): FreshUpAlertRecord[] {
  const alerts: FreshUpAlertRecord[] = [];
  const windows = splitWindows(input.rows);
  const current = windows.current;
  const previous = windows.previous;
  const baseCommon = {
    entityType: 'dealer' as const,
    entityId: input.dealerId,
    entityName: input.dealerName,
    timeRange: 'current_30_vs_previous_30',
    isRead: false,
    resolved: false,
    createdAt: new Date(),
    environment: input.environment,
  };

  for (const skill of SKILLS) {
    const currentAvg = avg(current.map((row) => skillValue(row, skill.key)));
    const previousAvg = avg(previous.map((row) => skillValue(row, skill.key)));
    const comparison = compareRows(currentAvg, previousAvg);
    if (comparison.difference <= -8) {
      alerts.push({
        alertId: makeAlertId({
          alertType: 'dealer_skill_drop',
          entityType: 'dealer',
          entityId: input.dealerId,
          metricName: skill.label,
        }),
        alertType: 'dealer_skill_drop',
        metricName: skill.label,
        currentValue: round(currentAvg),
        comparisonValue: round(previousAvg),
        difference: comparison.difference,
        differencePercent: comparison.differencePercent,
        severity: severityForDelta(comparison.difference),
        message: `${skill.label} has dropped by ${Math.abs(comparison.difference)} points over the last 30 days for this dealer.`,
        recommendedAction: `Review ${skill.label} trends and consider launching AutoForge: ${AUTOFORGE_MAP[skill.label] || 'Targeted coaching module'}.`,
        relatedSkill: skill.label,
        ...baseCommon,
      });
    }
    if (comparison.difference >= 8) {
      alerts.push({
        alertId: makeAlertId({
          alertType: 'dealer_skill_improvement',
          entityType: 'dealer',
          entityId: input.dealerId,
          metricName: skill.label,
        }),
        alertType: 'dealer_skill_improvement',
        metricName: skill.label,
        currentValue: round(currentAvg),
        comparisonValue: round(previousAvg),
        difference: comparison.difference,
        differencePercent: comparison.differencePercent,
        severity: 'positive',
        message: `${skill.label} improved by ${comparison.difference} points over the last 30 days for this dealer.`,
        recommendedAction: `Capture and reinforce coaching behaviors that drove ${skill.label} improvement.`,
        relatedSkill: skill.label,
        ...baseCommon,
      });
    }
  }

  const upCurrent = avg(current.map((row) => row.upMeterPeak));
  const upPrev = avg(previous.map((row) => row.upMeterPeak));
  const upCompare = compareRows(upCurrent, upPrev);
  if (upCompare.difference <= -10) {
    alerts.push({
      alertId: makeAlertId({
        alertType: 'engagement_drop',
        entityType: 'dealer',
        entityId: input.dealerId,
        metricName: 'Average Up Meter Peak',
      }),
      alertType: 'engagement_drop',
      metricName: 'Average Up Meter Peak',
      currentValue: round(upCurrent),
      comparisonValue: round(upPrev),
      difference: upCompare.difference,
      differencePercent: upCompare.differencePercent,
      severity: severityForDelta(upCompare.difference),
      message: `Average Up Meter Peak has fallen from ${round(upPrev)} to ${round(upCurrent)} over the last 30 days.`,
      recommendedAction: 'Review opening quality and trust-building moments to recover engagement momentum.',
      ...baseCommon,
    });
  }

  const usageCurrent = current.length;
  const usagePrevious = previous.length;
  const usageCompare = compareRows(usageCurrent, usagePrevious);
  if (usageCompare.differencePercent <= -30) {
    alerts.push({
      alertId: makeAlertId({
        alertType: 'usage_drop',
        entityType: 'dealer',
        entityId: input.dealerId,
        metricName: 'Total Sessions',
      }),
      alertType: 'usage_drop',
      metricName: 'Total Sessions',
      currentValue: usageCurrent,
      comparisonValue: usagePrevious,
      difference: usageCompare.difference,
      differencePercent: usageCompare.differencePercent,
      severity: 'medium',
      message: `Fresh Up usage has dropped ${Math.abs(usageCompare.differencePercent)}% over the last 30 days for this dealer.`,
      recommendedAction: 'Review dealer adoption cadence and consultant participation habits.',
      ...baseCommon,
    });
  }

  const negCurrent = negativeOutcomeRate(current);
  const negPrevious = negativeOutcomeRate(previous);
  const negCompare = compareRows(negCurrent, negPrevious);
  if (negCompare.difference >= 10) {
    alerts.push({
      alertId: makeAlertId({
        alertType: 'outcome_breakdown_increase',
        entityType: 'dealer',
        entityId: input.dealerId,
        metricName: 'Negative Outcome Rate',
      }),
      alertType: 'outcome_breakdown_increase',
      metricName: 'Negative Outcome Rate',
      currentValue: round(negCurrent),
      comparisonValue: round(negPrevious),
      difference: negCompare.difference,
      differencePercent: negCompare.differencePercent,
      severity: severityForDelta(negCompare.difference),
      message: `Conversation Breakdown and Lost Momentum outcomes increased by ${negCompare.difference}% over the last 30 days.`,
      recommendedAction: 'Review friction tags and run focused trust + follow-up coaching this week.',
      ...baseCommon,
    });
  }

  for (const skill of SKILLS) {
    const currentAvg = avg(current.map((row) => skillValue(row, skill.key)));
    if (currentAvg < 55) {
      alerts.push({
        alertId: makeAlertId({
          alertType: 'autoforge_recommendation',
          entityType: 'dealer',
          entityId: input.dealerId,
          metricName: skill.label,
        }),
        alertType: 'autoforge_recommendation',
        metricName: skill.label,
        currentValue: round(currentAvg),
        comparisonValue: 55,
        difference: round(currentAvg - 55),
        differencePercent: round(((currentAvg - 55) / 55) * 100),
        severity: 'medium',
        message: `Dealer performance indicates a strong need for ${AUTOFORGE_MAP[skill.label] || `${skill.label} coaching`}.`,
        recommendedAction: `Launch AutoForge module: ${AUTOFORGE_MAP[skill.label] || 'Targeted skill workshop'}.`,
        relatedSkill: skill.label,
        ...baseCommon,
      });
    }
  }

  const overallTrust = avg(current.map((row) => row.scores.trust));
  const overallClosing = avg(current.map((row) => row.scores.closing));
  const overallUp = avg(current.map((row) => row.upMeterPeak));
  const byArchetype = new Map<string, FreshUpNormalizedSession[]>();
  current.forEach((row) => {
    const key = row.archetypeCategory || row.archetypeName || 'unknown';
    if (!byArchetype.has(key)) byArchetype.set(key, []);
    byArchetype.get(key)?.push(row);
  });
  byArchetype.forEach((rows, archetype) => {
    const trustGap = avg(rows.map((row) => row.scores.trust)) - overallTrust;
    const closeGap = avg(rows.map((row) => row.scores.closing)) - overallClosing;
    const upGap = avg(rows.map((row) => row.upMeterPeak)) - overallUp;
    const worst = Math.min(trustGap, closeGap, upGap);
    if (worst <= -10) {
      alerts.push({
        alertId: makeAlertId({
          alertType: 'archetype_friction',
          entityType: 'dealer',
          entityId: input.dealerId,
          metricName: 'Archetype Performance Gap',
          relatedArchetype: archetype,
        }),
        alertType: 'archetype_friction',
        metricName: 'Archetype Performance Gap',
        currentValue: round(worst),
        comparisonValue: 0,
        difference: round(worst),
        differencePercent: 0,
        severity: severityForDelta(worst),
        message: `${archetype} customer archetypes are producing performance scores ${Math.abs(round(worst))} points below this dealer’s overall average.`,
        recommendedAction: `Review ${archetype} handling patterns in the next manager coaching session.`,
        relatedArchetype: archetype,
        ...baseCommon,
      });
    }
  });

  const overallBreakdown = negativeOutcomeRate(current);
  const byConcern = new Map<string, FreshUpNormalizedSession[]>();
  current.forEach((row) => {
    const key = row.primaryConcern || 'unknown';
    if (!byConcern.has(key)) byConcern.set(key, []);
    byConcern.get(key)?.push(row);
  });
  byConcern.forEach((rows, concern) => {
    const concernBreakdown = negativeOutcomeRate(rows);
    const concernTrust = avg(rows.map((row) => row.scores.trust));
    if (concernBreakdown - overallBreakdown >= 10 || concernTrust <= (overallTrust - 8)) {
      alerts.push({
        alertId: makeAlertId({
          alertType: 'concern_based_friction',
          entityType: 'dealer',
          entityId: input.dealerId,
          metricName: 'Concern Friction',
          relatedConcern: concern,
        }),
        alertType: 'concern_based_friction',
        metricName: 'Concern Friction',
        currentValue: round(concernBreakdown),
        comparisonValue: round(overallBreakdown),
        difference: round(concernBreakdown - overallBreakdown),
        differencePercent: round(((concernBreakdown - overallBreakdown) / (overallBreakdown || 1)) * 100),
        severity: 'medium',
        message: `${concern} conversations are creating breakdown rates ${round(concernBreakdown - overallBreakdown)}% above this dealer’s average.`,
        recommendedAction: `Coach consultants on handling ${concern} conversations with stronger discovery and trust pacing.`,
        relatedConcern: concern,
        ...baseCommon,
      });
    }
  });

  const dealerVsPlatformTrust = avg(current.map((row) => row.scores.trust)) - avg(input.platformRows.map((row) => row.scores.trust));
  if (dealerVsPlatformTrust <= -10) {
    alerts.push({
      alertId: makeAlertId({
        alertType: 'dealer_skill_drop',
        entityType: 'dealer',
        entityId: input.dealerId,
        metricName: 'Trust vs Platform',
      }),
      alertType: 'dealer_skill_drop',
      metricName: 'Trust vs Platform',
      currentValue: round(avg(current.map((row) => row.scores.trust))),
      comparisonValue: round(avg(input.platformRows.map((row) => row.scores.trust))),
      difference: round(dealerVsPlatformTrust),
      differencePercent: round((dealerVsPlatformTrust / (avg(input.platformRows.map((row) => row.scores.trust)) || 1)) * 100),
      severity: 'high',
      message: `Dealer trust performance is ${Math.abs(round(dealerVsPlatformTrust))} points below platform average.`,
      recommendedAction: 'Escalate trust coaching plan and monitor progress weekly.',
      relatedSkill: 'Trust',
      ...baseCommon,
    });
  }

  return alerts;
}

function buildConsultantAlerts(input: {
  rows: FreshUpNormalizedSession[];
  userNameById: Map<string, string>;
  environment: 'sandbox' | 'production';
}): FreshUpAlertRecord[] {
  const alerts: FreshUpAlertRecord[] = [];
  const byUser = new Map<string, FreshUpNormalizedSession[]>();
  input.rows.forEach((row) => {
    if (!byUser.has(row.userId)) byUser.set(row.userId, []);
    byUser.get(row.userId)?.push(row);
  });

  byUser.forEach((rows, userId) => {
    const recent = [...rows].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);
    const lowSkill = SKILLS.find((skill) => avg(recent.map((row) => skillValue(row, skill.key))) < 60);
    const tagCounts = new Map<string, number>();
    recent.forEach((row) => {
      const tag = row.coachingTag || row.summaryTag;
      if (!tag) return;
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    });
    const recurringTagEntry = Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (lowSkill || (recurringTagEntry && recurringTagEntry[1] >= 3)) {
      const recurringTag = recurringTagEntry?.[0] || '';
      const frictionArchetype = recent
        .filter((row) => row.outcomeTag === 'Conversation Breakdown' || row.outcomeTag === 'Lost Momentum')
        .map((row) => row.archetypeCategory)
        .filter(Boolean)[0] || '';
      alerts.push({
        alertId: makeAlertId({
          alertType: 'consultant_coaching_opportunity',
          entityType: 'consultant',
          entityId: userId,
          metricName: lowSkill?.label || 'Recurring Coaching Tag',
          relatedArchetype: frictionArchetype,
        }),
        alertType: 'consultant_coaching_opportunity',
        entityType: 'consultant',
        entityId: userId,
        entityName: input.userNameById.get(userId) || userId,
        timeRange: 'recent_5_sessions',
        metricName: lowSkill?.label || 'Recurring Coaching Tag',
        currentValue: lowSkill ? round(avg(recent.map((row) => skillValue(row, lowSkill.key)))) : (recurringTagEntry?.[1] || 0),
        comparisonValue: lowSkill ? 60 : 2,
        difference: lowSkill
          ? round(avg(recent.map((row) => skillValue(row, lowSkill.key))) - 60)
          : ((recurringTagEntry?.[1] || 0) - 2),
        differencePercent: 0,
        severity: 'medium',
        message: `This consultant is repeatedly struggling with ${lowSkill?.label.toLowerCase() || recurringTag} in recent Fresh Up sessions.`,
        recommendedAction: 'Assign targeted lesson on discovery before numbers and review next 3 Fresh Ups.',
        relatedSkill: lowSkill?.label,
        relatedArchetype: frictionArchetype || undefined,
        createdAt: new Date(),
        isRead: false,
        resolved: false,
        environment: input.environment,
      });
    }
  });

  return alerts;
}

function buildVersionAlerts(input: {
  rows: FreshUpNormalizedSession[];
  environment: 'sandbox' | 'production';
}): FreshUpAlertRecord[] {
  const alerts: FreshUpAlertRecord[] = [];
  const byVersion = new Map<string, FreshUpNormalizedSession[]>();
  input.rows.forEach((row) => {
    const key = row.freshUpVersionId;
    if (!key) return;
    if (!byVersion.has(key)) byVersion.set(key, []);
    byVersion.get(key)?.push(row);
  });
  const versions = Array.from(byVersion.keys());
  if (versions.length < 2) return alerts;
  const currentVersion = versions[0];
  const previousVersion = versions[1];
  const currentRows = byVersion.get(currentVersion) || [];
  const previousRows = byVersion.get(previousVersion) || [];
  const trustShiftDiff = avg(currentRows.map((row) => row.trustShift)) - avg(previousRows.map((row) => row.trustShift));
  const upPeakDiff = avg(currentRows.map((row) => row.upMeterPeak)) - avg(previousRows.map((row) => row.upMeterPeak));
  const breakdownDiff = negativeOutcomeRate(currentRows) - negativeOutcomeRate(previousRows);
  const skepticalCurrent = currentRows.filter((row) => row.personalityType.toLowerCase() === 'skeptical');
  const skepticalPrev = previousRows.filter((row) => row.personalityType.toLowerCase() === 'skeptical');
  const skepticalBreakDiff = negativeOutcomeRate(skepticalCurrent) - negativeOutcomeRate(skepticalPrev);

  if (trustShiftDiff <= -4 || upPeakDiff <= -6 || breakdownDiff >= 8 || skepticalBreakDiff >= 8) {
    alerts.push({
      alertId: makeAlertId({
        alertType: 'version_regression',
        entityType: 'version',
        entityId: currentVersion,
        metricName: 'Version Regression',
        relatedVersion: currentVersion,
      }),
      alertType: 'version_regression',
      entityType: 'version',
      entityId: currentVersion,
      entityName: currentRows[0]?.freshUpVersionName || currentVersion,
      timeRange: 'release_comparison',
      metricName: 'Version Regression',
      currentValue: round(breakdownDiff),
      comparisonValue: 0,
      difference: round(breakdownDiff),
      differencePercent: 0,
      severity: 'high',
      message: `${currentRows[0]?.freshUpVersionName || currentVersion} is producing weaker outcomes than ${previousRows[0]?.freshUpVersionName || previousVersion}, especially in skeptical profiles.`,
      recommendedAction: 'Pause rollout and compare with previous stable version before expanding.',
      relatedVersion: `${currentVersion} vs ${previousVersion}`,
      createdAt: new Date(),
      isRead: false,
      resolved: false,
      environment: input.environment,
    });
  }

  return alerts;
}

async function loadExistingAlerts(db: Firestore, environment: 'sandbox' | 'production'): Promise<Map<string, FreshUpAlertRecord>> {
  const snap = await db.collection('freshUpAlerts')
    .where('environment', '==', environment)
    .where('createdAt', '>=', Timestamp.fromDate(new Date(Date.now() - (90 * 24 * 60 * 60 * 1000))))
    .get();
  const map = new Map<string, FreshUpAlertRecord>();
  snap.docs.forEach((docSnap) => {
    const data = docSnap.data() as Record<string, unknown>;
    const record: FreshUpAlertRecord = {
      alertId: String(data.alertId || docSnap.id),
      alertType: String(data.alertType || '') as FreshUpAlertRecord['alertType'],
      entityType: String(data.entityType || '') as FreshUpAlertRecord['entityType'],
      entityId: String(data.entityId || ''),
      entityName: String(data.entityName || ''),
      timeRange: String(data.timeRange || ''),
      metricName: String(data.metricName || ''),
      currentValue: Number(data.currentValue || 0),
      comparisonValue: Number(data.comparisonValue || 0),
      difference: Number(data.difference || 0),
      differencePercent: Number(data.differencePercent || 0),
      severity: String(data.severity || 'low') as FreshUpAlertSeverity,
      message: String(data.message || ''),
      recommendedAction: String(data.recommendedAction || ''),
      relatedSkill: data.relatedSkill ? String(data.relatedSkill) : undefined,
      relatedArchetype: data.relatedArchetype ? String(data.relatedArchetype) : undefined,
      relatedConcern: data.relatedConcern ? String(data.relatedConcern) : undefined,
      relatedVersion: data.relatedVersion ? String(data.relatedVersion) : undefined,
      createdAt: (data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date()),
      isRead: data.isRead === true,
      resolved: data.resolved === true,
      resolvedAt: data.resolvedAt instanceof Timestamp ? data.resolvedAt.toDate() : undefined,
      environment,
    };
    map.set(dedupeKey(record), record);
  });
  return map;
}

async function persistAlerts(input: {
  db: Firestore;
  existingByKey: Map<string, FreshUpAlertRecord>;
  generated: FreshUpAlertRecord[];
}): Promise<{ created: number; suppressed: number; resolved: number }> {
  const batch = input.db.batch();
  let created = 0;
  let suppressed = 0;
  let resolved = 0;

  const activeKeys = new Set(input.generated.map((alert) => dedupeKey(alert)));

  input.generated.forEach((alert) => {
    const key = dedupeKey(alert);
    const existing = input.existingByKey.get(key) ?? null;
    if (shouldSuppress(existing, alert)) {
      suppressed += 1;
      return;
    }
    const ref = input.db.collection('freshUpAlerts').doc(alert.alertId);
    batch.set(ref, {
      ...alert,
      createdAt: Timestamp.fromDate(alert.createdAt),
      updatedAt: FieldValue.serverTimestamp(),
      resolvedAt: alert.resolvedAt ? Timestamp.fromDate(alert.resolvedAt) : null,
    }, { merge: true });
    created += 1;
  });

  input.existingByKey.forEach((existing, key) => {
    if (existing.resolved) return;
    if (activeKeys.has(key)) return;
    const ref = input.db.collection('freshUpAlerts').doc(existing.alertId);
    batch.set(ref, {
      resolved: true,
      resolvedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    resolved += 1;
  });

  if (created > 0 || resolved > 0) {
    await batch.commit();
  }
  return { created, suppressed, resolved };
}

export async function generateFreshUpAlerts(input: {
  db: Firestore;
  options: FreshUpAlertGenerationInput;
}): Promise<{ created: number; suppressed: number; resolved: number; scannedSessions: number }> {
  const environment = input.options.environment || 'production';
  const sessions = await loadFreshUpSessionsForExport({
    adminDb: input.db,
    filters: {
      includeSandboxData: input.options.includeSandboxData === true,
    },
  });
  const { dealerNameById, userNameById } = await loadNamesById({
    adminDb: input.db,
    sessions,
  });
  const scopedSessions = sessions.filter((row) => row.environment === environment);
  const platformRows = splitWindows(scopedSessions).current;

  const byDealer = new Map<string, FreshUpNormalizedSession[]>();
  scopedSessions.forEach((row) => {
    if (!row.dealerId) return;
    if (!byDealer.has(row.dealerId)) byDealer.set(row.dealerId, []);
    byDealer.get(row.dealerId)?.push(row);
  });

  const generated: FreshUpAlertRecord[] = [];
  byDealer.forEach((rows, dealerId) => {
    generated.push(...buildAlertsForDealer({
      dealerId,
      dealerName: dealerNameById.get(dealerId) || dealerId,
      rows,
      platformRows,
      environment,
    }));
  });
  generated.push(...buildConsultantAlerts({
    rows: scopedSessions,
    userNameById,
    environment,
  }));
  generated.push(...buildVersionAlerts({
    rows: scopedSessions,
    environment,
  }));

  const existingByKey = await loadExistingAlerts(input.db, environment);
  const persisted = await persistAlerts({
    db: input.db,
    existingByKey,
    generated,
  });
  return {
    ...persisted,
    scannedSessions: scopedSessions.length,
  };
}


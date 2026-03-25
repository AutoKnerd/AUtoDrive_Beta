import type { FreshUpBenchmarkContext, FreshUpBenchmarkMetric, FreshUpBenchmarkRequest, FreshUpBenchmarkResult, FreshUpBenchmarkRow } from '@/lib/fresh-up-benchmark/types';
import type { FreshUpNormalizedSession } from '@/lib/fresh-up-export/types';

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pct(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function directionFor(diff: number): 'above' | 'below' | 'equal' {
  if (Math.abs(diff) < 0.05) return 'equal';
  return diff > 0 ? 'above' : 'below';
}

const METRIC_ORDER: FreshUpBenchmarkMetric[] = [
  'totalFreshUpSessions',
  'averageEmpathy',
  'averageListening',
  'averageTrust',
  'averageFollowUp',
  'averageClosing',
  'averageRelationship',
  'averageUpMeterPeak',
  'averageTrustShift',
  'averageConversationLength',
  'appointmentSetRate',
  'conversationBreakdownRate',
  'guardrailFlagRate',
];

function aggregateMetrics(rows: FreshUpNormalizedSession[]): Record<FreshUpBenchmarkMetric, number> {
  return {
    totalFreshUpSessions: rows.length,
    averageEmpathy: avg(rows.map((row) => row.scores.empathy)),
    averageListening: avg(rows.map((row) => row.scores.listening)),
    averageTrust: avg(rows.map((row) => row.scores.trust)),
    averageFollowUp: avg(rows.map((row) => row.scores.followUp)),
    averageClosing: avg(rows.map((row) => row.scores.closing)),
    averageRelationship: avg(rows.map((row) => row.scores.relationship)),
    averageUpMeterPeak: avg(rows.map((row) => row.upMeterPeak)),
    averageTrustShift: avg(rows.map((row) => row.trustShift)),
    averageConversationLength: avg(rows.map((row) => row.conversationLength)),
    appointmentSetRate: pct(rows.filter((row) => row.outcomeTag === 'Appointment Set').length, rows.length),
    conversationBreakdownRate: pct(rows.filter((row) => row.outcomeTag === 'Conversation Breakdown').length, rows.length),
    guardrailFlagRate: pct(rows.filter((row) => row.guardrailFlags.length > 0 || row.contentValidationPassed === false).length, rows.length),
  };
}

function compareMetrics(input: {
  benchmarkType: FreshUpBenchmarkRequest['benchmarkType'];
  subjectRows: FreshUpNormalizedSession[];
  comparisonRows: FreshUpNormalizedSession[];
  metricName?: FreshUpBenchmarkRequest['metricName'];
  interpretationPrefix: string;
}): FreshUpBenchmarkRow[] {
  const subject = aggregateMetrics(input.subjectRows);
  const comparison = aggregateMetrics(input.comparisonRows);
  const selected = input.metricName && input.metricName !== 'all' ? [input.metricName] : METRIC_ORDER;
  return selected.map((metricName) => {
    const subjectValue = subject[metricName];
    const comparisonValue = comparison[metricName];
    const difference = subjectValue - comparisonValue;
    const differencePercent = comparisonValue === 0 ? 0 : (difference / comparisonValue) * 100;
    const direction = directionFor(difference);
    const directionLabel = direction === 'equal' ? 'at parity with' : (direction === 'above' ? 'above' : 'below');
    return {
      benchmarkType: input.benchmarkType,
      metricName,
      subjectValue: round(subjectValue),
      comparisonValue: round(comparisonValue),
      difference: round(difference),
      differencePercent: round(differencePercent),
      direction,
      interpretationLabel: `${input.interpretationPrefix} ${directionLabel} benchmark`,
    };
  });
}

function labelFromId(map: Map<string, string> | undefined, id: string, fallback: string): string {
  if (!id) return fallback;
  return map?.get(id) || id;
}

function byWindow30(rows: FreshUpNormalizedSession[]): { current: FreshUpNormalizedSession[]; previous: FreshUpNormalizedSession[] } {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const currentStart = now - (30 * dayMs);
  const previousStart = now - (60 * dayMs);
  return {
    current: rows.filter((row) => row.timestamp.getTime() >= currentStart),
    previous: rows.filter((row) => row.timestamp.getTime() >= previousStart && row.timestamp.getTime() < currentStart),
  };
}

function selectSegmentValue(input: {
  session: FreshUpNormalizedSession;
  segmentKey?: string;
  userMetadataById?: Map<string, Record<string, unknown>>;
  dealerMetadataById?: Map<string, Record<string, unknown>>;
}): string {
  const userMeta = input.userMetadataById?.get(input.session.userId) ?? {};
  const dealerMeta = input.dealerMetadataById?.get(input.session.dealerId) ?? {};
  const key = (input.segmentKey || '').trim();
  if (key.startsWith('user.')) {
    return String(userMeta[key.slice(5)] ?? '');
  }
  if (key.startsWith('dealer.')) {
    return String(dealerMeta[key.slice(7)] ?? '');
  }
  if (key.length > 0) {
    return String(userMeta[key] ?? dealerMeta[key] ?? '');
  }
  // Default segmentation assumption: XP-based consultant experience tier.
  const xp = Number(userMeta.xp ?? 0);
  return xp >= 3000 ? 'experienced' : 'new';
}

function topOutliers(rows: FreshUpBenchmarkRow[]): FreshUpBenchmarkRow[] {
  return [...rows]
    .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))
    .slice(0, 5);
}

function findPreviousVersion(input: { sessions: FreshUpNormalizedSession[]; versionId: string }): string | null {
  const versions = Array.from(new Set(input.sessions.map((row) => row.freshUpVersionId).filter(Boolean)));
  const idx = versions.indexOf(input.versionId);
  if (idx <= 0) return versions.length > 1 ? versions[1] : null;
  return versions[idx - 1] || null;
}

export function runFreshUpBenchmark(input: {
  request: FreshUpBenchmarkRequest;
  context: FreshUpBenchmarkContext;
}): FreshUpBenchmarkResult {
  const sessions = input.context.sessions;
  const request = input.request;
  const assumptions: string[] = [];
  let subjectRows: FreshUpNormalizedSession[] = [];
  let comparisonRows: FreshUpNormalizedSession[] = [];
  let subjectLabel = 'Subject';
  let comparisonLabel = 'Benchmark';
  let interpretationPrefix = 'Compared result is';

  if (request.benchmarkType === 'consultant_vs_dealer') {
    subjectRows = sessions.filter((row) => row.userId === (request.entityId || ''));
    const dealerId = request.comparisonEntityId || subjectRows[0]?.dealerId || '';
    comparisonRows = sessions.filter((row) => row.dealerId === dealerId);
    subjectLabel = labelFromId(input.context.userNameById, request.entityId || '', 'Consultant');
    comparisonLabel = labelFromId(input.context.dealerNameById, dealerId, 'Dealer Average');
    interpretationPrefix = 'Compared to dealer average';
  } else if (request.benchmarkType === 'dealer_vs_platform') {
    subjectRows = sessions.filter((row) => row.dealerId === (request.entityId || ''));
    comparisonRows = sessions;
    subjectLabel = labelFromId(input.context.dealerNameById, request.entityId || '', 'Dealer');
    comparisonLabel = 'Platform Average';
    interpretationPrefix = 'Compared to platform average';
  } else if (request.benchmarkType === 'current_vs_previous_30') {
    const filtered = request.entityId
      ? sessions.filter((row) => row.dealerId === request.entityId || row.userId === request.entityId)
      : sessions;
    const windows = byWindow30(filtered);
    subjectRows = windows.current;
    comparisonRows = windows.previous;
    subjectLabel = 'Current 30 Days';
    comparisonLabel = 'Previous 30 Days';
    interpretationPrefix = 'Compared to prior period';
  } else if (request.benchmarkType === 'archetype_vs_overall') {
    subjectRows = sessions.filter((row) => (
      row.archetypeId === (request.entityId || '')
      || row.archetypeName.toLowerCase() === String(request.entityId || '').toLowerCase()
      || row.archetypeCategory.toLowerCase() === String(request.entityId || '').toLowerCase()
    ));
    comparisonRows = sessions;
    subjectLabel = request.entityId || 'Selected Archetype';
    comparisonLabel = 'Overall Performance';
    interpretationPrefix = 'Archetype performance is';
  } else if (request.benchmarkType === 'concern_vs_overall') {
    subjectRows = sessions.filter((row) => row.primaryConcern.toLowerCase() === String(request.entityId || '').toLowerCase());
    comparisonRows = sessions;
    subjectLabel = request.entityId || 'Selected Concern';
    comparisonLabel = 'Overall Performance';
    interpretationPrefix = 'Concern performance is';
  } else if (request.benchmarkType === 'version_vs_previous_version') {
    const versionA = request.entityId || '';
    const versionB = request.comparisonEntityId || findPreviousVersion({ sessions, versionId: versionA }) || '';
    subjectRows = sessions.filter((row) => row.freshUpVersionId === versionA);
    comparisonRows = sessions.filter((row) => row.freshUpVersionId === versionB);
    subjectLabel = subjectRows[0]?.freshUpVersionName || versionA || 'Version A';
    comparisonLabel = comparisonRows[0]?.freshUpVersionName || versionB || 'Previous Version';
    interpretationPrefix = 'Version comparison shows';
  } else {
    const segmentKey = request.segmentKey;
    const segmentValue = request.segmentValue || '';
    if (!segmentKey) {
      assumptions.push('No segment key provided. Defaulted to XP-based consultant experience tier (new vs experienced).');
    }
    subjectRows = sessions.filter((row) => selectSegmentValue({
      session: row,
      segmentKey,
      userMetadataById: input.context.userMetadataById,
      dealerMetadataById: input.context.dealerMetadataById,
    }).toLowerCase() === segmentValue.toLowerCase());
    comparisonRows = sessions.filter((row) => selectSegmentValue({
      session: row,
      segmentKey,
      userMetadataById: input.context.userMetadataById,
      dealerMetadataById: input.context.dealerMetadataById,
    }).toLowerCase() !== segmentValue.toLowerCase());
    subjectLabel = segmentValue || 'Selected Segment';
    comparisonLabel = 'Other Segments';
    interpretationPrefix = 'Segment comparison is';
  }

  const rows = compareMetrics({
    benchmarkType: request.benchmarkType,
    subjectRows,
    comparisonRows,
    metricName: request.metricName,
    interpretationPrefix,
  });

  return {
    benchmarkType: request.benchmarkType,
    generatedAt: new Date().toISOString(),
    subjectLabel,
    comparisonLabel,
    rows,
    outliers: topOutliers(rows),
    sampleSize: {
      subjectSessions: subjectRows.length,
      comparisonSessions: comparisonRows.length,
    },
    assumptions: assumptions.length > 0 ? assumptions : undefined,
  };
}

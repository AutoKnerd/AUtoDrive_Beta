import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { loadFreshUpSessionsForExport, loadNamesById } from '@/lib/fresh-up-export/query';
import { generateWeeklyDigest } from '@/lib/fresh-up-digest/engine';
import { loadActiveRiskHighlights } from '@/lib/fresh-up-risk-radar/engine';
import type {
  FreshUpWeeklyDigestEntityType,
  FreshUpWeeklyDigestRecord,
  FreshUpWeeklyDigestRequest,
  FreshUpWeeklyDigestResult,
} from '@/lib/fresh-up-digest/types';

type WeeklyDigestStorageInput = {
  db: Firestore;
  includeSandboxData?: boolean;
  environment?: 'sandbox' | 'production';
  now?: Date;
  force?: boolean;
};

type WeeklyDigestReadInput = {
  db: Firestore;
  entityType?: FreshUpWeeklyDigestEntityType;
  entityId?: string;
  dateFrom?: string;
  dateTo?: string;
  includeSandboxData?: boolean;
  environment?: 'sandbox' | 'production';
  limit?: number;
  latestOnly?: boolean;
};

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function weekWindow(now: Date): { weekStart: Date; weekEnd: Date; previousWeekStart: Date } {
  const dayMs = 24 * 60 * 60 * 1000;
  const weekEnd = new Date(now);
  const weekStart = new Date(now.getTime() - (7 * dayMs));
  const previousWeekStart = new Date(now.getTime() - (14 * dayMs));
  return { weekStart, weekEnd, previousWeekStart };
}

function toDigestType(entityType: FreshUpWeeklyDigestEntityType): FreshUpWeeklyDigestRequest['digestType'] {
  if (entityType === 'dealer') return 'dealer_weekly';
  if (entityType === 'consultant') return 'consultant_weekly';
  return 'platform_weekly';
}

function defaultLengthForEntity(entityType: FreshUpWeeklyDigestEntityType): FreshUpWeeklyDigestRequest['lengthMode'] {
  if (entityType === 'consultant') return 'short';
  return 'standard';
}

function buildDigestId(input: {
  entityType: FreshUpWeeklyDigestEntityType;
  entityId: string;
  weekEnd: Date;
  environment: 'sandbox' | 'production';
}): string {
  const normalizedEntityId = (input.entityId || 'platform').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${input.entityType}_${normalizedEntityId}_${toDateKey(input.weekEnd)}_${input.environment}`;
}

function toStoredRecord(input: {
  digestId: string;
  entityType: FreshUpWeeklyDigestEntityType;
  entityId: string;
  entityName: string;
  weekStart: Date;
  weekEnd: Date;
  digest: FreshUpWeeklyDigestResult;
  environment: 'sandbox' | 'production';
}): FreshUpWeeklyDigestRecord {
  return {
    digestId: input.digestId,
    entityType: input.entityType,
    entityId: input.entityId,
    entityName: input.entityName,
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    headline: input.digest.headlineSummary,
    keyInsights: input.digest.keyInsights,
    recommendedAction: input.digest.recommendedAction,
    narrativeSummary: input.digest.narrative,
    metricsSnapshot: {
      sampleSize: input.digest.sampleSize,
      topStrength: input.digest.aggregates.topStrength,
      topImprovementArea: input.digest.aggregates.topImprovementArea,
      totalSessions: input.digest.aggregates.totalSessions,
      activeConsultants: input.digest.aggregates.activeConsultants,
      activeDealers: input.digest.aggregates.activeDealers,
      averageConversationLength: input.digest.aggregates.averageConversationLength,
      averageUpMeterPeak: input.digest.aggregates.averageUpMeterPeak,
      averageTrustShift: input.digest.aggregates.averageTrustShift,
      averageEmpathy: input.digest.aggregates.averageEmpathy,
      averageListening: input.digest.aggregates.averageListening,
      averageTrust: input.digest.aggregates.averageTrust,
      averageFollowUp: input.digest.aggregates.averageFollowUp,
      averageClosing: input.digest.aggregates.averageClosing,
      averageRelationship: input.digest.aggregates.averageRelationship,
      mostCommonCustomerFriction: input.digest.aggregates.mostCommonCustomerFriction,
      mostCommonArchetypeFriction: input.digest.aggregates.mostCommonArchetypeFriction,
      mostCommonConcernFriction: input.digest.aggregates.mostCommonConcernFriction,
      outcomes: input.digest.aggregates.outcomes,
      progressVsPreviousWeek: input.digest.aggregates.progressVsPreviousWeek,
    },
    createdAt: new Date(),
    environment: input.environment,
  };
}

async function upsertDigestRecord(input: {
  db: Firestore;
  record: FreshUpWeeklyDigestRecord;
}): Promise<void> {
  const ref = input.db.collection('freshUpWeeklyDigests').doc(input.record.digestId);
  await ref.set({
    digestId: input.record.digestId,
    entityType: input.record.entityType,
    entityId: input.record.entityId,
    entityName: input.record.entityName,
    weekStart: Timestamp.fromDate(input.record.weekStart),
    weekEnd: Timestamp.fromDate(input.record.weekEnd),
    headline: input.record.headline,
    keyInsights: input.record.keyInsights,
    recommendedAction: input.record.recommendedAction,
    narrativeSummary: input.record.narrativeSummary || '',
    metricsSnapshot: input.record.metricsSnapshot,
    createdAt: FieldValue.serverTimestamp(),
    environment: input.record.environment,
  }, { merge: true });
}

async function digestExists(input: {
  db: Firestore;
  digestId: string;
}): Promise<boolean> {
  const snap = await input.db.collection('freshUpWeeklyDigests').doc(input.digestId).get();
  return snap.exists;
}

export async function generateWeeklyFreshUpDigest(input: WeeklyDigestStorageInput): Promise<{
  weekStart: string;
  weekEnd: string;
  generatedDealerDigests: number;
  generatedConsultantDigests: number;
  generatedPlatformDigests: number;
  skippedExisting: number;
  scannedSessions: number;
}> {
  const now = input.now ?? new Date();
  const environment = input.environment ?? 'production';
  const includeSandboxData = input.includeSandboxData === true;
  const window = weekWindow(now);

  const filters = {
    includeSandboxData,
    dateFrom: toDateKey(window.previousWeekStart),
    dateTo: toDateKey(window.weekEnd),
    environment: includeSandboxData ? undefined : environment,
  };

  const sessions = await loadFreshUpSessionsForExport({
    adminDb: input.db,
    filters,
  });
  const scopedSessions = sessions.filter((session) => includeSandboxData || session.environment === environment);
  const { dealerNameById, userNameById } = await loadNamesById({
    adminDb: input.db,
    sessions: scopedSessions,
  });

  const currentWeekSessions = scopedSessions.filter((row) => row.timestamp >= window.weekStart && row.timestamp <= window.weekEnd);
  const dealerIds = Array.from(new Set(currentWeekSessions.map((row) => row.dealerId).filter(Boolean)));
  const consultantIds = Array.from(new Set(currentWeekSessions.map((row) => row.userId).filter(Boolean)));

  let generatedDealerDigests = 0;
  let generatedConsultantDigests = 0;
  let generatedPlatformDigests = 0;
  let skippedExisting = 0;

  const generateForEntity = async (entityType: FreshUpWeeklyDigestEntityType, entityId: string, entityName: string) => {
    const digestId = buildDigestId({
      entityType,
      entityId,
      weekEnd: window.weekEnd,
      environment,
    });
    if (!input.force) {
      const exists = await digestExists({
        db: input.db,
        digestId,
      });
      if (exists) {
        skippedExisting += 1;
        return;
      }
    }

    const digest = generateWeeklyDigest({
      request: {
        digestType: toDigestType(entityType),
        lengthMode: defaultLengthForEntity(entityType),
        entityId: entityId || undefined,
        filters,
      },
      context: {
        sessions: scopedSessions,
        filters,
        entityId: entityId || undefined,
        dealerNameById,
        userNameById,
      },
    });
    const riskHighlights = await loadActiveRiskHighlights({
      db: input.db,
      environment,
      entityType: entityType === 'dealer'
        ? 'dealer'
        : (entityType === 'consultant' ? 'consultant' : 'platform'),
      entityId: entityType === 'platform' ? undefined : entityId,
      limit: 2,
    });
    if (riskHighlights.length > 0) {
      digest.keyInsights = [...digest.keyInsights, ...riskHighlights.map((line) => `Risk Radar: ${line}`)].slice(0, 8);
    }

    const stored = toStoredRecord({
      digestId,
      entityType,
      entityId,
      entityName,
      weekStart: window.weekStart,
      weekEnd: window.weekEnd,
      digest,
      environment,
    });
    await upsertDigestRecord({
      db: input.db,
      record: stored,
    });

    if (entityType === 'dealer') generatedDealerDigests += 1;
    else if (entityType === 'consultant') generatedConsultantDigests += 1;
    else generatedPlatformDigests += 1;
  };

  await generateForEntity('platform', 'platform', 'Platform');
  for (const dealerId of dealerIds) {
    await generateForEntity('dealer', dealerId, dealerNameById.get(dealerId) || dealerId);
  }
  for (const consultantId of consultantIds) {
    await generateForEntity('consultant', consultantId, userNameById.get(consultantId) || consultantId);
  }

  return {
    weekStart: window.weekStart.toISOString(),
    weekEnd: window.weekEnd.toISOString(),
    generatedDealerDigests,
    generatedConsultantDigests,
    generatedPlatformDigests,
    skippedExisting,
    scannedSessions: scopedSessions.length,
  };
}

function normalizeStoredDigest(raw: Record<string, unknown>, id: string): FreshUpWeeklyDigestRecord {
  const toDate = (value: unknown): Date => {
    if (value instanceof Date) return value;
    if (value instanceof Timestamp) return value.toDate();
    if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
      try {
        return (value as { toDate: () => Date }).toDate();
      } catch {
        return new Date(0);
      }
    }
    const parsed = new Date(String(value || ''));
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  };

  return {
    digestId: String(raw.digestId || id),
    entityType: (String(raw.entityType || 'platform') as FreshUpWeeklyDigestEntityType),
    entityId: String(raw.entityId || ''),
    entityName: String(raw.entityName || ''),
    weekStart: toDate(raw.weekStart),
    weekEnd: toDate(raw.weekEnd),
    headline: String(raw.headline || ''),
    keyInsights: Array.isArray(raw.keyInsights) ? raw.keyInsights.map((item) => String(item)) : [],
    recommendedAction: String(raw.recommendedAction || ''),
    narrativeSummary: String(raw.narrativeSummary || ''),
    metricsSnapshot: (raw.metricsSnapshot as Record<string, unknown> | undefined) || {},
    createdAt: toDate(raw.createdAt),
    environment: String(raw.environment || 'production') === 'sandbox' ? 'sandbox' : 'production',
  };
}

export async function loadWeeklyDigestRecords(input: WeeklyDigestReadInput): Promise<FreshUpWeeklyDigestRecord[]> {
  const environment = input.environment ?? 'production';
  const includeSandboxData = input.includeSandboxData === true;

  const fetchLimit = Math.max(input.limit ?? (input.latestOnly ? 1 : 50), 200);
  const snap = await input.db.collection('freshUpWeeklyDigests').orderBy('weekEnd', 'desc').limit(fetchLimit).get();
  const rows = snap.docs.map((docSnap) => normalizeStoredDigest(docSnap.data() as Record<string, unknown>, docSnap.id));

  const from = input.dateFrom ? new Date(`${input.dateFrom}T00:00:00`) : null;
  const to = input.dateTo ? new Date(`${input.dateTo}T23:59:59.999`) : null;
  const filtered = rows.filter((row) => {
    if (!includeSandboxData && row.environment !== environment) return false;
    if (input.entityType && row.entityType !== input.entityType) return false;
    if (input.entityId && row.entityId !== input.entityId) return false;
    if (from && row.weekEnd < from) return false;
    if (to && row.weekStart > to) return false;
    return true;
  });
  if (input.latestOnly) return filtered.slice(0, 1);
  return filtered.slice(0, input.limit ?? 50);
}

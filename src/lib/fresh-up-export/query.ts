import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { FreshUpExportFilters, FreshUpNormalizedSession } from '@/lib/fresh-up-export/types';

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function normalizeString(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeSession(raw: Record<string, unknown>, docId: string): FreshUpNormalizedSession | null {
  const timestamp = asDate(raw.timestamp);
  if (!timestamp) return null;
  const scoresRaw = (raw.scores as Record<string, unknown> | undefined) ?? {};
  const statBonuses = (raw.statBonuses as Record<string, unknown> | undefined) ?? {};
  const upMeter = (raw.upMeter as Record<string, unknown> | undefined) ?? {};
  const scenarioGenerationDetails = (raw.scenarioGenerationDetails as Record<string, unknown> | undefined) ?? {};
  const sourceType = normalizeString(raw.sourceType) as 'procedural' | 'signature' | '';
  const environmentRaw = normalizeString(raw.environment);
  const environment = environmentRaw === 'sandbox' ? 'sandbox' : 'production';
  const isSandbox = raw.isSandbox === true || environment === 'sandbox';
  const listening = clamp(asNumber(scoresRaw.listening, 0));
  const trust = clamp(asNumber(scoresRaw.trust, 0));

  return {
    sessionId: normalizeString(raw.sessionId) || docId,
    userId: normalizeString(raw.userId),
    dealerId: normalizeString(raw.dealerId),
    timestamp,
    freshUpVersionId: normalizeString(raw.freshUpVersionId),
    freshUpVersionName: normalizeString(raw.freshUpVersionName),
    environment,
    isSandbox,
    sourceType,
    customerName: normalizeString(raw.scenarioName) || normalizeString(raw.characterName),
    vehicleInterest: normalizeString(raw.vehicleInterest),
    buyingStage: normalizeString(raw.buyingStage),
    personalityType: normalizeString(raw.personalityType),
    communicationStyle: normalizeString(raw.communicationStyle),
    difficultyLevel: normalizeString(raw.difficultyLevel),
    primaryConcern: normalizeString(raw.primaryConcern),
    secondaryConcern: normalizeString(raw.secondaryConcern),
    startingMood: normalizeString(raw.startingEmotionalState),
    endingEmotionalState: normalizeString(raw.endingEmotionalState),
    archetypeId: normalizeString(raw.archetypeId),
    archetypeName: normalizeString(raw.archetypeName),
    archetypeCategory: normalizeString(raw.archetypeCategory),
    humorLevel: clamp(asNumber(raw.humorLevel, 0), 0, 3),
    openingMessage: normalizeString(raw.openingMessage) || normalizeString(scenarioGenerationDetails.openingMessage),
    finalCustomerResponse: normalizeString(raw.finalCustomerResponse),
    endingType: normalizeString(raw.endingType),
    outcomeTag: normalizeString(raw.outcomeTag),
    recommendedNextStep: normalizeString(raw.recommendedNextStep),
    upMeterStart: clamp(asNumber(upMeter.start, 35)),
    upMeterPeak: clamp(asNumber(upMeter.peak, 35)),
    upMeterEnd: clamp(asNumber(upMeter.end, 35)),
    trustShift: asNumber(raw.trustShift, 0),
    empathyDelta: asNumber(raw.empathyDelta, asNumber(statBonuses.empathyBonus, 0)),
    listeningDelta: asNumber(raw.listeningDelta, asNumber(statBonuses.listeningBonus, 0)),
    trustDelta: asNumber(raw.trustDelta, asNumber(statBonuses.trustBonus, 0)),
    followUpDelta: asNumber(raw.followUpDelta, 0),
    closingDelta: asNumber(raw.closingDelta, asNumber(statBonuses.closingBonus, 0)),
    relationshipDelta: asNumber(raw.relationshipDelta, asNumber(statBonuses.relationshipBonus, 0)),
    coachingTag: normalizeString(raw.coachingTag),
    summaryTag: normalizeString(raw.summaryTag),
    conversationLength: Math.max(0, Math.round(asNumber(raw.conversationLength, 0))),
    messagesSent: Math.max(0, Math.round(asNumber(raw.messagesSent, 0))),
    xpAwarded: Math.round(asNumber(raw.xpAwarded, 0)),
    guardrailFlags: Array.isArray(raw.guardrailFlags) ? raw.guardrailFlags.map((item) => String(item)) : [],
    contentValidationPassed: raw.contentValidationPassed !== false,
    validationFailureReasons: Array.isArray(raw.validationFailureReasons) ? raw.validationFailureReasons.map((item) => String(item)) : [],
    scores: {
      empathy: clamp(asNumber(scoresRaw.empathy, 0)),
      listening,
      trust,
      followUp: clamp(asNumber(scoresRaw.followUp, Math.round((listening + trust) / 2))),
      closing: clamp(asNumber(scoresRaw.closing, 0)),
      relationship: clamp(asNumber(scoresRaw.relationship, 0)),
    },
  };
}

function matchesFilter(value: string, expected?: string): boolean {
  if (!expected || expected.trim().length === 0) return true;
  return value.toLowerCase() === expected.trim().toLowerCase();
}

function matchesDate(session: FreshUpNormalizedSession, filters: FreshUpExportFilters): boolean {
  const ts = session.timestamp.getTime();
  if (filters.dateFrom) {
    const start = new Date(`${filters.dateFrom}T00:00:00`);
    if (!Number.isNaN(start.getTime()) && ts < start.getTime()) return false;
  }
  if (filters.dateTo) {
    const end = new Date(`${filters.dateTo}T23:59:59.999`);
    if (!Number.isNaN(end.getTime()) && ts > end.getTime()) return false;
  }
  return true;
}

export async function loadFreshUpSessionsForExport(input: {
  adminDb: Firestore;
  filters: FreshUpExportFilters;
}): Promise<FreshUpNormalizedSession[]> {
  const includeSandbox = input.filters.includeSandboxData === true;
  const dateFrom = input.filters.dateFrom ? new Date(`${input.filters.dateFrom}T00:00:00`) : null;

  const snapshot = dateFrom && !Number.isNaN(dateFrom.getTime())
    ? await input.adminDb.collection('freshUpSessions').where('timestamp', '>=', Timestamp.fromDate(dateFrom)).get()
    : await input.adminDb.collection('freshUpSessions').get();

  return snapshot.docs
    .map((docSnap) => normalizeSession(docSnap.data() as Record<string, unknown>, docSnap.id))
    .filter((row): row is FreshUpNormalizedSession => row !== null)
    .filter((session) => matchesDate(session, input.filters))
    .filter((session) => includeSandbox || !session.isSandbox)
    .filter((session) => input.filters.isSandbox === undefined ? true : session.isSandbox === input.filters.isSandbox)
    .filter((session) => matchesFilter(session.dealerId, input.filters.dealerId))
    .filter((session) => matchesFilter(session.userId, input.filters.userId))
    .filter((session) => matchesFilter(session.freshUpVersionId, input.filters.freshUpVersionId))
    .filter((session) => matchesFilter(session.environment, input.filters.environment))
    .filter((session) => matchesFilter(session.sourceType, input.filters.sourceType))
    .filter((session) => matchesFilter(session.difficultyLevel, input.filters.difficultyLevel))
    .filter((session) => matchesFilter(session.archetypeCategory, input.filters.archetypeCategory))
    .filter((session) => matchesFilter(session.primaryConcern, input.filters.primaryConcern))
    .filter((session) => matchesFilter(session.buyingStage, input.filters.buyingStage))
    .filter((session) => matchesFilter(session.personalityType, input.filters.personalityType))
    .filter((session) => matchesFilter(session.outcomeTag, input.filters.outcomeTag))
    .filter((session) => matchesFilter(session.coachingTag, input.filters.coachingTag))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export async function loadNamesById(input: {
  adminDb: Firestore;
  sessions: FreshUpNormalizedSession[];
}): Promise<{ dealerNameById: Map<string, string>; userNameById: Map<string, string> }> {
  const dealerIds = Array.from(new Set(input.sessions.map((row) => row.dealerId).filter(Boolean)));
  const userIds = Array.from(new Set(input.sessions.map((row) => row.userId).filter(Boolean)));
  const dealerNameById = new Map<string, string>();
  const userNameById = new Map<string, string>();

  await Promise.all(dealerIds.map(async (dealerId) => {
    const snap = await input.adminDb.collection('dealerships').doc(dealerId).get();
    if (!snap.exists) return;
    const data = snap.data() as Record<string, unknown>;
    dealerNameById.set(dealerId, normalizeString(data.name) || dealerId);
  }));

  await Promise.all(userIds.map(async (userId) => {
    const snap = await input.adminDb.collection('users').doc(userId).get();
    if (!snap.exists) return;
    const data = snap.data() as Record<string, unknown>;
    userNameById.set(userId, normalizeString(data.name) || normalizeString(data.email) || userId);
  }));

  return { dealerNameById, userNameById };
}

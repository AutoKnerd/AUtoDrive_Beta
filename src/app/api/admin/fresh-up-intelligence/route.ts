import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TrendDirection = 'up' | 'down' | 'stable';

type FreshUpSessionRecord = {
  sessionId?: string;
  userId?: string;
  dealerId?: string;
  scenarioId?: string;
  scenarioName?: string;
  timestamp?: Date;
  conversationLength: number;
  scores: {
    empathy: number;
    listening: number;
    trust: number;
    relationship: number;
    closing: number;
  };
  upMeterPeak: number;
  outcomeTag?: string;
  completionStatus?: string;
};

type SiteTrafficEventRecord = {
  pathname: string;
  surface: string;
  referrer: string | null;
  previousPath: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  visitorId: string | null;
  sessionId: string | null;
  userId: string | null;
  isLandingPage: boolean;
  geo: {
    continent: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    timezone: string | null;
    latitude: number | null;
    longitude: number | null;
    maskedIp: string | null;
  };
  createdAt: Date;
};

type DealerAggregate = {
  dealerId: string;
  dealerName: string;
  sessions: number;
  avgTrust: number;
  avgUpMeterPeak: number;
  participationRate: number;
  compositeScore: number;
};

type ScenarioAggregate = {
  scenarioId: string;
  scenarioName: string;
  sessions: number;
  avgUpMeterPeak: number;
  avgSkillScore: number;
  completionRate: number;
  compositeScore: number;
};

const MANAGERIAL_ROLES = new Set([
  'manager',
  'Service Manager',
  'Parts Manager',
  'General Manager',
  'Owner',
  'Trainer',
  'Admin',
  'Developer',
]);

const TRAINING_MODULE_BY_SKILL: Record<string, string> = {
  empathy: 'Empathy in Motion',
  listening: 'Active Listening Under Pressure',
  trust: 'Trust Through Discovery',
  relationship: 'Relationship Momentum',
  closing: 'Confidence to Commitment',
};

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    try {
      const maybeDate = (value as { toDate: () => Date }).toDate();
      return maybeDate instanceof Date && !Number.isNaN(maybeDate.getTime()) ? maybeDate : null;
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

function getTrend(current: number, previous: number, tolerance = 1.5): TrendDirection {
  const delta = current - previous;
  if (Math.abs(delta) <= tolerance) return 'stable';
  return delta > 0 ? 'up' : 'down';
}

function getCountTrend(current: number, previous: number): TrendDirection {
  const delta = current - previous;
  if (Math.abs(delta) <= 1) return 'stable';
  return delta > 0 ? 'up' : 'down';
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function upMeterLabel(value: number): string {
  if (value <= 40) return 'Customers struggle to engage';
  if (value <= 70) return 'Moderate engagement';
  return 'Strong engagement conversations';
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeReferrerLabel(value: string | null): string {
  if (!value) return 'Direct';
  try {
    const parsed = new URL(value);
    if (parsed.hostname.includes('autodrivecx.com')) return 'Internal';
    return parsed.hostname || 'Direct';
  } catch {
    return value.trim() || 'Direct';
  }
}

function topCounts<T extends string>(values: T[], limit = 5): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const key = value || 'Unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function countUniquePageSessions(items: Array<{ pathname: string; sessionId: string | null; visitorId: string | null }>): number {
  return new Set(
    items
      .map((item) => {
        const actorId = item.sessionId || item.visitorId;
        if (!actorId || !item.pathname) return null;
        return `${actorId}::${item.pathname}`;
      })
      .filter((value): value is string => Boolean(value)),
  ).size;
}

async function requireAdminOrDeveloper(req: Request): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 }) };
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 }) };
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const decoded = await adminAuth.verifyIdToken(match[1].trim());
  const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
  if (!userDoc.exists) {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 }) };
  }

  const user = userDoc.data() as User;
  if (user.role !== 'Admin' && user.role !== 'Developer') {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: Admin access required.' }, { status: 403 }) };
  }

  return { ok: true };
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdminOrDeveloper(req);
    if (!auth.ok) return auth.response;

    const adminDb = getAdminDb();
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const start7 = new Date(now.getTime() - (7 * dayMs));
    const start14 = new Date(now.getTime() - (14 * dayMs));
    const start30 = new Date(now.getTime() - (30 * dayMs));
    const start60 = new Date(now.getTime() - (60 * dayMs));
    const start90 = new Date(now.getTime() - (90 * dayMs));
    const start180 = new Date(now.getTime() - (180 * dayMs));

    // Pull only the recent horizon needed for all trend windows (7/30/90 + previous periods).
    const sessionsSnap = await adminDb
      .collection('freshUpSessions')
      .where('timestamp', '>=', Timestamp.fromDate(start180))
      .get();

    const sessions: FreshUpSessionRecord[] = sessionsSnap.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        sessionId: String(data.sessionId || docSnap.id),
        userId: String(data.userId || ''),
        dealerId: String(data.dealerId || ''),
        scenarioId: String(data.scenarioId || ''),
        scenarioName: String(data.scenarioName || 'Unnamed Scenario'),
        timestamp: toDate(data.timestamp) ?? undefined,
        conversationLength: Math.max(0, asNumber(data.conversationLength)),
        scores: {
          empathy: clampScore(asNumber((data.scores as Record<string, unknown> | undefined)?.empathy)),
          listening: clampScore(asNumber((data.scores as Record<string, unknown> | undefined)?.listening)),
          trust: clampScore(asNumber((data.scores as Record<string, unknown> | undefined)?.trust)),
          relationship: clampScore(asNumber((data.scores as Record<string, unknown> | undefined)?.relationship)),
          closing: clampScore(asNumber((data.scores as Record<string, unknown> | undefined)?.closing)),
        },
        upMeterPeak: clampScore(asNumber((data.upMeter as Record<string, unknown> | undefined)?.peak)),
        outcomeTag: String(data.outcomeTag || ''),
        completionStatus: String(data.completionStatus || 'completed'),
      };
    }).filter((row) => row.timestamp instanceof Date);

    const inWindow = <T extends { timestamp?: Date }>(items: T[], start: Date, end: Date): T[] => (
      items.filter((item) => {
        const ts = item.timestamp?.getTime();
        if (!ts) return false;
        return ts >= start.getTime() && ts < end.getTime();
      })
    );

    const sessions7 = inWindow(sessions, start7, now);
    const sessionsPrev7 = inWindow(sessions, start14, start7);
    const sessions30 = inWindow(sessions, start30, now);
    const sessionsPrev30 = inWindow(sessions, start60, start30);
    const sessions90 = inWindow(sessions, start90, now);
    const sessionsPrev90 = inWindow(sessions, start180, start90);

    const activeDealers30 = new Set(sessions30.map((row) => row.dealerId).filter(Boolean)).size;
    const activeConsultants30 = new Set(sessions30.map((row) => row.userId).filter(Boolean)).size;

    const scoreAverages = (items: FreshUpSessionRecord[]) => {
      if (!items.length) {
        return { empathy: 0, listening: 0, trust: 0, relationship: 0, closing: 0 };
      }
      return {
        empathy: average(items.map((item) => item.scores.empathy)),
        listening: average(items.map((item) => item.scores.listening)),
        trust: average(items.map((item) => item.scores.trust)),
        relationship: average(items.map((item) => item.scores.relationship)),
        closing: average(items.map((item) => item.scores.closing)),
      };
    };

    const currentScores = scoreAverages(sessions30);
    const previousScores = scoreAverages(sessionsPrev30);

    const averageConversationLength = roundToOne(average(sessions30.map((row) => row.conversationLength)));
    const averageUpMeterPeak = roundToOne(average(sessions30.map((row) => row.upMeterPeak)));

    const [
      usersSnap,
      siteTrafficSnap,
      marketingEventsSnap,
      toolUsageSnap,
      autoforgeLeadsSnap,
      sprocketSessionsSnap,
    ] = await Promise.all([
      adminDb.collection('users').limit(5000).get(),
      adminDb.collection('siteTrafficEvents').where('createdAtTs', '>=', Timestamp.fromDate(start180)).get(),
      adminDb.collection('consultant_marketing_events').limit(5000).get(),
      adminDb.collection('toolboxToolUsageEvents').where('createdAt', '>=', start180.toISOString()).get(),
      adminDb.collection('autoforge_leads').limit(5000).get(),
      adminDb.collection('sprocket_sessions').limit(5000).get(),
    ]);

    const dealerAssignedConsultants = new Map<string, Set<string>>();
    usersSnap.docs.forEach((userDoc) => {
      const data = userDoc.data() as Record<string, unknown>;
      const role = String(data.role || '');
      if (MANAGERIAL_ROLES.has(role)) return;
      const dealershipIds = Array.isArray(data.dealershipIds) ? data.dealershipIds.map((id) => String(id)).filter(Boolean) : [];
      const selfDeclared = String(data.selfDeclaredDealershipId || '').trim();
      const scopedIds = Array.from(new Set([...dealershipIds, ...(selfDeclared ? [selfDeclared] : [])]));
      scopedIds.forEach((dealerId) => {
        if (!dealerAssignedConsultants.has(dealerId)) dealerAssignedConsultants.set(dealerId, new Set());
        dealerAssignedConsultants.get(dealerId)?.add(userDoc.id);
      });
    });

    const dealershipsSnap = await adminDb.collection('dealerships').limit(2000).get();
    const dealerNameById = new Map<string, string>();
    dealershipsSnap.docs.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      dealerNameById.set(docSnap.id, String(data.name || data.dealerName || 'Unknown Dealer'));
    });

    const siteTrafficEvents: SiteTrafficEventRecord[] = siteTrafficSnap.docs
      .map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const createdAt = toDate(data.createdAtTs) ?? toDate(data.createdAt);
        if (!createdAt) return null;
        return {
          pathname: String(data.pathname || '/'),
          surface: String(data.surface || 'unknown'),
          referrer: typeof data.referrer === 'string' ? data.referrer : null,
          previousPath: typeof data.previousPath === 'string' ? data.previousPath : null,
          utmSource: typeof data.utmSource === 'string' ? data.utmSource : null,
          utmCampaign: typeof data.utmCampaign === 'string' ? data.utmCampaign : null,
          deviceType: data.deviceType === 'mobile' || data.deviceType === 'tablet' ? data.deviceType : 'desktop',
          visitorId: typeof data.visitorId === 'string' ? data.visitorId : null,
          sessionId: typeof data.sessionId === 'string' ? data.sessionId : null,
          userId: typeof data.userId === 'string' ? data.userId : null,
          isLandingPage: data.isLandingPage === true,
          geo: {
            continent: typeof (data.geo as Record<string, unknown> | undefined)?.continent === 'string' ? String((data.geo as Record<string, unknown>).continent) : null,
            country: typeof (data.geo as Record<string, unknown> | undefined)?.country === 'string' ? String((data.geo as Record<string, unknown>).country) : null,
            region: typeof (data.geo as Record<string, unknown> | undefined)?.region === 'string' ? String((data.geo as Record<string, unknown>).region) : null,
            city: typeof (data.geo as Record<string, unknown> | undefined)?.city === 'string' ? String((data.geo as Record<string, unknown>).city) : null,
            timezone: typeof (data.geo as Record<string, unknown> | undefined)?.timezone === 'string' ? String((data.geo as Record<string, unknown>).timezone) : null,
            latitude: Number.isFinite(Number((data.geo as Record<string, unknown> | undefined)?.latitude)) ? Number((data.geo as Record<string, unknown>).latitude) : null,
            longitude: Number.isFinite(Number((data.geo as Record<string, unknown> | undefined)?.longitude)) ? Number((data.geo as Record<string, unknown>).longitude) : null,
            maskedIp: typeof (data.geo as Record<string, unknown> | undefined)?.maskedIp === 'string' ? String((data.geo as Record<string, unknown>).maskedIp) : null,
          },
          createdAt,
        } as SiteTrafficEventRecord;
      })
      .filter((row): row is SiteTrafficEventRecord => row !== null);

    const traffic7 = inWindow(
      siteTrafficEvents.map((row) => ({ ...row, timestamp: row.createdAt })),
      start7,
      now,
    );
    const trafficPrev7 = inWindow(
      siteTrafficEvents.map((row) => ({ ...row, timestamp: row.createdAt })),
      start14,
      start7,
    );
    const traffic30 = inWindow(
      siteTrafficEvents.map((row) => ({ ...row, timestamp: row.createdAt })),
      start30,
      now,
    );
    const trafficPrev30 = inWindow(
      siteTrafficEvents.map((row) => ({ ...row, timestamp: row.createdAt })),
      start60,
      start30,
    );
    const traffic90 = inWindow(
      siteTrafficEvents.map((row) => ({ ...row, timestamp: row.createdAt })),
      start90,
      now,
    );
    const trafficPrev90 = inWindow(
      siteTrafficEvents.map((row) => ({ ...row, timestamp: row.createdAt })),
      start180,
      start90,
    );

    const traffic30Rows = traffic30;
    const uniqueVisitors30 = new Set(traffic30Rows.map((row) => row.visitorId).filter(Boolean)).size;
    const uniqueSessions30 = new Set(traffic30Rows.map((row) => row.sessionId).filter(Boolean)).size;
    const authenticatedVisitors30 = new Set(traffic30Rows.map((row) => row.userId).filter(Boolean)).size;
    const topPages = topCounts(traffic30Rows.map((row) => row.pathname), 8).map((row) => ({
      ...row,
      uniqueSessions: new Set(
        traffic30Rows.filter((event) => event.pathname === row.label).map((event) => event.sessionId).filter(Boolean),
      ).size,
    }));
    const landingPages = topCounts(
      traffic30Rows.filter((row) => row.isLandingPage).map((row) => row.pathname),
      8,
    );
    const topReferrers = topCounts(traffic30Rows.map((row) => normalizeReferrerLabel(row.referrer)), 6);
    const topCampaigns = topCounts(
      traffic30Rows
        .map((row) => row.utmCampaign || row.utmSource || '')
        .filter((value) => value.trim().length > 0),
      6,
    );
    const topCountries = topCounts(
      traffic30Rows.map((row) => row.geo.country || '').filter((value) => value.trim().length > 0),
      8,
    );
    const topRegions = topCounts(
      traffic30Rows
        .map((row) => {
          if (!row.geo.country && !row.geo.region) return '';
          return row.geo.region ? `${row.geo.country || 'Unknown'}-${row.geo.region}` : (row.geo.country || '');
        })
        .filter((value) => value.trim().length > 0),
      8,
    );
    const topCities = topCounts(
      traffic30Rows
        .map((row) => {
          if (!row.geo.city && !row.geo.region && !row.geo.country) return '';
          return [row.geo.city, row.geo.region, row.geo.country].filter(Boolean).join(', ');
        })
        .filter((value) => value.trim().length > 0),
      8,
    );
    const geoRows = traffic30Rows.filter((row) => row.geo.latitude !== null && row.geo.longitude !== null);
    const geoCenter = geoRows.length > 0
      ? {
          latitude: roundToOne(average(geoRows.map((row) => row.geo.latitude || 0))),
          longitude: roundToOne(average(geoRows.map((row) => row.geo.longitude || 0))),
          sampleSize: geoRows.length,
        }
      : null;
    const fromPages = topCounts(
      traffic30Rows
        .map((row) => row.previousPath || normalizeReferrerLabel(row.referrer))
        .filter((value) => value.trim().length > 0),
      8,
    );

    const sessionFlows = new Map<string, SiteTrafficEventRecord[]>();
    traffic30Rows.forEach((row) => {
      const key = row.sessionId || row.visitorId;
      if (!key) return;
      if (!sessionFlows.has(key)) sessionFlows.set(key, []);
      sessionFlows.get(key)?.push(row);
    });
    const transitionPairs: string[] = [];
    sessionFlows.forEach((rows) => {
      const ordered = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      for (let index = 0; index < ordered.length - 1; index += 1) {
        const current = ordered[index];
        const next = ordered[index + 1];
        if (!current.pathname || !next.pathname) continue;
        transitionPairs.push(`${current.pathname} -> ${next.pathname}`);
      }
    });
    const topNextSteps = topCounts(transitionPairs, 8).map((row) => {
      const [from, to] = row.label.split(' -> ');
      return {
        from,
        to,
        count: row.count,
      };
    });
    const deviceBreakdownBase = topCounts(traffic30Rows.map((row) => row.deviceType), 3);
    const deviceBreakdown = ['desktop', 'mobile', 'tablet'].map((label) => ({
      label,
      count: deviceBreakdownBase.find((row) => row.label === label)?.count || 0,
    }));
    const surfaceBreakdown = topCounts(traffic30Rows.map((row) => row.surface || 'unknown'), 8);

    const trafficTimeline = Array.from({ length: 14 }).map((_, index) => {
      const bucketStart = new Date(now.getTime() - ((13 - index) * dayMs));
      bucketStart.setHours(0, 0, 0, 0);
      const bucketEnd = new Date(bucketStart.getTime() + dayMs);
      const rows = traffic30Rows.filter((row) => row.createdAt >= bucketStart && row.createdAt < bucketEnd);
      return {
        date: bucketStart.toISOString().slice(0, 10),
        pageViews: rows.length,
        uniqueVisitors: new Set(rows.map((row) => row.visitorId).filter(Boolean)).size,
      };
    });

    const marketingEvents30 = marketingEventsSnap.docs
      .map((docSnap) => docSnap.data() as Record<string, unknown>)
      .filter((row) => {
        const createdAt = toDate(row.created_at);
        return createdAt && createdAt >= start30 && createdAt < now;
      });
    const toolUsage30 = toolUsageSnap.docs
      .map((docSnap) => docSnap.data() as Record<string, unknown>)
      .filter((row) => {
        const createdAt = toDate(row.createdAt);
        return createdAt && createdAt >= start30 && createdAt < now;
      });
    const autoforgeLeads30 = autoforgeLeadsSnap.docs
      .map((docSnap) => docSnap.data() as Record<string, unknown>)
      .filter((row) => {
        const createdAt = toDate(row.created_at);
        return createdAt && createdAt >= start30 && createdAt < now;
      });
    const sprocketSessions30 = sprocketSessionsSnap.docs
      .map((docSnap) => docSnap.data() as Record<string, unknown>)
      .filter((row) => {
        const createdAt = toDate(row.last_activity) ?? toDate(row.started_at);
        return createdAt && createdAt >= start30 && createdAt < now;
      });

    const dealerSessionMap = new Map<string, FreshUpSessionRecord[]>();
    sessions30.forEach((session) => {
      const dealerId = session.dealerId || 'unknown';
      if (!dealerSessionMap.has(dealerId)) dealerSessionMap.set(dealerId, []);
      dealerSessionMap.get(dealerId)?.push(session);
    });

    const dealerRows: DealerAggregate[] = Array.from(dealerSessionMap.entries()).map(([dealerId, dealerSessions]) => {
      const participants = new Set(dealerSessions.map((row) => row.userId).filter(Boolean)).size;
      const assignedCount = dealerAssignedConsultants.get(dealerId)?.size ?? 0;
      const denominator = assignedCount > 0 ? assignedCount : participants;
      const participationRate = denominator > 0 ? (participants / denominator) * 100 : 0;
      const avgTrust = average(dealerSessions.map((row) => row.scores.trust));
      const avgUpPeak = average(dealerSessions.map((row) => row.upMeterPeak));
      const compositeScore = (avgTrust * 0.4) + (avgUpPeak * 0.35) + (participationRate * 0.25);

      return {
        dealerId,
        dealerName: dealerNameById.get(dealerId) || dealerId || 'Unknown Dealer',
        sessions: dealerSessions.length,
        avgTrust: roundToOne(avgTrust),
        avgUpMeterPeak: roundToOne(avgUpPeak),
        participationRate: roundToOne(participationRate),
        compositeScore,
      };
    });

    const topDealers = [...dealerRows]
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, 5);

    const dealersNeedingImprovement = [...dealerRows]
      .filter((row) => row.avgTrust < 50 || row.avgUpMeterPeak < 45)
      .sort((a, b) => (a.avgTrust + a.avgUpMeterPeak) - (b.avgTrust + b.avgUpMeterPeak))
      .slice(0, 5);

    const outcomeOrder = [
      'Customer Engaged',
      'Trust Established',
      'Appointment Set',
      'Lost Momentum',
      'Conversation Breakdown',
    ];
    const outcomeCounts = new Map<string, number>(outcomeOrder.map((key) => [key, 0]));
    sessions30.forEach((row) => {
      const tag = row.outcomeTag || '';
      if (!outcomeCounts.has(tag)) return;
      outcomeCounts.set(tag, (outcomeCounts.get(tag) ?? 0) + 1);
    });

    const scenarioMap = new Map<string, FreshUpSessionRecord[]>();
    sessions30.forEach((row) => {
      const key = `${row.scenarioId || 'unknown'}::${row.scenarioName || 'Unnamed Scenario'}`;
      if (!scenarioMap.has(key)) scenarioMap.set(key, []);
      scenarioMap.get(key)?.push(row);
    });

    const scenarioRows: ScenarioAggregate[] = Array.from(scenarioMap.entries()).map(([key, rows]) => {
      const [scenarioId, scenarioName] = key.split('::');
      const avgUp = average(rows.map((item) => item.upMeterPeak));
      const avgSkill = average(rows.map((item) => (
        (item.scores.empathy + item.scores.listening + item.scores.trust + item.scores.relationship + item.scores.closing) / 5
      )));
      const completed = rows.filter((item) => (item.completionStatus || 'completed') === 'completed').length;
      const completionRate = rows.length > 0 ? (completed / rows.length) * 100 : 0;
      const compositeScore = (avgSkill * 0.5) + (avgUp * 0.3) + (completionRate * 0.2);

      return {
        scenarioId: scenarioId || 'unknown',
        scenarioName: scenarioName || 'Unnamed Scenario',
        sessions: rows.length,
        avgUpMeterPeak: roundToOne(avgUp),
        avgSkillScore: roundToOne(avgSkill),
        completionRate: roundToOne(completionRate),
        compositeScore,
      };
    });

    const topScenarios = [...scenarioRows]
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, 5);
    const lowestScenarios = [...scenarioRows]
      .sort((a, b) => a.compositeScore - b.compositeScore)
      .slice(0, 5);

    // Training opportunities are generated from platform-wide 30-day skill averages.
    const skillRows = [
      { key: 'empathy', label: 'Empathy', score: currentScores.empathy },
      { key: 'listening', label: 'Listening', score: currentScores.listening },
      { key: 'trust', label: 'Trust Building', score: currentScores.trust },
      { key: 'relationship', label: 'Relationship Building', score: currentScores.relationship },
      { key: 'closing', label: 'Closing Ability', score: currentScores.closing },
    ];
    const trainingOpportunities = skillRows
      .filter((row) => row.score < 55)
      .map((row) => ({
        skill: row.label,
        score: roundToOne(row.score),
        module: TRAINING_MODULE_BY_SKILL[row.key],
      }));
    const lowestSkill = [...skillRows].sort((a, b) => a.score - b.score)[0];

    return NextResponse.json({
      generatedAt: now.toISOString(),
      windows: {
        usage: {
          last7Days: { sessions: sessions7.length, trend: getCountTrend(sessions7.length, sessionsPrev7.length) },
          last30Days: { sessions: sessions30.length, trend: getCountTrend(sessions30.length, sessionsPrev30.length) },
          last90Days: { sessions: sessions90.length, trend: getCountTrend(sessions90.length, sessionsPrev90.length) },
          activeDealers: activeDealers30,
          activeConsultants: activeConsultants30,
        },
      },
      skillTrends: {
        empathy: { score: roundToOne(currentScores.empathy), trend: getTrend(currentScores.empathy, previousScores.empathy) },
        listening: { score: roundToOne(currentScores.listening), trend: getTrend(currentScores.listening, previousScores.listening) },
        trust: { score: roundToOne(currentScores.trust), trend: getTrend(currentScores.trust, previousScores.trust) },
        relationship: { score: roundToOne(currentScores.relationship), trend: getTrend(currentScores.relationship, previousScores.relationship) },
        closing: { score: roundToOne(currentScores.closing), trend: getTrend(currentScores.closing, previousScores.closing) },
      },
      engagement: {
        averageUpMeterPeak,
        label: upMeterLabel(averageUpMeterPeak),
      },
      siteTraffic: {
        windows: {
          last7Days: {
            pageViews: traffic7.length,
            uniqueVisitors: new Set(traffic7.map((row) => row.visitorId).filter(Boolean)).size,
            uniquePageSessions: countUniquePageSessions(traffic7),
            trend: getCountTrend(traffic7.length, trafficPrev7.length),
          },
          last30Days: {
            pageViews: traffic30.length,
            uniqueVisitors: uniqueVisitors30,
            uniqueSessions: uniqueSessions30,
            uniquePageSessions: countUniquePageSessions(traffic30Rows),
            trend: getCountTrend(traffic30.length, trafficPrev30.length),
          },
          last90Days: {
            pageViews: traffic90.length,
            uniqueVisitors: new Set(traffic90.map((row) => row.visitorId).filter(Boolean)).size,
            uniquePageSessions: countUniquePageSessions(traffic90),
            trend: getCountTrend(traffic90.length, trafficPrev90.length),
          },
        },
        topPages,
        landingPages,
        topReferrers,
        topCampaigns,
        geo: {
          topCountries,
          topRegions,
          topCities,
          geoCenter,
        },
        fromPages,
        topNextSteps,
        deviceBreakdown,
        surfaceBreakdown,
        timeline: trafficTimeline,
        conversions30Days: {
          pageViews: traffic30.length,
          uniqueVisitors: uniqueVisitors30,
          authenticatedVisitors: authenticatedVisitors30,
          toolOpens: toolUsage30.length,
          autoforgeLeads: autoforgeLeads30.length,
          sprocketSessions: sprocketSessions30.length,
          marketingEvents: marketingEvents30.length,
        },
      },
      sessionActivity: {
        totalFreshUpSessions30Days: sessions30.length,
        averageConversationLength,
      },
      dealerComparison: {
        topPerformingDealers: topDealers,
        dealersNeedingImprovement,
      },
      outcomes: outcomeOrder.map((label) => {
        const count = outcomeCounts.get(label) ?? 0;
        return {
          label,
          count,
          percentage: sessions30.length > 0 ? roundToOne((count / sessions30.length) * 100) : 0,
        };
      }),
      trainingOpportunities: {
        flagged: trainingOpportunities,
        primaryInsight: lowestSkill
          ? {
            skill: lowestSkill.label,
            score: roundToOne(lowestSkill.score),
            suggestedModule: TRAINING_MODULE_BY_SKILL[lowestSkill.key],
          }
          : null,
      },
      scenarioPerformance: {
        topPerformingScenarios: topScenarios,
        lowestPerformingScenarios: lowestScenarios,
      },
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load Fresh Up intelligence.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

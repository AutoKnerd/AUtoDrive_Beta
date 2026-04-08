import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TrendDirection = 'up' | 'down' | 'stable';

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
    country: string | null;
    region: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  timestamp: Date;
};

type ReferralCodeAggregate = {
  label: string;
  totalEvents: number;
  referralClicks: number;
  signupEvents: number;
  demoVisits: number;
  demoConversions: number;
};

type TrafficTimelinePoint = {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  authenticatedVisitors: number;
  toolOpens: number;
  marketingEvents: number;
  referralClicks: number;
  autoforgeLeads: number;
};

type TrafficSummary = {
  label: string;
  start: string;
  end: string;
  pageViews: number;
  uniqueVisitors: number;
  uniqueSessions: number;
  uniquePageSessions: number;
  trend: TrendDirection;
  topPages: Array<{ label: string; count: number; uniqueSessions: number }>;
  landingPages: Array<{ label: string; count: number }>;
  topReferrers: Array<{ label: string; count: number }>;
  topCampaigns: Array<{ label: string; count: number }>;
  geo: {
    topCountries: Array<{ label: string; count: number }>;
    topRegions: Array<{ label: string; count: number }>;
    topCities: Array<{ label: string; count: number }>;
    cityDetails: Array<{
      label: string;
      count: number;
      uniqueVisitors: number;
      uniqueSessions: number;
      topPages: Array<{ label: string; count: number }>;
      topReferrers: Array<{ label: string; count: number }>;
      landingPages: Array<{ label: string; count: number }>;
      campaigns: Array<{ label: string; count: number }>;
      deviceBreakdown: Array<{ label: string; count: number }>;
      lastSeen: string | null;
    }>;
    geoCenter: { latitude: number; longitude: number; sampleSize: number } | null;
  };
  fromPages: Array<{ label: string; count: number }>;
  topNextSteps: Array<{ from: string; to: string; count: number }>;
  deviceBreakdown: Array<{ label: string; count: number }>;
  surfaceBreakdown: Array<{ label: string; count: number }>;
  timeline: TrafficTimelinePoint[];
  conversions: {
    pageViews: number;
    uniqueVisitors: number;
    authenticatedVisitors: number;
    toolOpens: number;
    autoforgeLeads: number;
    marketingEvents: number;
    sprocketSessions: number;
    referralCodes: Array<{
      label: string;
      totalEvents: number;
      referralClicks: number;
      signupEvents: number;
      demoVisits: number;
      demoConversions: number;
    }>;
  };
};

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

function getCountTrend(current: number, previous: number): TrendDirection {
  const delta = current - previous;
  if (Math.abs(delta) <= 1) return 'stable';
  return delta > 0 ? 'up' : 'down';
}

function roundToOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function topCounts(values: string[], limit = 8): Array<{ label: string; count: number }> {
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

function getGeoCityLabel(row: SiteTrafficEventRecord): string {
  if (!row.geo.city && !row.geo.region && !row.geo.country) return '';
  return [row.geo.city, row.geo.region, row.geo.country].filter(Boolean).join(', ');
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

function startOfLocalDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addLocalDays(value: Date, days: number): Date {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function parseLocalDateOnly(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return startOfLocalDay(date);
}

function endOfLocalDayExclusive(value: Date): Date {
  const date = startOfLocalDay(value);
  return addLocalDays(date, 1);
}

function buildTrafficSummary(input: {
  label: string;
  rangeStart: Date;
  rangeEnd: Date;
  trafficRows: SiteTrafficEventRecord[];
  previousRows: SiteTrafficEventRecord[];
  marketingRows: Record<string, unknown>[];
  toolUsageRows: Record<string, unknown>[];
  autoforgeLeadRows: Record<string, unknown>[];
}): TrafficSummary {
  const { label, rangeStart, rangeEnd, trafficRows, previousRows, marketingRows, toolUsageRows, autoforgeLeadRows } = input;
  const previousCount = previousRows.length;
  const rangeMs = Math.max(1, rangeEnd.getTime() - rangeStart.getTime());
  const bucketCount = Math.min(14, Math.max(7, Math.ceil(rangeMs / (24 * 60 * 60 * 1000))));
  const bucketMs = rangeMs / bucketCount;

  const topPages = topCounts(trafficRows.map((row) => row.pathname), 8).map((row) => ({
    ...row,
    uniqueSessions: new Set(trafficRows.filter((event) => event.pathname === row.label).map((event) => event.sessionId).filter(Boolean)).size,
  }));
  const landingPages = topCounts(trafficRows.filter((row) => row.isLandingPage).map((row) => row.pathname), 8);
  const topReferrers = topCounts(trafficRows.map((row) => normalizeReferrerLabel(row.referrer)), 6);
  const topCampaigns = topCounts(trafficRows.map((row) => row.utmCampaign || row.utmSource || '').filter((value) => value.trim().length > 0), 6);
  const fromPages = topCounts(trafficRows.map((row) => row.previousPath || normalizeReferrerLabel(row.referrer)).filter((value) => value.trim().length > 0), 8);
  const cityGroups = new Map<string, SiteTrafficEventRecord[]>();
  trafficRows.forEach((row) => {
    const cityLabel = getGeoCityLabel(row);
    if (!cityLabel) return;
    if (!cityGroups.has(cityLabel)) cityGroups.set(cityLabel, []);
    cityGroups.get(cityLabel)?.push(row);
  });
  const cityDetails = Array.from(cityGroups.entries())
    .map(([cityLabel, rows]) => ({
      label: cityLabel,
      count: rows.length,
      uniqueVisitors: new Set(rows.map((row) => row.visitorId).filter(Boolean)).size,
      uniqueSessions: new Set(rows.map((row) => row.sessionId || row.visitorId).filter(Boolean)).size,
      topPages: topCounts(rows.map((row) => row.pathname).filter((value) => value.trim().length > 0), 6),
      topReferrers: topCounts(rows.map((row) => normalizeReferrerLabel(row.referrer)), 5),
      landingPages: topCounts(rows.filter((row) => row.isLandingPage).map((row) => row.pathname).filter((value) => value.trim().length > 0), 5),
      campaigns: topCounts(rows.map((row) => row.utmCampaign || row.utmSource || '').filter((value) => value.trim().length > 0), 5),
      deviceBreakdown: ['desktop', 'mobile', 'tablet'].map((deviceType) => ({
        label: deviceType,
        count: rows.filter((row) => row.deviceType === deviceType).length,
      })),
      lastSeen: rows.reduce<Date | null>((latest, row) => (row.timestamp > (latest || row.timestamp) ? row.timestamp : latest), null)?.toISOString() ?? null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const sessionFlows = new Map<string, SiteTrafficEventRecord[]>();
  trafficRows.forEach((row) => {
    const key = row.sessionId || row.visitorId;
    if (!key) return;
    if (!sessionFlows.has(key)) sessionFlows.set(key, []);
    sessionFlows.get(key)?.push(row);
  });
  const transitionPairs: string[] = [];
  sessionFlows.forEach((rows) => {
    const ordered = [...rows].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    for (let index = 0; index < ordered.length - 1; index += 1) {
      transitionPairs.push(`${ordered[index].pathname} -> ${ordered[index + 1].pathname}`);
    }
  });
  const topNextSteps = topCounts(transitionPairs, 8).map((row) => {
    const [from, to] = row.label.split(' -> ');
    return { from, to, count: row.count };
  });

  const deviceBreakdown = ['desktop', 'mobile', 'tablet'].map((label) => ({
    label,
    count: trafficRows.filter((row) => row.deviceType === label).length,
  }));
  const surfaceBreakdown = topCounts(trafficRows.map((row) => row.surface || 'unknown'), 8);
  const topCountries = topCounts(trafficRows.map((row) => row.geo.country || '').filter((value) => value.trim().length > 0), 8);
  const topRegions = topCounts(
    trafficRows.map((row) => (row.geo.region ? `${row.geo.country || 'Unknown'}-${row.geo.region}` : (row.geo.country || ''))).filter((value) => value.trim().length > 0),
    8,
  );
  const topCities = topCounts(
    trafficRows.map((row) => [row.geo.city, row.geo.region, row.geo.country].filter(Boolean).join(', ')).filter((value) => value.trim().length > 0),
    8,
  );
  const geoRows = trafficRows.filter((row) => row.geo.latitude !== null && row.geo.longitude !== null);
  const geoCenter = geoRows.length > 0
    ? {
        latitude: roundToOne(average(geoRows.map((row) => row.geo.latitude || 0))),
        longitude: roundToOne(average(geoRows.map((row) => row.geo.longitude || 0))),
        sampleSize: geoRows.length,
      }
    : null;

  const timeline = Array.from({ length: bucketCount }).map((_, index) => {
    const bucketStart = new Date(rangeStart.getTime() + (index * bucketMs));
    const bucketEnd = index === bucketCount - 1 ? rangeEnd : new Date(rangeStart.getTime() + ((index + 1) * bucketMs));
    const rows = trafficRows.filter((row) => row.timestamp >= bucketStart && row.timestamp < bucketEnd);
    const marketingBucketRows = marketingRows.filter((event) => {
      const createdAt = toDate(event.created_at);
      return createdAt && createdAt >= bucketStart && createdAt < bucketEnd;
    });
    return {
      date: bucketStart.toISOString().slice(0, 10),
      pageViews: rows.length,
      uniqueVisitors: new Set(rows.map((row) => row.visitorId).filter(Boolean)).size,
      authenticatedVisitors: new Set(rows.map((row) => row.userId).filter(Boolean)).size,
      toolOpens: toolUsageRows.filter((event) => {
        const createdAt = toDate(event.createdAt);
        return createdAt && createdAt >= bucketStart && createdAt < bucketEnd;
      }).length,
      marketingEvents: marketingBucketRows.length,
      referralClicks: marketingBucketRows.filter((event) => String(event.event_type || '').trim().toLowerCase() === 'referral_click').length,
      autoforgeLeads: autoforgeLeadRows.filter((event) => {
        const createdAt = toDate(event.created_at);
        return createdAt && createdAt >= bucketStart && createdAt < bucketEnd;
      }).length,
    };
  });

  const referralCodeMap = new Map<string, ReferralCodeAggregate>();
  marketingRows.forEach((row) => {
    const labelValue = String(row.referral_code || row.consultant_id || '').trim().toLowerCase();
    if (!labelValue) return;
    if (!referralCodeMap.has(labelValue)) {
      referralCodeMap.set(labelValue, {
        label: labelValue,
        totalEvents: 0,
        referralClicks: 0,
        signupEvents: 0,
        demoVisits: 0,
        demoConversions: 0,
      });
    }
    const aggregate = referralCodeMap.get(labelValue);
    if (!aggregate) return;
    aggregate.totalEvents += 1;
    const eventType = String(row.event_type || '').trim().toLowerCase();
    if (eventType === 'referral_click') aggregate.referralClicks += 1;
    if (eventType === 'signup_event') aggregate.signupEvents += 1;
    if (eventType === 'demo_visit') aggregate.demoVisits += 1;
    if (eventType === 'demo_conversion') aggregate.demoConversions += 1;
  });
  const referralCodes = Array.from(referralCodeMap.values())
    .sort((a, b) => b.totalEvents - a.totalEvents)
    .slice(0, 8);

  const totalPageViews = trafficRows.length;
  const totalUniqueVisitors = new Set(trafficRows.map((row) => row.visitorId).filter(Boolean)).size;
  const totalUniqueSessions = new Set(trafficRows.map((row) => row.sessionId).filter(Boolean)).size;
  const selectedToolOpenRows = toolUsageRows.filter((row) => {
    const toolId = String(row.toolId || '').trim().toLowerCase();
    return toolId.includes('sprocket');
  });

  return {
    label,
    start: rangeStart.toISOString(),
    end: rangeEnd.toISOString(),
    pageViews: totalPageViews,
    uniqueVisitors: totalUniqueVisitors,
    uniqueSessions: totalUniqueSessions,
    uniquePageSessions: countUniquePageSessions(trafficRows),
    trend: getCountTrend(totalPageViews, previousCount),
    topPages,
    landingPages,
    topReferrers,
    topCampaigns,
    geo: {
      topCountries,
      topRegions,
      topCities,
      cityDetails,
      geoCenter,
    },
    fromPages,
    topNextSteps,
    deviceBreakdown,
    surfaceBreakdown,
    timeline,
    conversions: {
      pageViews: totalPageViews,
      uniqueVisitors: totalUniqueVisitors,
      authenticatedVisitors: new Set(trafficRows.map((row) => row.userId).filter(Boolean)).size,
      toolOpens: toolUsageRows.length,
      autoforgeLeads: autoforgeLeadRows.length,
      marketingEvents: marketingRows.length,
      sprocketSessions: selectedToolOpenRows.length,
      referralCodes,
    },
  };
}

async function requireSiteTrafficAccess(req: Request): Promise<{ ok: true; user: User } | { ok: false; response: NextResponse }> {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized: Missing token.' }, { status: 401 }) };
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) {
    return { ok: false, response: NextResponse.json({ message: 'Unauthorized: Invalid token format.' }, { status: 401 }) };
  }

  const decoded = await getAdminAuth().verifyIdToken(match[1].trim());
  const userDoc = await getAdminDb().collection('users').doc(decoded.uid).get();
  if (!userDoc.exists) {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: User profile not found.' }, { status: 403 }) };
  }
  const user = userDoc.data() as User;
  if (user.role !== 'Admin' && user.role !== 'Developer' && user.hasSiteTrafficAccess !== true) {
    return { ok: false, response: NextResponse.json({ message: 'Forbidden: Site Traffic access required.' }, { status: 403 }) };
  }

  return { ok: true, user };
}

export async function GET(req: Request) {
  try {
    const auth = await requireSiteTrafficAccess(req);
    if (!auth.ok) return auth.response;

    const adminDb = getAdminDb();
    const url = new URL(req.url);
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const start7 = new Date(now.getTime() - (7 * dayMs));
    const start14 = new Date(now.getTime() - (14 * dayMs));
    const start30 = new Date(now.getTime() - (30 * dayMs));
    const start60 = new Date(now.getTime() - (60 * dayMs));
    const start90 = new Date(now.getTime() - (90 * dayMs));
    const start180 = new Date(now.getTime() - (180 * dayMs));
    const requestedRange = String(url.searchParams.get('range') || '30d').toLowerCase();
    const rangeStartParam = parseLocalDateOnly(url.searchParams.get('start'));
    const rangeEndParam = parseLocalDateOnly(url.searchParams.get('end'));
    const selectedRangeStart = rangeStartParam || (
      requestedRange === '7d'
        ? startOfLocalDay(new Date(now.getTime() - (6 * dayMs)))
        : requestedRange === 'month'
          ? startOfLocalDay(new Date(now.getFullYear(), now.getMonth(), 1))
          : requestedRange === 'year'
            ? startOfLocalDay(new Date(now.getFullYear(), 0, 1))
            : start30
    );
    const selectedRangeEnd = rangeEndParam ? endOfLocalDayExclusive(rangeEndParam) : endOfLocalDayExclusive(now);
    const rangeLabel = requestedRange === '7d'
      ? 'Last 7 Days'
      : requestedRange === '30d'
        ? 'Last 30 Days'
        : requestedRange === 'month'
          ? 'Month to Date'
          : requestedRange === 'year'
            ? 'Year to Date'
            : rangeStartParam || rangeEndParam
              ? 'Custom Range'
              : 'Last 30 Days';

    const snap = await adminDb
      .collection('siteTrafficEvents')
      .where('createdAtTs', '>=', Timestamp.fromDate(start180))
      .get();

    const events: SiteTrafficEventRecord[] = snap.docs
      .map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const timestamp = toDate(data.createdAtTs) ?? toDate(data.createdAt);
        if (!timestamp) return null;
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
            country: typeof (data.geo as Record<string, unknown> | undefined)?.country === 'string' ? String((data.geo as Record<string, unknown>).country) : null,
            region: typeof (data.geo as Record<string, unknown> | undefined)?.region === 'string' ? String((data.geo as Record<string, unknown>).region) : null,
            city: typeof (data.geo as Record<string, unknown> | undefined)?.city === 'string' ? String((data.geo as Record<string, unknown>).city) : null,
            latitude: Number.isFinite(Number((data.geo as Record<string, unknown> | undefined)?.latitude)) ? Number((data.geo as Record<string, unknown>).latitude) : null,
            longitude: Number.isFinite(Number((data.geo as Record<string, unknown> | undefined)?.longitude)) ? Number((data.geo as Record<string, unknown>).longitude) : null,
          },
          timestamp,
        } as SiteTrafficEventRecord;
      })
      .filter((row): row is SiteTrafficEventRecord => row !== null);

    const inWindow = <T extends { timestamp?: Date }>(items: T[], start: Date, end: Date): T[] => (
      items.filter((item) => {
        const ts = item.timestamp?.getTime();
        return !!ts && ts >= start.getTime() && ts < end.getTime();
      })
    );

    const traffic7 = inWindow(events, start7, now);
    const trafficPrev7 = inWindow(events, start14, start7);
    const traffic30 = inWindow(events, start30, now);
    const trafficPrev30 = inWindow(events, start60, start30);
    const traffic90 = inWindow(events, start90, now);
    const trafficPrev90 = inWindow(events, start180, start90);
    const selectedTraffic = inWindow(events, selectedRangeStart, selectedRangeEnd);
    const selectedPrevSpan = Math.max(1, selectedRangeEnd.getTime() - selectedRangeStart.getTime());
    const selectedPrevStart = new Date(selectedRangeStart.getTime() - selectedPrevSpan);
    const selectedPrevRows = inWindow(events, selectedPrevStart, selectedRangeStart);

    const topPages = topCounts(traffic30.map((row) => row.pathname), 8).map((row) => ({
      ...row,
      uniqueSessions: new Set(traffic30.filter((event) => event.pathname === row.label).map((event) => event.sessionId).filter(Boolean)).size,
    }));
    const landingPages = topCounts(traffic30.filter((row) => row.isLandingPage).map((row) => row.pathname), 8);
    const topReferrers = topCounts(traffic30.map((row) => normalizeReferrerLabel(row.referrer)), 6);
    const topCampaigns = topCounts(traffic30.map((row) => row.utmCampaign || row.utmSource || '').filter((value) => value.trim().length > 0), 6);
    const fromPages = topCounts(traffic30.map((row) => row.previousPath || normalizeReferrerLabel(row.referrer)).filter((value) => value.trim().length > 0), 8);
    const cityGroups = new Map<string, SiteTrafficEventRecord[]>();
    traffic30.forEach((row) => {
      const label = getGeoCityLabel(row);
      if (!label) return;
      if (!cityGroups.has(label)) cityGroups.set(label, []);
      cityGroups.get(label)?.push(row);
    });
    const cityDetails = Array.from(cityGroups.entries())
      .map(([label, rows]) => ({
        label,
        count: rows.length,
        uniqueVisitors: new Set(rows.map((row) => row.visitorId).filter(Boolean)).size,
        uniqueSessions: new Set(rows.map((row) => row.sessionId || row.visitorId).filter(Boolean)).size,
        topPages: topCounts(rows.map((row) => row.pathname).filter((value) => value.trim().length > 0), 6),
        topReferrers: topCounts(rows.map((row) => normalizeReferrerLabel(row.referrer)), 5),
        landingPages: topCounts(rows.filter((row) => row.isLandingPage).map((row) => row.pathname).filter((value) => value.trim().length > 0), 5),
        campaigns: topCounts(rows.map((row) => row.utmCampaign || row.utmSource || '').filter((value) => value.trim().length > 0), 5),
        deviceBreakdown: ['desktop', 'mobile', 'tablet'].map((deviceType) => ({
          label: deviceType,
          count: rows.filter((row) => row.deviceType === deviceType).length,
        })),
        lastSeen: rows.reduce<Date | null>((latest, row) => (row.timestamp > (latest || row.timestamp) ? row.timestamp : latest), null)?.toISOString() ?? null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const sessionFlows = new Map<string, SiteTrafficEventRecord[]>();
    traffic30.forEach((row) => {
      const key = row.sessionId || row.visitorId;
      if (!key) return;
      if (!sessionFlows.has(key)) sessionFlows.set(key, []);
      sessionFlows.get(key)?.push(row);
    });
    const transitionPairs: string[] = [];
    sessionFlows.forEach((rows) => {
      const ordered = [...rows].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      for (let index = 0; index < ordered.length - 1; index += 1) {
        transitionPairs.push(`${ordered[index].pathname} -> ${ordered[index + 1].pathname}`);
      }
    });
    const topNextSteps = topCounts(transitionPairs, 8).map((row) => {
      const [from, to] = row.label.split(' -> ');
      return { from, to, count: row.count };
    });

    const deviceBreakdownBase = topCounts(traffic30.map((row) => row.deviceType), 3);
    const deviceBreakdown = ['desktop', 'mobile', 'tablet'].map((label) => ({
      label,
      count: deviceBreakdownBase.find((row) => row.label === label)?.count || 0,
    }));
    const surfaceBreakdown = topCounts(traffic30.map((row) => row.surface || 'unknown'), 8);
    const topCountries = topCounts(traffic30.map((row) => row.geo.country || '').filter((value) => value.trim().length > 0), 8);
    const topRegions = topCounts(
      traffic30.map((row) => row.geo.region ? `${row.geo.country || 'Unknown'}-${row.geo.region}` : (row.geo.country || '')).filter((value) => value.trim().length > 0),
      8,
    );
    const topCities = topCounts(
      traffic30.map((row) => [row.geo.city, row.geo.region, row.geo.country].filter(Boolean).join(', ')).filter((value) => value.trim().length > 0),
      8,
    );
    const geoRows = traffic30.filter((row) => row.geo.latitude !== null && row.geo.longitude !== null);
    const geoCenter = geoRows.length > 0
      ? {
          latitude: roundToOne(average(geoRows.map((row) => row.geo.latitude || 0))),
          longitude: roundToOne(average(geoRows.map((row) => row.geo.longitude || 0))),
          sampleSize: geoRows.length,
        }
      : null;

    const traffic30Rows = traffic30;
    const marketingEventsSnap = await adminDb.collection('consultant_marketing_events').limit(5000).get();
    const toolUsageSnap = await adminDb.collection('toolboxToolUsageEvents').where('createdAt', '>=', start30.toISOString()).get();
    const autoforgeLeadsSnap = await adminDb.collection('autoforge_leads').limit(5000).get();
    const selectedMarketingEventsSnap = await adminDb.collection('consultant_marketing_events').limit(5000).get();
    const selectedToolUsageSnap = await adminDb.collection('toolboxToolUsageEvents').where('createdAt', '>=', selectedRangeStart.toISOString()).get();
    const selectedAutoforgeLeadsSnap = await adminDb.collection('autoforge_leads').limit(5000).get();

    const marketingEvents30 = marketingEventsSnap.docs
      .map((docSnap) => docSnap.data() as Record<string, unknown>)
      .filter((row) => {
        const createdAt = toDate(row.created_at);
        return createdAt && createdAt >= start30 && createdAt < now;
      });
    const referralCodeMap = new Map<string, ReferralCodeAggregate>();
    marketingEvents30.forEach((row) => {
      const label = String(row.referral_code || row.consultant_id || '').trim().toLowerCase();
      if (!label) return;
      if (!referralCodeMap.has(label)) {
        referralCodeMap.set(label, {
          label,
          totalEvents: 0,
          referralClicks: 0,
          signupEvents: 0,
          demoVisits: 0,
          demoConversions: 0,
        });
      }
      const aggregate = referralCodeMap.get(label);
      if (!aggregate) return;
      aggregate.totalEvents += 1;
      const eventType = String(row.event_type || '').trim().toLowerCase();
      if (eventType === 'referral_click') aggregate.referralClicks += 1;
      if (eventType === 'signup_event') aggregate.signupEvents += 1;
      if (eventType === 'demo_visit') aggregate.demoVisits += 1;
      if (eventType === 'demo_conversion') aggregate.demoConversions += 1;
    });
    const topReferralCodes30 = Array.from(referralCodeMap.values())
      .sort((a, b) => b.totalEvents - a.totalEvents)
      .slice(0, 8);
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
    const selectedMarketingEvents = selectedMarketingEventsSnap.docs
      .map((docSnap) => docSnap.data() as Record<string, unknown>)
      .filter((row) => {
        const createdAt = toDate(row.created_at);
        return createdAt && createdAt >= selectedRangeStart && createdAt < selectedRangeEnd;
      });
    const selectedToolUsage = selectedToolUsageSnap.docs
      .map((docSnap) => docSnap.data() as Record<string, unknown>)
      .filter((row) => {
        const createdAt = toDate(row.createdAt);
        return createdAt && createdAt >= selectedRangeStart && createdAt < selectedRangeEnd;
      });
    const selectedAutoforgeLeads = selectedAutoforgeLeadsSnap.docs
      .map((docSnap) => docSnap.data() as Record<string, unknown>)
      .filter((row) => {
        const createdAt = toDate(row.created_at);
        return createdAt && createdAt >= selectedRangeStart && createdAt < selectedRangeEnd;
      });

    const timeline = Array.from({ length: 14 }).map((_, index) => {
      const bucketStart = new Date(now.getTime() - ((13 - index) * dayMs));
      bucketStart.setHours(0, 0, 0, 0);
      const bucketEnd = new Date(bucketStart.getTime() + dayMs);
      const rows = traffic30.filter((row) => row.timestamp >= bucketStart && row.timestamp < bucketEnd);
      const marketingRows = marketingEvents30.filter((event) => {
        const createdAt = toDate(event.created_at);
        return createdAt && createdAt >= bucketStart && createdAt < bucketEnd;
      });
      return {
        date: bucketStart.toISOString().slice(0, 10),
        pageViews: rows.length,
        uniqueVisitors: new Set(rows.map((row) => row.visitorId).filter(Boolean)).size,
        authenticatedVisitors: new Set(rows.map((row) => row.userId).filter(Boolean)).size,
        toolOpens: toolUsage30.filter((event) => {
          const createdAt = toDate(event.createdAt);
          return createdAt && createdAt >= bucketStart && createdAt < bucketEnd;
        }).length,
        marketingEvents: marketingRows.length,
        referralClicks: marketingRows.filter((event) => String(event.event_type || '').trim().toLowerCase() === 'referral_click').length,
        autoforgeLeads: autoforgeLeads30.filter((event) => {
          const createdAt = toDate(event.created_at);
          return createdAt && createdAt >= bucketStart && createdAt < bucketEnd;
        }).length,
      };
    });

    const selectedRange = buildTrafficSummary({
      label: rangeLabel,
      rangeStart: selectedRangeStart,
      rangeEnd: selectedRangeEnd,
      trafficRows: selectedTraffic,
      previousRows: selectedPrevRows,
      marketingRows: selectedMarketingEvents,
      toolUsageRows: selectedToolUsage,
      autoforgeLeadRows: selectedAutoforgeLeads,
    });

    return NextResponse.json({
      generatedAt: now.toISOString(),
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
            uniqueVisitors: new Set(traffic30.map((row) => row.visitorId).filter(Boolean)).size,
            uniqueSessions: new Set(traffic30.map((row) => row.sessionId).filter(Boolean)).size,
            uniquePageSessions: countUniquePageSessions(traffic30),
            trend: getCountTrend(traffic30.length, trafficPrev30.length),
          },
          last90Days: {
            pageViews: traffic90.length,
            uniqueVisitors: new Set(traffic90.map((row) => row.visitorId).filter(Boolean)).size,
            uniquePageSessions: countUniquePageSessions(traffic90),
            trend: getCountTrend(traffic90.length, trafficPrev90.length),
          },
        },
        selectedRange,
        topPages,
        landingPages,
        topReferrers,
        topCampaigns,
        geo: {
          topCountries,
          topRegions,
          topCities,
          cityDetails,
          geoCenter,
        },
        fromPages,
        topNextSteps,
        deviceBreakdown,
        surfaceBreakdown,
        timeline,
        conversions30Days: {
          pageViews: traffic30.length,
          uniqueVisitors: new Set(traffic30.map((row) => row.visitorId).filter(Boolean)).size,
          authenticatedVisitors: new Set(traffic30.map((row) => row.userId).filter(Boolean)).size,
          toolOpens: toolUsage30.length,
          autoforgeLeads: autoforgeLeads30.length,
          marketingEvents: marketingEvents30.length,
          referralCodes: topReferralCodes30,
        },
      },
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ message: error?.message || 'Failed to load site traffic.' }, { status: 500 });
  }
}

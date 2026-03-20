export type ConsultantRecord = {
  id: string;
  slug: string;
  code: string;
  aliases: string[];
};

const CONSULTANT_STORAGE_KEY = 'consultant_referral';
const CONSULTANT_ATTRIBUTION_KEY = 'consultant_attribution';
const ATTRIBUTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export type EngagementType = 'weak' | 'medium' | 'strong';

export type ConsultantAttribution = {
  consultant_id: string;
  engagement_type: EngagementType;
  engagement_event: string;
  timestamp: number;
};

const CONSULTANTS: ConsultantRecord[] = [
  { id: 'ashley_lee', slug: 'lee', code: 'k7m2qx', aliases: ['ashley', 'ashleylee', 'ashley lee', 'lee'] },
  { id: 'cj', slug: 'cj', code: 'r4t8vn', aliases: ['cj'] },
  { id: 'chase', slug: 'chase', code: 'p9d3ws', aliases: ['chase'] },
  { id: 'jarett', slug: 'jarett', code: 'f6n1yb', aliases: ['jarett'] },
  { id: 'andrew', slug: 'andrew', code: 'L337', aliases: ['andrew'] },
];

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeToken(value: string | null | undefined): string {
  return safeDecode(String(value || ''))
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '');
}

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function engagementRank(type: EngagementType): number {
  if (type === 'strong') return 3;
  if (type === 'medium') return 2;
  return 1;
}

function isWithinAttributionWindow(timestamp: number, now = Date.now()): boolean {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  return now - timestamp <= ATTRIBUTION_WINDOW_MS;
}

export function resolveConsultant(codeOrName: string | null | undefined): ConsultantRecord | null {
  const token = normalizeToken(codeOrName);
  if (!token) return null;

  return CONSULTANTS.find((row) => {
    if (token === row.slug.toLowerCase()) return true;
    if (token === row.code.toLowerCase()) return true;
    return row.aliases.some((alias) => token === normalizeToken(alias));
  }) || null;
}

export function parseConsultantFromURL(path: string): string | null {
  const raw = String(path || '').trim();
  if (!raw) return null;

  const [rawPathname, rawQuery = ''] = raw.split('?');
  const pathname = rawPathname.split('#')[0] || '';
  const segments = pathname
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  let candidate = '';
  if (segments.length >= 2) {
    const base = segments[0]?.toLowerCase();
    if (base === 'tour' || base === 'signup' || base === 'about' || base === 'tools' || base === 'join' || base === 'demo') {
      candidate = segments[1] || '';
    }
  }

  if (!candidate && rawQuery) {
    const query = new URLSearchParams(rawQuery);
    candidate = query.get('consultant') || '';
  }

  const resolved = resolveConsultant(candidate);
  return resolved ? resolved.code : null;
}

export function storeConsultant(value: string): string | null {
  const resolved = resolveConsultant(value);
  if (!resolved || !isClient()) return null;

  localStorage.setItem(CONSULTANT_STORAGE_KEY, resolved.code);
  return resolved.code;
}

export function getAttribution(): ConsultantAttribution | null {
  if (!isClient()) return null;

  const row = parseJson<ConsultantAttribution>(localStorage.getItem(CONSULTANT_ATTRIBUTION_KEY));
  if (!row) return null;

  const resolved = resolveConsultant(row.consultant_id);
  if (!resolved) return null;
  if (!isWithinAttributionWindow(Number(row.timestamp || 0))) return null;

  if (row.engagement_type !== 'weak' && row.engagement_type !== 'medium' && row.engagement_type !== 'strong') return null;

  return {
    consultant_id: resolved.code,
    engagement_type: row.engagement_type,
    engagement_event: String(row.engagement_event || '').trim() || 'unknown',
    timestamp: Number(row.timestamp || 0),
  };
}

export function setAttribution(newAttribution: ConsultantAttribution): ConsultantAttribution | null {
  const resolved = resolveConsultant(newAttribution?.consultant_id || '');
  if (!resolved || !isClient()) return null;

  if (
    newAttribution.engagement_type !== 'weak' &&
    newAttribution.engagement_type !== 'medium' &&
    newAttribution.engagement_type !== 'strong'
  ) {
    return null;
  }

  const incoming: ConsultantAttribution = {
    consultant_id: resolved.code,
    engagement_type: newAttribution.engagement_type,
    engagement_event: String(newAttribution.engagement_event || '').trim() || 'unknown',
    timestamp: Number(newAttribution.timestamp || Date.now()),
  };

  const existingRaw = parseJson<ConsultantAttribution>(localStorage.getItem(CONSULTANT_ATTRIBUTION_KEY));
  const existing = existingRaw && isWithinAttributionWindow(Number(existingRaw.timestamp || 0))
    ? existingRaw
    : null;

  let shouldWrite = false;
  if (!existing) {
    shouldWrite = true;
  } else {
    const existingRank = engagementRank(existing.engagement_type);
    const incomingRank = engagementRank(incoming.engagement_type);
    if (incomingRank > existingRank) {
      shouldWrite = true;
    } else if (incomingRank === existingRank && incoming.timestamp > Number(existing.timestamp || 0)) {
      shouldWrite = true;
    }
  }

  if (!shouldWrite) {
    const current = getAttribution();
    if (current) storeConsultant(current.consultant_id);
    return current;
  }

  localStorage.setItem(CONSULTANT_ATTRIBUTION_KEY, JSON.stringify(incoming));
  storeConsultant(incoming.consultant_id);
  return incoming;
}

export function touchAttribution(engagementType: EngagementType, engagementEvent: string): ConsultantAttribution | null {
  const current = getAttribution();
  if (!current) return null;

  return setAttribution({
    consultant_id: current.consultant_id,
    engagement_type: engagementType,
    engagement_event: engagementEvent,
    timestamp: Date.now(),
  });
}

export function getConsultant(): string | null {
  const fromAttribution = getAttribution();
  if (fromAttribution) return fromAttribution.consultant_id;
  if (!isClient()) return null;

  const value = localStorage.getItem(CONSULTANT_STORAGE_KEY);
  const resolved = resolveConsultant(value);
  if (!resolved) return null;

  return resolved.code;
}

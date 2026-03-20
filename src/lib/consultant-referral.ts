export type ConsultantRecord = {
  id: string;
  slug: string;
  code: string;
  aliases: string[];
};

const CONSULTANT_STORAGE_KEY = 'consultant_referral';

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

export function getConsultant(): string | null {
  if (!isClient()) return null;

  const value = localStorage.getItem(CONSULTANT_STORAGE_KEY);
  const resolved = resolveConsultant(value);
  if (!resolved) return null;

  return resolved.code;
}


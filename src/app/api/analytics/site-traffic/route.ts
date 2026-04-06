import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SiteTrafficPayload = {
  pathname?: string;
  fullPath?: string;
  surface?: string;
  title?: string;
  referrer?: string | null;
  previousPath?: string | null;
  visitorId?: string | null;
  sessionId?: string | null;
  sessionStartedAt?: string | null;
  isLandingPage?: boolean;
  timezone?: string | null;
  language?: string | null;
  screenWidth?: number | null;
  screenHeight?: number | null;
  viewportWidth?: number | null;
  viewportHeight?: number | null;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  consultantId?: string | null;
  referralCode?: string | null;
  role?: string | null;
};

async function readAuthenticatedUser(req: NextRequest): Promise<{ uid: string; user: User } | null> {
  const authorization = req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!authorization) return null;

  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match?.[1]) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1].trim());
    const userSnap = await getAdminDb().collection('users').doc(decoded.uid).get();
    if (!userSnap.exists) return null;
    return {
      uid: decoded.uid,
      user: userSnap.data() as User,
    };
  } catch {
    return null;
  }
}

function cleanString(value: unknown, maxLength = 240): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cleanCoordinate(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function maskIpAddress(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(',')[0]?.trim();
  if (!first) return null;

  if (first.includes('.')) {
    const parts = first.split('.');
    if (parts.length !== 4) return null;
    return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  }

  if (first.includes(':')) {
    const parts = first.split(':').filter(Boolean);
    if (parts.length < 4) return null;
    return `${parts.slice(0, 4).join(':')}::`;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await readAuthenticatedUser(req);
    const body = await req.json().catch(() => null) as SiteTrafficPayload | null;
    const pathname = cleanString(body?.pathname, 300);
    if (!pathname) {
      return NextResponse.json({ ok: false, message: 'pathname is required.' }, { status: 400 });
    }

    const now = new Date();
    const forwardedFor = cleanString(req.headers.get('x-forwarded-for'), 200);
    const vercelCountry = cleanString(req.headers.get('x-vercel-ip-country'), 8);
    const vercelRegion = cleanString(req.headers.get('x-vercel-ip-country-region'), 32);
    const vercelCity = cleanString(req.headers.get('x-vercel-ip-city'), 120);
    const vercelContinent = cleanString(req.headers.get('x-vercel-ip-continent'), 8);
    const vercelTimezone = cleanString(req.headers.get('x-vercel-ip-timezone'), 80);
    const vercelLatitude = cleanCoordinate(req.headers.get('x-vercel-ip-latitude'));
    const vercelLongitude = cleanCoordinate(req.headers.get('x-vercel-ip-longitude'));

    const doc = {
      pathname,
      fullPath: cleanString(body?.fullPath, 500) || pathname,
      surface: cleanString(body?.surface, 80) || 'unknown',
      title: cleanString(body?.title, 300),
      referrer: cleanString(body?.referrer, 500),
      previousPath: cleanString(body?.previousPath, 500),
      visitorId: cleanString(body?.visitorId, 120),
      sessionId: cleanString(body?.sessionId, 120),
      sessionStartedAt: cleanString(body?.sessionStartedAt, 80),
      isLandingPage: body?.isLandingPage === true,
      timezone: cleanString(body?.timezone, 80),
      language: cleanString(body?.language, 40),
      screenWidth: Number.isFinite(Number(body?.screenWidth)) ? Number(body?.screenWidth) : null,
      screenHeight: Number.isFinite(Number(body?.screenHeight)) ? Number(body?.screenHeight) : null,
      viewportWidth: Number.isFinite(Number(body?.viewportWidth)) ? Number(body?.viewportWidth) : null,
      viewportHeight: Number.isFinite(Number(body?.viewportHeight)) ? Number(body?.viewportHeight) : null,
      deviceType: body?.deviceType === 'mobile' || body?.deviceType === 'tablet' ? body.deviceType : 'desktop',
      utmSource: cleanString(body?.utmSource, 120),
      utmMedium: cleanString(body?.utmMedium, 120),
      utmCampaign: cleanString(body?.utmCampaign, 160),
      utmContent: cleanString(body?.utmContent, 160),
      utmTerm: cleanString(body?.utmTerm, 160),
      gclid: cleanString(body?.gclid, 160),
      fbclid: cleanString(body?.fbclid, 160),
      consultantId: cleanString(body?.consultantId, 120),
      referralCode: cleanString(body?.referralCode, 120),
      userId: auth?.uid || null,
      role: cleanString(body?.role, 120) || auth?.user.role || null,
      isAuthenticated: Boolean(auth),
      userAgent: cleanString(req.headers.get('user-agent'), 600),
      host: cleanString(req.headers.get('host'), 200),
      geo: {
        continent: vercelContinent,
        country: vercelCountry,
        region: vercelRegion,
        city: vercelCity,
        timezone: vercelTimezone,
        latitude: vercelLatitude,
        longitude: vercelLongitude,
        maskedIp: maskIpAddress(forwardedFor),
      },
      createdAt: now.toISOString(),
      createdAtTs: Timestamp.fromDate(now),
    };

    await getAdminDb().collection('siteTrafficEvents').add(doc);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ ok: false, message: error?.message || 'Failed to track site traffic.' }, { status: 500 });
  }
}

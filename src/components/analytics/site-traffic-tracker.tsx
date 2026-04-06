'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

const VISITOR_ID_KEY = 'siteTrafficVisitorIdV1';
const SESSION_ID_KEY = 'siteTrafficSessionIdV1';
const LAST_PATH_KEY = 'siteTrafficLastPathV1';
const SESSION_STARTED_AT_KEY = 'siteTrafficSessionStartedAtV1';

function readStorage(key: string): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  const value = localStorage.getItem(key);
  return value && value.trim().length > 0 ? value : null;
}

function writeStorage(key: string, value: string): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  localStorage.setItem(key, value);
}

function getOrCreateStableId(key: string, prefix: string): string | null {
  const existing = readStorage(key);
  if (existing) return existing;
  const generated = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  writeStorage(key, generated);
  return generated;
}

function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth || window.screen?.width || 0;
  if (width > 0 && width < 768) return 'mobile';
  if (width >= 768 && width < 1024) return 'tablet';
  return 'desktop';
}

function getSurface(pathname: string): string {
  if (!pathname || pathname === '/') return 'home';
  const [segment] = pathname.split('/').filter(Boolean);
  return segment || 'home';
}

export function SiteTrafficTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { firebaseUser, user } = useAuth();
  const lastTrackedRef = useRef<string>('');

  useEffect(() => {
    if (!pathname) return;

    const search = searchParams?.toString() || '';
    const fullPath = search ? `${pathname}?${search}` : pathname;
    if (lastTrackedRef.current === fullPath) return;
    lastTrackedRef.current = fullPath;

    void (async () => {
      const visitorId = getOrCreateStableId(VISITOR_ID_KEY, 'visitor');
      const sessionId = getOrCreateStableId(SESSION_ID_KEY, 'session');
      const previousPath = readStorage(LAST_PATH_KEY);
      const sessionStartedAt = readStorage(SESSION_STARTED_AT_KEY) || new Date().toISOString();
      if (!readStorage(SESSION_STARTED_AT_KEY)) {
        writeStorage(SESSION_STARTED_AT_KEY, sessionStartedAt);
      }
      const idToken = firebaseUser ? await firebaseUser.getIdToken().catch(() => null) : null;

      await fetch('/api/analytics/site-traffic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
        },
        body: JSON.stringify({
          pathname,
          fullPath,
          surface: getSurface(pathname),
          title: typeof document !== 'undefined' ? document.title : '',
          referrer: typeof document !== 'undefined' ? document.referrer : '',
          previousPath,
          visitorId,
          sessionId,
          sessionStartedAt,
          isLandingPage: previousPath ? false : true,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
          language: typeof navigator !== 'undefined' ? navigator.language : null,
          screenWidth: typeof window !== 'undefined' ? window.screen?.width || null : null,
          screenHeight: typeof window !== 'undefined' ? window.screen?.height || null : null,
          viewportWidth: typeof window !== 'undefined' ? window.innerWidth : null,
          viewportHeight: typeof window !== 'undefined' ? window.innerHeight : null,
          deviceType: getDeviceType(),
          utmSource: searchParams?.get('utm_source') || null,
          utmMedium: searchParams?.get('utm_medium') || null,
          utmCampaign: searchParams?.get('utm_campaign') || null,
          utmContent: searchParams?.get('utm_content') || null,
          utmTerm: searchParams?.get('utm_term') || null,
          gclid: searchParams?.get('gclid') || null,
          fbclid: searchParams?.get('fbclid') || null,
          consultantId: searchParams?.get('consultant') || searchParams?.get('consultantId') || searchParams?.get('consultant_id') || null,
          referralCode: searchParams?.get('ref') || searchParams?.get('referral') || searchParams?.get('code') || null,
          role: user?.role || null,
        }),
        keepalive: true,
      }).catch(() => undefined);

      writeStorage(LAST_PATH_KEY, pathname);
    })();
  }, [firebaseUser, pathname, searchParams, user?.role]);

  return null;
}

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/firebase/admin';
import { generateWeeklyFreshUpDigest } from '@/lib/fresh-up-digest/freshUpDigestService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorizeScheduledRun(req: Request): boolean {
  const expected = process.env.FRESH_UP_DIGEST_CRON_KEY?.trim();
  if (!expected) return false;
  const provided = (req.headers.get('x-freshup-cron-key') || req.headers.get('X-FreshUp-Cron-Key') || '').trim();
  return provided.length > 0 && provided === expected;
}

export async function POST(req: Request) {
  try {
    if (!authorizeScheduledRun(req)) {
      return NextResponse.json({ message: 'Unauthorized scheduled digest run.' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const includeSandboxData = body?.includeSandboxData === true;
    const force = body?.force === true;
    const summary = await generateWeeklyFreshUpDigest({
      db: getAdminDb(),
      includeSandboxData,
      environment: includeSandboxData ? 'sandbox' : 'production',
      force,
    });
    return NextResponse.json({
      ok: true,
      schedule: 'weekly Sunday 11:30 PM server time',
      ...summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed scheduled weekly digest run.';
    return NextResponse.json({ message }, { status: 500 });
  }
}


import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import type { FreshUpAlertFilterInput, FreshUpAlertGenerationInput } from '@/lib/fresh-up-alerts/types';
import { generateFreshUpAlerts } from '@/lib/fresh-up-alerts/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function parseBool(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdminOrDeveloper(req);
    if (!auth.ok) return auth.response;
    const db = getAdminDb();
    const url = new URL(req.url);
    const filters: FreshUpAlertFilterInput = {
      severity: (url.searchParams.get('severity') || undefined) as FreshUpAlertFilterInput['severity'],
      alertType: (url.searchParams.get('alertType') || undefined) as FreshUpAlertFilterInput['alertType'],
      dealerId: url.searchParams.get('dealerId') || undefined,
      consultantId: url.searchParams.get('consultantId') || undefined,
      version: url.searchParams.get('version') || undefined,
      dateFrom: url.searchParams.get('dateFrom') || undefined,
      dateTo: url.searchParams.get('dateTo') || undefined,
      isRead: parseBool(url.searchParams.get('isRead')),
      includeResolved: parseBool(url.searchParams.get('includeResolved')),
      environment: (url.searchParams.get('environment') || 'production') as 'sandbox' | 'production',
    };

    let query = db.collection('freshUpAlerts')
      .where('environment', '==', filters.environment || 'production');

    if (filters.dateFrom) {
      query = query.where('createdAt', '>=', Timestamp.fromDate(new Date(`${filters.dateFrom}T00:00:00`)));
    } else {
      query = query.where('createdAt', '>=', Timestamp.fromDate(new Date(Date.now() - (90 * 24 * 60 * 60 * 1000))));
    }

    const snap = await query.get();
    const alerts = snap.docs
      .map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        return {
          alertId: String(data.alertId || docSnap.id),
          alertType: String(data.alertType || ''),
          entityType: String(data.entityType || ''),
          entityId: String(data.entityId || ''),
          entityName: String(data.entityName || ''),
          timeRange: String(data.timeRange || ''),
          metricName: String(data.metricName || ''),
          currentValue: Number(data.currentValue || 0),
          comparisonValue: Number(data.comparisonValue || 0),
          difference: Number(data.difference || 0),
          differencePercent: Number(data.differencePercent || 0),
          severity: String(data.severity || 'low'),
          message: String(data.message || ''),
          recommendedAction: String(data.recommendedAction || ''),
          relatedSkill: data.relatedSkill ? String(data.relatedSkill) : undefined,
          relatedArchetype: data.relatedArchetype ? String(data.relatedArchetype) : undefined,
          relatedConcern: data.relatedConcern ? String(data.relatedConcern) : undefined,
          relatedVersion: data.relatedVersion ? String(data.relatedVersion) : undefined,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
          isRead: data.isRead === true,
          resolved: data.resolved === true,
          resolvedAt: data.resolvedAt instanceof Timestamp ? data.resolvedAt.toDate().toISOString() : undefined,
          environment: String(data.environment || 'production'),
        };
      })
      .filter((row) => filters.includeResolved ? true : row.resolved !== true)
      .filter((row) => filters.severity ? row.severity === filters.severity : true)
      .filter((row) => filters.alertType ? row.alertType === filters.alertType : true)
      .filter((row) => filters.dealerId ? (row.entityType === 'dealer' && row.entityId === filters.dealerId) : true)
      .filter((row) => filters.consultantId ? (row.entityType === 'consultant' && row.entityId === filters.consultantId) : true)
      .filter((row) => filters.version ? (row.entityType === 'version' && (row.entityId === filters.version || row.relatedVersion?.includes(filters.version))) : true)
      .filter((row) => typeof filters.isRead === 'boolean' ? row.isRead === filters.isRead : true)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load alerts.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdminOrDeveloper(req);
    if (!auth.ok) return auth.response;
    const db = getAdminDb();
    const body = await req.json() as FreshUpAlertGenerationInput;
    const result = await generateFreshUpAlerts({
      db,
      options: {
        includeSandboxData: body.includeSandboxData === true,
        environment: body.environment || 'production',
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate alerts.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdminOrDeveloper(req);
    if (!auth.ok) return auth.response;
    const db = getAdminDb();
    const body = await req.json() as { alertId?: string; isRead?: boolean; resolved?: boolean };
    if (!body.alertId) {
      return NextResponse.json({ message: 'alertId is required.' }, { status: 400 });
    }
    await db.collection('freshUpAlerts').doc(body.alertId).set({
      ...(typeof body.isRead === 'boolean' ? { isRead: body.isRead } : {}),
      ...(typeof body.resolved === 'boolean' ? { resolved: body.resolved } : {}),
      ...(body.resolved === true ? { resolvedAt: Timestamp.fromDate(new Date()) } : {}),
      updatedAt: Timestamp.fromDate(new Date()),
    }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update alert.';
    return NextResponse.json({ message }, { status: 500 });
  }
}


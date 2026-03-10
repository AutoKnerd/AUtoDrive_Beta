import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { User } from '@/lib/definitions';
import { listConsultantCommissionRecords } from '@/lib/consultant-commissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdminUser(req: Request): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
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

function toCsv(records: Awaited<ReturnType<typeof listConsultantCommissionRecords>>): string {
  const headers = [
    'id',
    'consultant_id',
    'stripe_subscription_id',
    'customer_email',
    'amount',
    'commission_rate',
    'commission_amount',
    'status',
    'period_start',
    'period_end',
    'created_at',
    'paid_at',
  ];

  const escape = (value: unknown) => {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const rows = records.map((row) => headers.map((header) => escape((row as Record<string, unknown>)[header])).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdminUser(req);
    if (!auth.ok) {
      return auth.response;
    }

    const url = new URL(req.url);
    const consultantId = (url.searchParams.get('consultant') || '').trim().toLowerCase();
    const format = (url.searchParams.get('format') || '').trim().toLowerCase();
    const records = await listConsultantCommissionRecords(consultantId || undefined);

    if (format === 'csv') {
      return new NextResponse(toCsv(records), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="consultant-payouts.csv"',
        },
      });
    }

    const byConsultant = records.reduce((acc, row) => {
      const current = acc[row.consultant_id] || { consultant_id: row.consultant_id, revenue: 0, commission: 0, count: 0 };
      current.revenue += row.amount;
      current.commission += row.commission_amount;
      current.count += 1;
      acc[row.consultant_id] = current;
      return acc;
    }, {} as Record<string, { consultant_id: string; revenue: number; commission: number; count: number }>);

    return NextResponse.json({
      records,
      consultants: Object.values(byConsultant),
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load payouts.';
    return NextResponse.json({ message }, { status: 500 });
  }
}

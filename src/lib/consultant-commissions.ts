import Stripe from 'stripe';
import { getAdminDb } from '@/firebase/admin';
import { getStripe } from '@/lib/stripe';

export type ConsultantCommissionStatus = 'pending' | 'approved' | 'voided' | 'paid';

export type ConsultantCommissionRecord = {
  id: string;
  consultant_id: string;
  stripe_subscription_id: string;
  customer_email: string;
  amount: number;
  commission_rate: number;
  commission_amount: number;
  status: ConsultantCommissionStatus;
  period_start: string;
  period_end: string;
  created_at: string;
  paid_at: string | null;
};

export type ConsultantMonthlyPayoutRow = {
  month: string;
  revenue: number;
  commission: number;
  status: string;
};

export type ConsultantPayoutSummary = {
  consultant_id: string;
  rows: ConsultantMonthlyPayoutRow[];
  totals: {
    total_earned: number;
    total_paid: number;
    pending_payout: number;
  };
};

const DEFAULT_COMMISSION_RATE = 0.25;
const COMMISSIONS_COLLECTION = 'consultant_commissions';

function toIso(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return '';
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeStatus(status: Stripe.Subscription.Status): ConsultantCommissionStatus {
  if (status === 'active') return 'approved';
  if (status === 'canceled') return 'voided';
  return 'pending';
}

function formatMonthFromIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getRecordFromDoc(doc: { id: string; data: () => FirebaseFirestore.DocumentData | undefined }): ConsultantCommissionRecord {
  const data = (doc.data() || {}) as Record<string, unknown>;
  const amount = asNumber(data.amount);
  const commissionRate = asNumber(data.commission_rate) || DEFAULT_COMMISSION_RATE;
  const commissionAmount = asNumber(data.commission_amount) || Math.round(amount * commissionRate * 100) / 100;

  return {
    id: doc.id,
    consultant_id: String(data.consultant_id || '').toLowerCase(),
    stripe_subscription_id: String(data.stripe_subscription_id || ''),
    customer_email: String(data.customer_email || ''),
    amount,
    commission_rate: commissionRate,
    commission_amount: commissionAmount,
    status: (String(data.status || 'pending') as ConsultantCommissionStatus),
    period_start: toIso(data.period_start),
    period_end: toIso(data.period_end),
    created_at: toIso(data.created_at),
    paid_at: data.paid_at ? toIso(data.paid_at) : null,
  };
}

function subscriptionAmountInDollars(subscription: Stripe.Subscription): number {
  const cents = subscription.items.data.reduce((sum, item) => {
    const unitAmount = item.price.unit_amount || 0;
    const quantity = item.quantity ?? 1;
    return sum + unitAmount * quantity;
  }, 0);
  return Math.round(cents) / 100;
}

async function resolveCustomerEmail(subscription: Stripe.Subscription): Promise<string> {
  const stripe = getStripe();
  if (subscription.customer && typeof subscription.customer !== 'string' && !subscription.customer.deleted) {
    return subscription.customer.email || '';
  }

  const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
  if (!customerId) return '';

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return '';
  return customer.email || '';
}

async function findCommissionDocBySubscriptionPeriod(input: {
  subscriptionId: string;
  periodStart?: string;
  periodEnd?: string;
}): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  const adminDb = getAdminDb();
  let query: FirebaseFirestore.Query = adminDb
    .collection(COMMISSIONS_COLLECTION)
    .where('stripe_subscription_id', '==', input.subscriptionId);

  if (input.periodStart) {
    query = query.where('period_start', '==', input.periodStart);
  }

  if (input.periodEnd) {
    query = query.where('period_end', '==', input.periodEnd);
  }

  const snapshot = await query.limit(1).get();

  if (snapshot.empty) return null;
  return snapshot.docs[0];
}

export async function upsertCommissionFromSubscription(input: {
  subscription: Stripe.Subscription;
  amount?: number;
  customerEmail?: string;
  periodStart?: string;
  periodEnd?: string;
}) {
  const adminDb = getAdminDb();
  const subscription = input.subscription;
  const consultantId = String(subscription.metadata?.consultant || '').trim().toLowerCase();

  if (!consultantId) {
    return null;
  }

  const amount = Math.max(0, input.amount ?? subscriptionAmountInDollars(subscription));
  const commissionRate = DEFAULT_COMMISSION_RATE;
  const commissionAmount = Math.round(amount * commissionRate * 100) / 100;
  const status = normalizeStatus(subscription.status);
  const customerEmail = input.customerEmail ?? await resolveCustomerEmail(subscription);
  const periodStart = input.periodStart || new Date(subscription.current_period_start * 1000).toISOString();
  const periodEnd = input.periodEnd || new Date(subscription.current_period_end * 1000).toISOString();
  const existingDoc = await findCommissionDocBySubscriptionPeriod({
    subscriptionId: subscription.id,
    periodStart,
    periodEnd,
  });

  const payload = {
    consultant_id: consultantId,
    stripe_subscription_id: subscription.id,
    customer_email: customerEmail,
    amount,
    commission_rate: commissionRate,
    commission_amount: commissionAmount,
    status,
    period_start: periodStart,
    period_end: periodEnd,
    created_at: existingDoc ? (existingDoc.data().created_at || new Date().toISOString()) : new Date().toISOString(),
    paid_at: existingDoc ? (existingDoc.data().paid_at || null) : null,
  };

  if (existingDoc) {
    await existingDoc.ref.set(payload, { merge: true });
    return existingDoc.id;
  }

  const created = await adminDb.collection(COMMISSIONS_COLLECTION).add(payload);
  return created.id;
}

export async function syncCommissionStatusForSubscription(subscription: Stripe.Subscription, overrideStatus?: ConsultantCommissionStatus) {
  const adminDb = getAdminDb();
  const snapshot = await adminDb
    .collection(COMMISSIONS_COLLECTION)
    .where('stripe_subscription_id', '==', subscription.id)
    .limit(500)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const status = overrideStatus || normalizeStatus(subscription.status);
  const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  const updates = snapshot.docs.map(async (doc) => {
    const existingStatus = String(doc.data().status || '').toLowerCase();
    if (existingStatus === 'paid' && status !== 'paid') {
      return;
    }

    const payload: Record<string, unknown> = {
      status,
      period_start: periodStart,
      period_end: periodEnd,
    };

    if (status === 'paid') {
      payload.paid_at = new Date().toISOString();
    }

    await doc.ref.set(payload, { merge: true });
  });

  await Promise.all(updates);
  return snapshot.docs[0].id;
}

export async function listConsultantCommissionRecords(consultantId?: string): Promise<ConsultantCommissionRecord[]> {
  const adminDb = getAdminDb();
  const normalizedConsultantId = (consultantId || '').trim().toLowerCase();

  let query: FirebaseFirestore.Query = adminDb.collection(COMMISSIONS_COLLECTION);
  if (normalizedConsultantId) {
    query = query.where('consultant_id', '==', normalizedConsultantId);
  }

  const snapshot = await query.limit(500).get();
  const rows = snapshot.docs.map(getRecordFromDoc);

  return rows.sort((a, b) => {
    const aDate = Date.parse(a.created_at) || 0;
    const bDate = Date.parse(b.created_at) || 0;
    return bDate - aDate;
  });
}

export async function getConsultantPayoutSummary(consultantId: string): Promise<ConsultantPayoutSummary> {
  const normalizedConsultantId = consultantId.trim().toLowerCase();
  const records = await listConsultantCommissionRecords(normalizedConsultantId);
  const grouped = new Map<string, { revenue: number; commission: number; statuses: Set<string> }>();

  for (const row of records) {
    const month = formatMonthFromIso(row.period_start || row.created_at);
    const current = grouped.get(month) || { revenue: 0, commission: 0, statuses: new Set<string>() };
    current.revenue += row.amount;
    current.commission += row.commission_amount;
    current.statuses.add(row.status);
    grouped.set(month, current);
  }

  const rows: ConsultantMonthlyPayoutRow[] = [...grouped.entries()].map(([month, data]) => ({
    month,
    revenue: Math.round(data.revenue * 100) / 100,
    commission: Math.round(data.commission * 100) / 100,
    status: data.statuses.size === 1 ? [...data.statuses][0] : 'mixed',
  }));

  const totalEarned = records
    .filter((row) => row.status !== 'voided')
    .reduce((sum, row) => sum + row.commission_amount, 0);
  const totalPaid = records
    .filter((row) => row.status === 'paid')
    .reduce((sum, row) => sum + row.commission_amount, 0);
  const pendingPayout = records
    .filter((row) => row.status === 'pending' || row.status === 'approved')
    .reduce((sum, row) => sum + row.commission_amount, 0);

  return {
    consultant_id: normalizedConsultantId,
    rows: rows.sort((a, b) => (Date.parse(`1 ${b.month}`) || 0) - (Date.parse(`1 ${a.month}`) || 0)),
    totals: {
      total_earned: Math.round(totalEarned * 100) / 100,
      total_paid: Math.round(totalPaid * 100) / 100,
      pending_payout: Math.round(pendingPayout * 100) / 100,
    },
  };
}

export async function updateCommissionRecordStatus(id: string, status: ConsultantCommissionStatus): Promise<ConsultantCommissionRecord> {
  const adminDb = getAdminDb();
  const ref = adminDb.collection(COMMISSIONS_COLLECTION).doc(id);
  const existing = await ref.get();

  if (!existing.exists) {
    throw new Error('Commission record not found.');
  }

  const patch: Record<string, unknown> = {
    status,
  };
  if (status === 'paid') {
    patch.paid_at = new Date().toISOString();
  }

  await ref.set(patch, { merge: true });
  const updated = await ref.get();
  return getRecordFromDoc(updated);
}

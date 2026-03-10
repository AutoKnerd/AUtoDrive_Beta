import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { getAdminDb } from '@/firebase/admin';

export type ConsultantCustomer = {
  name: string;
  email: string;
};

export type ConsultantSalesSummary = {
  consultant: string;
  subscriber_count: number;
  monthly_revenue: number;
  consultant_commission: number;
  lifetime_revenue: number;
  average_subscription_value: number;
  customers: ConsultantCustomer[];
  recent_customers: ConsultantSubscriptionRecord[];
  payout_summary: ConsultantPayoutSummary;
};

export type ConsultantSubscriptionRecord = {
  customer_email: string;
  amount: number;
  commission: number;
  created_at: string;
};

export type ConsultantPayoutSummary = {
  period_label: string;
  period_start: string;
  period_end: string;
  subscriptions_count: number;
  gross_revenue: number;
  commission_due: number;
  generated_at: string;
};

export type LeaderboardEntry = {
  consultant: string;
  sales: number;
  monthly_revenue: number;
};

export type ConsultantCustomerRosterRow = {
  customer_email: string;
  plan: string;
  status: Stripe.Subscription.Status;
  monthly_amount: number;
  joined_date: string;
  next_billing_date: string;
  subscription_id: string;
};

function escapeStripeSearchValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function toMonthlyRevenue(amountInCents: number, interval: Stripe.Price.Recurring.Interval, intervalCount: number) {
  if (amountInCents <= 0) {
    return 0;
  }

  const normalizedCount = intervalCount > 0 ? intervalCount : 1;

  if (interval === 'year') {
    return amountInCents / 12 / normalizedCount;
  }

  if (interval === 'week') {
    return amountInCents * (52 / 12) / normalizedCount;
  }

  if (interval === 'day') {
    return amountInCents * (365 / 12) / normalizedCount;
  }

  return amountInCents / normalizedCount;
}

function getSubscriptionMonthlyRevenue(subscription: Stripe.Subscription): number {
  return subscription.items.data.reduce((total, item) => {
    const price = item.price;
    const recurring = price.recurring;
    const unitAmount = price.unit_amount;

    if (!recurring || typeof unitAmount !== 'number') {
      return total;
    }

    const quantity = item.quantity ?? 1;
    const amountForItem = unitAmount * quantity;

    return total + toMonthlyRevenue(amountForItem, recurring.interval, recurring.interval_count ?? 1);
  }, 0);
}

function formatCustomerName(customer: Stripe.Customer): string {
  return customer.name || customer.email || `Customer ${customer.id}`;
}

function asNumber(value: unknown): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return 0;
  }
  return numberValue;
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function buildLastMonthPayoutSummary(rows: ConsultantSubscriptionRecord[]): ConsultantPayoutSummary {
  const now = new Date();
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const periodRows = rows.filter((row) => {
    const createdAt = parseIsoDate(row.created_at);
    if (!createdAt) return false;
    return createdAt >= periodStart && createdAt < periodEnd;
  });

  const grossRevenue = periodRows.reduce((sum, row) => sum + row.amount, 0);
  const commissionDue = periodRows.reduce((sum, row) => sum + row.commission, 0);

  return {
    period_label: 'Last Month',
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    subscriptions_count: periodRows.length,
    gross_revenue: Math.round(grossRevenue * 100) / 100,
    commission_due: Math.round(commissionDue * 100) / 100,
    generated_at: now.toISOString(),
  };
}

async function fetchConsultantSubscriptionRecords(consultantNameLower: string): Promise<ConsultantSubscriptionRecord[]> {
  const adminDb = getAdminDb();
  const consultantNameTitle = consultantNameLower.charAt(0).toUpperCase() + consultantNameLower.slice(1);
  const [lowerSnapshot, titleSnapshot] = await Promise.all([
    adminDb
      .collection('consultant_subscriptions')
      .where('consultant', '==', consultantNameLower)
      .limit(100)
      .get(),
    adminDb
      .collection('consultant_subscriptions')
      .where('consultant', '==', consultantNameTitle)
      .limit(100)
      .get(),
  ]);

  const docsById = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const doc of lowerSnapshot.docs) {
    docsById.set(doc.id, doc);
  }
  for (const doc of titleSnapshot.docs) {
    docsById.set(doc.id, doc);
  }

  const docs = [...docsById.values()].sort((a, b) => {
    const aRaw = a.data().created_at as { toDate?: () => Date } | Date | string | undefined;
    const bRaw = b.data().created_at as { toDate?: () => Date } | Date | string | undefined;
    const toMillis = (value: { toDate?: () => Date } | Date | string | undefined) => {
      if (!value) return 0;
      if (typeof value === 'string') return Date.parse(value) || 0;
      if (value instanceof Date) return value.getTime();
      if (typeof value.toDate === 'function') return value.toDate().getTime();
      return 0;
    };
    return toMillis(bRaw) - toMillis(aRaw);
  }).slice(0, 100);

  return docs.map((doc) => {
    const data = doc.data() as Record<string, unknown>;
    const amount = asNumber(data.amount);
    const commission = asNumber(data.commission) || amount * 0.25;
    const createdAtValue = data.created_at as { toDate?: () => Date } | Date | string | undefined;

    let createdAt = '';
    if (typeof createdAtValue === 'string') {
      createdAt = createdAtValue;
    } else if (createdAtValue && typeof (createdAtValue as { toDate?: () => Date }).toDate === 'function') {
      createdAt = (createdAtValue as { toDate: () => Date }).toDate().toISOString();
    } else if (createdAtValue instanceof Date) {
      createdAt = createdAtValue.toISOString();
    }

    return {
      customer_email: String(data.customer_email || ''),
      amount,
      commission,
      created_at: createdAt,
    };
  });
}

async function fetchCustomersForSubscriptions(subscriptions: Stripe.Subscription[]): Promise<ConsultantCustomer[]> {
  const stripe = getStripe();
  const customerIds = new Set<string>();
  const expandedCustomers: ConsultantCustomer[] = [];

  for (const subscription of subscriptions) {
    if (typeof subscription.customer === 'string') {
      customerIds.add(subscription.customer);
      continue;
    }

    if (subscription.customer && !subscription.customer.deleted) {
      expandedCustomers.push({
        name: formatCustomerName(subscription.customer),
        email: subscription.customer.email ?? 'unknown@email.com',
      });
    }
  }

  const customers = await Promise.all(
    [...customerIds].map(async (customerId) => {
      try {
        const customer = await stripe.customers.retrieve(customerId);

        if (customer.deleted) {
          return null;
        }

        return {
          name: formatCustomerName(customer),
          email: customer.email ?? 'unknown@email.com',
        } satisfies ConsultantCustomer;
      } catch {
        return null;
      }
    })
  );

  const retrievedCustomers = customers.filter((customer): customer is ConsultantCustomer => customer !== null);
  return [...expandedCustomers, ...retrievedCustomers];
}

export async function getConsultantSales(consultantId: string): Promise<ConsultantSalesSummary> {
  const stripe = getStripe();
  const trimmedId = consultantId.trim();

  if (!trimmedId) {
    throw new Error('Consultant ID is required.');
  }

  const listResult = await stripe.subscriptions.list({
    limit: 100,
    expand: ['data.customer'],
  });

  const consultantNameLower = trimmedId.toLowerCase();
  const activeSubscriptions = listResult.data.filter((subscription) => {
    const consultantMetadata = subscription.metadata?.consultant ?? '';
    const statusAllowed = subscription.status === 'active' || subscription.status === 'trialing';
    return consultantMetadata.toLowerCase() === consultantNameLower && statusAllowed;
  });

  const monthlyRevenueCents = activeSubscriptions.reduce((sum, subscription) => {
    return sum + getSubscriptionMonthlyRevenue(subscription);
  }, 0);

  const customers = await fetchCustomersForSubscriptions(activeSubscriptions);
  const recentCustomers = await fetchConsultantSubscriptionRecords(consultantNameLower);
  const lifetimeRevenue = recentCustomers.reduce((sum, row) => sum + row.amount, 0);
  const consultantCommission = recentCustomers.reduce((sum, row) => sum + row.commission, 0);
  const averageSubscriptionValue = recentCustomers.length > 0 ? lifetimeRevenue / recentCustomers.length : 0;
  const payoutSummary = buildLastMonthPayoutSummary(recentCustomers);

  return {
    consultant: consultantNameLower,
    subscriber_count: activeSubscriptions.length,
    monthly_revenue: Math.round(monthlyRevenueCents / 100),
    consultant_commission: Math.round(consultantCommission * 100) / 100,
    lifetime_revenue: Math.round(lifetimeRevenue * 100) / 100,
    average_subscription_value: Math.round(averageSubscriptionValue * 100) / 100,
    customers,
    recent_customers: recentCustomers,
    payout_summary: payoutSummary,
  };
}

export async function getConsultantLeaderboard(): Promise<LeaderboardEntry[]> {
  const stripe = getStripe();
  const listResult = await stripe.subscriptions.list({
    status: 'all',
    limit: 100,
  });
  const groupedSales = new Map<string, { sales: number; monthlyRevenueCents: number }>();

  for (const subscription of listResult.data) {
    const consultantId = String(subscription.metadata?.consultant || '').trim().toLowerCase();
    const statusAllowed = subscription.status === 'active' || subscription.status === 'trialing';

    if (!consultantId || !statusAllowed) continue;

    const current = groupedSales.get(consultantId) ?? { sales: 0, monthlyRevenueCents: 0 };
    current.sales += 1;
    current.monthlyRevenueCents += getSubscriptionMonthlyRevenue(subscription);
    groupedSales.set(consultantId, current);
  }

  return [...groupedSales.entries()]
    .map(([consultant, metrics]) => ({
      consultant,
      sales: metrics.sales,
      monthly_revenue: Math.round(metrics.monthlyRevenueCents / 100),
    }))
    .sort((a, b) => b.sales - a.sales);
}

export async function getConsultantCustomers(consultantId: string): Promise<ConsultantCustomerRosterRow[]> {
  const stripe = getStripe();
  const trimmedId = consultantId.trim();
  if (!trimmedId) {
    return [];
  }

  const consultantNameLower = trimmedId.toLowerCase();
  const allowedStatuses = new Set<Stripe.Subscription.Status>(['active', 'trialing', 'past_due', 'canceled', 'incomplete']);
  const listResult = await stripe.subscriptions.list({
    status: 'all',
    limit: 100,
    expand: ['data.customer'],
  });

  const matchingSubscriptions = listResult.data.filter((subscription) => {
    const consultantMetadata = (subscription.metadata?.consultant || '').toLowerCase();
    return consultantMetadata === consultantNameLower && allowedStatuses.has(subscription.status);
  });

  const rows = await Promise.all(
    matchingSubscriptions.map(async (subscription) => {
      const firstItem = subscription.items.data[0];
      const plan = firstItem?.price?.nickname || firstItem?.price?.id || 'Unknown';
      const unitAmount = firstItem?.price?.unit_amount ?? 0;
      const monthlyAmount = unitAmount / 100;
      const joinedDate = new Date(subscription.created * 1000).toISOString();
      const nextBillingDate = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : '';

      let customerEmail = '';
      if (subscription.customer && typeof subscription.customer !== 'string' && !subscription.customer.deleted) {
        customerEmail = subscription.customer.email || '';
      } else if (typeof subscription.customer === 'string') {
        const customer = await stripe.customers.retrieve(subscription.customer);
        if (!customer.deleted) {
          customerEmail = customer.email || '';
        }
      }

      return {
        customer_email: customerEmail,
        plan,
        status: subscription.status,
        monthly_amount: monthlyAmount,
        joined_date: joinedDate,
        next_billing_date: nextBillingDate,
        subscription_id: subscription.id,
      } satisfies ConsultantCustomerRosterRow;
    })
  );

  return rows.sort((a, b) => Date.parse(b.joined_date) - Date.parse(a.joined_date));
}

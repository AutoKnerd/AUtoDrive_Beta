import Stripe from 'stripe';
import { getAdminDb } from '@/firebase/admin';
import { getStripe } from '@/lib/stripe';

export type ConsultantMarketingEventType =
  | 'referral_click'
  | 'share'
  | 'email_invite'
  | 'signup_event'
  | 'demo_visit'
  | 'demo_conversion';

export type ConsultantMarketingMetrics = {
  consultant_id: string;
  clicks: number;
  signups: number;
  conversions: number;
  conversion_rate: number;
  demo_visits: number;
  demo_conversions: number;
};

const ALLOWED_EVENTS = new Set<ConsultantMarketingEventType>([
  'referral_click',
  'share',
  'email_invite',
  'signup_event',
  'demo_visit',
  'demo_conversion',
]);

function normalizeConsultantId(value: string): string {
  return value.trim().toLowerCase();
}

function isEventType(value: string): value is ConsultantMarketingEventType {
  return ALLOWED_EVENTS.has(value as ConsultantMarketingEventType);
}

export async function recordConsultantMarketingEvent(input: {
  consultant_id: string;
  event_type: string;
  source?: string;
}) {
  const consultantId = normalizeConsultantId(input.consultant_id);
  const eventType = input.event_type.trim().toLowerCase();

  if (!consultantId || !isEventType(eventType)) {
    throw new Error('Consultant id and valid event type are required.');
  }

  const adminDb = getAdminDb();
  await adminDb.collection('consultant_marketing_events').add({
    consultant_id: consultantId,
    event_type: eventType,
    source: String(input.source || '').trim(),
    created_at: new Date().toISOString(),
  });
}

function normalizeConsultantMetadata(metadataValue: string): string {
  return String(metadataValue || '').trim().toLowerCase();
}

async function listStripeSubscriptionsForConsultant(consultantId: string): Promise<Stripe.Subscription[]> {
  const stripe = getStripe();
  const subscriptions = await stripe.subscriptions.list({
    limit: 100,
  });

  const normalized = normalizeConsultantId(consultantId);
  return subscriptions.data.filter((subscription) => {
    const fromConsultant = normalizeConsultantMetadata(subscription.metadata?.consultant || '');
    return fromConsultant === normalized;
  });
}

export async function getConsultantMarketingMetrics(consultantId: string): Promise<ConsultantMarketingMetrics> {
  const normalizedConsultantId = normalizeConsultantId(consultantId);
  if (!normalizedConsultantId) {
    throw new Error('Consultant ID is required.');
  }

  const adminDb = getAdminDb();
  const eventSnapshot = await adminDb
    .collection('consultant_marketing_events')
    .where('consultant_id', '==', normalizedConsultantId)
    .limit(1000)
    .get();

  const events = eventSnapshot.docs.map((doc) => doc.data() as Record<string, unknown>);
  const clicks = events.filter((row) => String(row.event_type || '') === 'referral_click').length;
  const signupEvents = events.filter((row) => String(row.event_type || '') === 'signup_event').length;
  const demoVisits = events.filter((row) => String(row.event_type || '') === 'demo_visit').length;
  const demoConversionsEvents = events.filter((row) => String(row.event_type || '') === 'demo_conversion').length;

  const consultantSubscriptions = await listStripeSubscriptionsForConsultant(normalizedConsultantId);
  const stripeSignups = consultantSubscriptions.length;
  const conversions = consultantSubscriptions.filter(
    (sub) => sub.status === 'active' || sub.status === 'past_due'
  ).length;
  const demoConversionsFromStripe = consultantSubscriptions.filter((sub) => {
    const source = String(sub.metadata?.marketing_source || sub.metadata?.signup_source || '').toLowerCase();
    return source === 'demo';
  }).length;

  const signups = Math.max(stripeSignups, signupEvents);
  const demoConversions = Math.max(demoConversionsEvents, demoConversionsFromStripe);
  const conversionRate = signups > 0 ? (conversions / signups) * 100 : 0;

  return {
    consultant_id: normalizedConsultantId,
    clicks,
    signups,
    conversions,
    conversion_rate: Math.round(conversionRate * 100) / 100,
    demo_visits: demoVisits,
    demo_conversions: demoConversions,
  };
}

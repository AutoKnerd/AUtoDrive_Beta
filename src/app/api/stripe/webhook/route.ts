import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { getAdminDb } from '@/firebase/admin';
import type { BillingSubscriptionStatus } from '@/lib/definitions';
import { upsertCommissionFromSubscription, syncCommissionStatusForSubscription } from '@/lib/consultant-commissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapStripeStatus(status: Stripe.Subscription.Status): BillingSubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    default:
      return 'inactive';
  }
}

function toIsoFromUnix(epochSeconds?: number | null): string | null {
  if (!epochSeconds || !Number.isFinite(epochSeconds)) return null;
  return new Date(epochSeconds * 1000).toISOString();
}

function statusGrantsPaidAccess(status: BillingSubscriptionStatus): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due';
}

function isTruthyValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function collectAutoDriveCxPriceIdsFromEnv(): Set<string> {
  const ids = new Set<string>();
  for (const [key, value] of Object.entries(process.env)) {
    if (!/^STRIPE_PRICE_.*AUTODRIVE.*CX/i.test(key)) continue;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) ids.add(trimmed);
  }
  return ids;
}

function subscriptionIncludesAutoDriveCx(subscription: Stripe.Subscription): boolean {
  const md = subscription.metadata || {};

  if (
    isTruthyValue(md.hasAutoDriveCX)
    || isTruthyValue(md.hasAutoDriveCx)
    || isTruthyValue(md.autodrive_cx)
    || isTruthyValue(md.autodriveCx)
  ) {
    return true;
  }

  const combinedMetadata = [md.feature, md.features, md.product, md.plan, md.tier]
    .filter((entry): entry is string => typeof entry === 'string')
    .join(' ')
    .toLowerCase();
  if (combinedMetadata.includes('autodrivecx') || combinedMetadata.includes('autodrive cx') || combinedMetadata.includes('autodrive_cx')) {
    return true;
  }

  const autodriveCxPriceIds = collectAutoDriveCxPriceIdsFromEnv();
  if (!autodriveCxPriceIds.size) return false;

  return subscription.items.data.some((item) => {
    const priceId = typeof item.price?.id === 'string' ? item.price.id : '';
    return priceId ? autodriveCxPriceIds.has(priceId) : false;
  });
}

async function updateUserByCustomerId(customerId: string, patch: Record<string, unknown>): Promise<boolean> {
  const adminDb = getAdminDb();
  const usersSnap = await adminDb
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnap.empty) return false;
  const userRef = usersSnap.docs[0].ref;
  await userRef.set(patch, { merge: true });
  return true;
}

async function updateDealershipByCustomerId(customerId: string, patch: Record<string, unknown>): Promise<boolean> {
  const adminDb = getAdminDb();
  const dealershipsSnap = await adminDb
    .collection('dealerships')
    .where('billingStripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (dealershipsSnap.empty) return false;
  const dealershipRef = dealershipsSnap.docs[0].ref;
  await dealershipRef.set(patch, { merge: true });
  return true;
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const adminDb = getAdminDb();
  const customerId = typeof session.customer === 'string' ? session.customer : null;
  if (!customerId) return;

  const billingScope = session.metadata?.billingScope;

  if (billingScope === 'dealership') {
    const dealershipId = session.metadata?.dealershipId;
    if (!dealershipId) return;

    await adminDb.collection('dealerships').doc(dealershipId).set(
      {
        billingStripeCustomerId: customerId,
        billingSubscriptionStatus: 'trialing',
        billingTier: session.metadata?.dealershipTier || undefined,
      },
      { merge: true }
    );
    return;
  }

  const firebaseUserId = session.metadata?.firebaseUserId || session.client_reference_id;
  if (!firebaseUserId) return;

  await adminDb.collection('users').doc(firebaseUserId).set(
    {
      stripeCustomerId: customerId,
      subscriptionStatus: 'trialing',
    },
    { merge: true }
  );
}

async function createConsultantSubscriptionRecord(input: {
  consultant: string;
  customerEmail: string;
  subscriptionId: string;
  invoiceId?: string;
  amount: number;
  status: string;
}) {
  const adminDb = getAdminDb();
  const commissionRate = 0.25;
  const commission = input.amount * commissionRate;
  if (input.invoiceId) {
    const existing = await adminDb
      .collection('consultant_subscriptions')
      .where('invoice_id', '==', input.invoiceId)
      .limit(1)
      .get();
    if (!existing.empty) return;
  }

  await adminDb.collection('consultant_subscriptions').add({
    consultant: input.consultant,
    customer_email: input.customerEmail,
    subscription_id: input.subscriptionId,
    invoice_id: input.invoiceId || '',
    amount: input.amount,
    commission,
    status: input.status,
    created_at: new Date(),
  });
}

async function handleConsultantRecordFromCheckoutSession(session: Stripe.Checkout.Session) {
  const stripe = getStripe();
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const consultant = subscription.metadata?.consultant;
  if (!consultant) return;

  let amountPaid = 0;
  if (typeof session.invoice === 'string') {
    const invoice = await stripe.invoices.retrieve(session.invoice);
    amountPaid = invoice.amount_paid / 100;
  }

  let customerEmail =
    session.customer_details?.email ||
    session.customer_email ||
    '';
  if (!customerEmail && typeof subscription.customer === 'string') {
    const customer = await stripe.customers.retrieve(subscription.customer);
    if (!customer.deleted) {
      customerEmail = customer.email || '';
    }
  }

  await createConsultantSubscriptionRecord({
    consultant,
    customerEmail,
    subscriptionId: subscription.id,
    invoiceId: typeof session.invoice === 'string' ? session.invoice : undefined,
    amount: amountPaid,
    status: 'active',
  });

  await upsertCommissionFromSubscription({
    subscription,
    amount: amountPaid,
    customerEmail,
    periodStart: new Date(subscription.current_period_start * 1000).toISOString(),
    periodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
  });
}

async function handleConsultantRecordFromInvoice(invoice: Stripe.Invoice) {
  const stripe = getStripe();
  const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : null;
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const consultant = subscription.metadata?.consultant;
  if (!consultant) return;

  let customerEmail = invoice.customer_email || '';
  if (!customerEmail && typeof subscription.customer === 'string') {
    const customer = await stripe.customers.retrieve(subscription.customer);
    if (!customer.deleted) {
      customerEmail = customer.email || '';
    }
  }

  await createConsultantSubscriptionRecord({
    consultant,
    customerEmail,
    subscriptionId: subscription.id,
    invoiceId: invoice.id,
    amount: invoice.amount_paid / 100,
    status: 'active',
  });

  const invoicePeriod = invoice.lines?.data?.[0]?.period;
  await upsertCommissionFromSubscription({
    subscription,
    amount: invoice.amount_paid / 100,
    customerEmail,
    periodStart: invoicePeriod?.start ? new Date(invoicePeriod.start * 1000).toISOString() : undefined,
    periodEnd: invoicePeriod?.end ? new Date(invoicePeriod.end * 1000).toISOString() : undefined,
  });
}

type BillingScope = 'individual' | 'dealership';

function normalizeBillingScope(value?: string): BillingScope | null {
  if (value === 'individual' || value === 'dealership') return value;
  return null;
}

async function handleSubscriptionLifecycleEvent(subscription: Stripe.Subscription, isDeleteEvent = false) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
  if (!customerId) return;

  const mappedStatus = isDeleteEvent ? 'canceled' : mapStripeStatus(subscription.status);
  const trialStartIso = toIsoFromUnix(subscription.trial_start);
  const trialEndIso = toIsoFromUnix(subscription.trial_end);
  const billingScope = normalizeBillingScope(subscription.metadata?.billingScope);

  const userPatch: Record<string, unknown> = {
    subscriptionStatus: mappedStatus,
  };

  if (subscriptionIncludesAutoDriveCx(subscription) && statusGrantsPaidAccess(mappedStatus)) {
    userPatch.hasAutoDriveCX = true;
    userPatch.tier = 'pro';
    userPatch.toolAccessLevel = 999;
  }

  if (trialStartIso) userPatch.trialStartedAt = trialStartIso;
  if (trialEndIso) userPatch.trialEndsAt = trialEndIso;

  const dealershipPatch: Record<string, unknown> = {
    billingSubscriptionStatus: mappedStatus,
    billingStripeSubscriptionId: subscription.id,
  };

  if (trialStartIso) dealershipPatch.billingTrialStartedAt = trialStartIso;
  if (trialEndIso) dealershipPatch.billingTrialEndsAt = trialEndIso;

  if (billingScope === 'individual') {
    const updatedUser = await updateUserByCustomerId(customerId, userPatch);
    if (!updatedUser) {
      console.warn('[Stripe Webhook] No matching user for individual subscription customer', customerId);
    }
    return;
  }

  if (billingScope === 'dealership') {
    const updatedDealership = await updateDealershipByCustomerId(customerId, dealershipPatch);
    if (!updatedDealership) {
      console.warn('[Stripe Webhook] No matching dealership for dealership subscription customer', customerId);
    }
    return;
  }

  // Backward compatibility for older subscriptions without billingScope metadata.
  const [updatedUser, updatedDealership] = await Promise.all([
    updateUserByCustomerId(customerId, userPatch),
    updateDealershipByCustomerId(customerId, dealershipPatch),
  ]);
  if (!updatedUser && !updatedDealership) {
    console.warn('[Stripe Webhook] No matching user or dealership for customer (no billingScope metadata)', customerId);
  }
}

async function markWebhookEventProcessed(event: Stripe.Event): Promise<boolean> {
  const adminDb = getAdminDb();
  const eventRef = adminDb.collection('stripeWebhookEvents').doc(event.id);

  return adminDb.runTransaction(async (tx) => {
    const existing = await tx.get(eventRef);
    if (existing.exists) {
      return false;
    }

    tx.set(eventRef, {
      id: event.id,
      type: event.type,
      createdAt: new Date().toISOString(),
    });
    return true;
  });
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutSessionCompleted(session);
      await handleConsultantRecordFromCheckoutSession(session);
      break;
    }

    case 'customer.subscription.created':
    {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionLifecycleEvent(subscription, false);
      await upsertCommissionFromSubscription({ subscription });
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionLifecycleEvent(subscription, false);
      await syncCommissionStatusForSubscription(subscription);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionLifecycleEvent(subscription, true);
      await syncCommissionStatusForSubscription(subscription, 'voided');
      break;
    }

    case 'invoice.payment_succeeded':
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await handleConsultantRecordFromInvoice(invoice);
      break;
    }

    default:
      break;
  }
}

export async function POST(req: Request) {
  try {
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { ok: false, message: 'Missing STRIPE_WEBHOOK_SECRET' },
        { status: 500 }
      );
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json(
        { ok: false, message: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    const payload = await req.text();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, message: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    const shouldProcess = await markWebhookEventProcessed(event);
    if (!shouldProcess) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }

    await handleEvent(event);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error('[Stripe Webhook] Error:', err);
    return NextResponse.json(
      { ok: false, message: err?.message || 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, message: 'Stripe webhook endpoint is active.' }, { status: 200 });
}

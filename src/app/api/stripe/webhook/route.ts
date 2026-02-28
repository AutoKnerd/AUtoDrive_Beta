import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { getAdminDb } from '@/firebase/admin';
import type { BillingSubscriptionStatus } from '@/lib/definitions';

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
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionLifecycleEvent(subscription, false);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionLifecycleEvent(subscription, true);
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

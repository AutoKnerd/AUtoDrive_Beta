import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { getAdminDb } from '@/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isSubscriptionActive(status: Stripe.Subscription.Status): boolean {
  return ['active', 'trialing', 'past_due'].includes(status);
}

async function updateUserByCustomerId(customerId: string, active: boolean) {
  const adminDb = getAdminDb();
  const usersSnap = await adminDb
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (usersSnap.empty) return;

  const userRef = usersSnap.docs[0].ref;
  await userRef.set(
    {
      subscriptionStatus: active ? 'active' : 'inactive',
    },
    { merge: true }
  );
}

async function handleEvent(event: Stripe.Event) {
  const adminDb = getAdminDb();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = typeof session.customer === 'string' ? session.customer : null;
      const firebaseUserId = session.metadata?.firebaseUserId || session.client_reference_id;

      if (firebaseUserId && customerId) {
        await adminDb
          .collection('users')
          .doc(firebaseUserId)
          .set(
            {
              stripeCustomerId: customerId,
              subscriptionStatus: 'active',
            },
            { merge: true }
          );
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
      if (customerId) {
        await updateUserByCustomerId(customerId, isSubscriptionActive(subscription.status));
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : null;
      if (customerId) {
        await updateUserByCustomerId(customerId, false);
      }
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

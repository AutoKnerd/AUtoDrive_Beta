import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error('Missing STRIPE_SECRET_KEY');
}
if (!stripeWebhookSecret) {
  throw new Error('Missing STRIPE_WEBHOOK_SECRET');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-02-24.acacia',
});

// Minimal idempotency cache for duplicate webhook delivery protection.
// Replace with durable storage (DB/Redis) for production-scale reliability.
const processedEventIds = new Set<string>();

type UserRecord = {
  email?: string | null;
  customerId: string;
  subscriptionId?: string | null;
  status?: 'active' | 'past_due' | 'canceled';
  hasAccess?: boolean;
};

// Minimal in-memory storage example.
const usersByCustomerId = new Map<string, UserRecord>();

export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function upsertUser(customerId: string, patch: Partial<UserRecord>) {
  const existing = usersByCustomerId.get(customerId) ?? { customerId };
  usersByCustomerId.set(customerId, { ...existing, ...patch });
}

function getId(value: string | Stripe.Customer | Stripe.Subscription | Stripe.DeletedCustomer | null): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid webhook signature';
    return res.status(400).json({ error: message });
  }

  console.log('Stripe webhook event:', event.type, 'id:', event.id);

  if (processedEventIds.has(event.id)) {
    console.log('Duplicate webhook event ignored:', event.id);
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = getId(session.customer);
        const email = session.customer_details?.email ?? session.customer_email ?? null;

        console.log('Checkout completed');
        if (customerId) {
          upsertUser(customerId, { email });
          console.log('Stored checkout customer:', { customerId, email });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = getId(invoice.customer);
        const subscriptionId = getId(invoice.subscription);

        if (customerId) {
          upsertUser(customerId, {
            subscriptionId,
            status: 'active',
            hasAccess: true,
          });
          console.log('Subscription activated and app access granted:', { customerId, subscriptionId });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = getId(invoice.customer);
        const subscriptionId = getId(invoice.subscription);

        if (customerId) {
          upsertUser(customerId, {
            subscriptionId,
            status: 'past_due',
            hasAccess: false,
          });
          console.log('Payment failed. Subscription marked past_due:', { customerId, subscriptionId });
        } else {
          console.log('Payment failed. Customer not found on invoice.');
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = getId(subscription.customer);
        const subscriptionId = subscription.id;

        if (customerId) {
          upsertUser(customerId, {
            subscriptionId,
            status: 'canceled',
            hasAccess: false,
          });
          console.log('Subscription canceled and access revoked:', { customerId, subscriptionId });
        }
        break;
      }

      default:
        console.log('Unhandled event type:', event.type);
    }

    processedEventIds.add(event.id);
    return res.status(200).json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('Webhook handler error:', message);
    return res.status(500).json({ error: message });
  }
}

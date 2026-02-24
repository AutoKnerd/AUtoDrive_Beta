'use server';

import { redirect } from 'next/navigation';
import { getStripe } from '@/lib/stripe';
import { getAdminAuth, getAdminDb } from '@/firebase/admin';
import type { Dealership, DealershipBillingTier, User } from '@/lib/definitions';
import { BILLING_PRICING } from '@/lib/billing/tiers';
import { DEFAULT_TRIAL_DAYS } from '@/lib/billing/trial';

type BillingCycle = 'monthly' | 'annual';

function getAppUrl(): string {
  const raw = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) {
    throw new Error('Missing APP_URL or NEXT_PUBLIC_APP_URL for Stripe redirects.');
  }
  return raw.replace(/\/$/, '');
}

function getTrialDays(): number {
  const value = Number.parseInt(process.env.STRIPE_TRIAL_DAYS || '', 10);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TRIAL_DAYS;
  return value;
}

function getIndividualPriceId(cycle: BillingCycle): string {
  if (cycle === 'annual') {
    return (
      process.env.STRIPE_PRICE_INDIVIDUAL_ANNUAL ||
      process.env.STRIPE_PRICE_ID_ANNUAL ||
      ''
    );
  }

  return (
    process.env.STRIPE_PRICE_INDIVIDUAL_MONTHLY ||
    process.env.STRIPE_PRICE_ID_MONTHLY ||
    process.env.STRIPE_PRICE_ID ||
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ID ||
    ''
  );
}

function getDealershipTierPriceId(tier: DealershipBillingTier): string {
  switch (tier) {
    case 'sales_fi':
      return process.env.STRIPE_PRICE_DEALERSHIP_SALES_FI_MONTHLY || '';
    case 'service_parts':
      return process.env.STRIPE_PRICE_DEALERSHIP_SERVICE_PARTS_MONTHLY || '';
    case 'owner_hq':
      return process.env.STRIPE_PRICE_DEALERSHIP_OWNER_HQ_MONTHLY || '';
    default:
      return '';
  }
}

function normalizeTier(tier?: DealershipBillingTier | null): DealershipBillingTier {
  if (tier === 'service_parts' || tier === 'owner_hq') return tier;
  return 'sales_fi';
}

async function ensureUserCustomer(userId: string, userData: Partial<User>) {
  const adminDb = getAdminDb();
  const stripe = getStripe();

  if (typeof userData.stripeCustomerId === 'string' && userData.stripeCustomerId.length > 0) {
    return userData.stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    email: userData.email,
    name: userData.name,
    metadata: {
      firebaseUserId: userId,
      billingScope: 'individual',
    },
  });

  await adminDb.collection('users').doc(userId).set(
    {
      stripeCustomerId: customer.id,
    },
    { merge: true }
  );

  return customer.id;
}

async function ensureDealershipCustomer(dealershipId: string, dealershipData: Partial<Dealership>) {
  const adminDb = getAdminDb();
  const stripe = getStripe();

  if (typeof dealershipData.billingStripeCustomerId === 'string' && dealershipData.billingStripeCustomerId.length > 0) {
    return dealershipData.billingStripeCustomerId;
  }

  const customer = await stripe.customers.create({
    name: dealershipData.name,
    metadata: {
      dealershipId,
      billingScope: 'dealership',
    },
  });

  await adminDb.collection('dealerships').doc(dealershipId).set(
    {
      billingStripeCustomerId: customer.id,
    },
    { merge: true }
  );

  return customer.id;
}

async function createIndividualSession(userId: string, billingCycle: BillingCycle) {
  const adminDb = getAdminDb();
  const stripe = getStripe();
  const appUrl = getAppUrl();
  const trialDays = getTrialDays();

  const userSnap = await adminDb.collection('users').doc(userId).get();
  if (!userSnap.exists) {
    throw new Error('User profile not found.');
  }

  const user = userSnap.data() as User;
  const priceId = getIndividualPriceId(billingCycle);
  if (!priceId) {
    throw new Error(`Missing Stripe price ID for individual ${billingCycle} plan.`);
  }

  const customerId = await ensureUserCustomer(userId, user);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/payment/cancel`,
    allow_promotion_codes: true,
    client_reference_id: userId,
    metadata: {
      firebaseUserId: userId,
      billingScope: 'individual',
      billingCycle,
    },
    subscription_data: {
      trial_period_days: trialDays,
      metadata: {
        firebaseUserId: userId,
        billingScope: 'individual',
      },
    },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL.');
  }

  redirect(session.url);
}

export async function createCheckoutSession(userId: string, billingCycle: BillingCycle = 'monthly') {
  await createIndividualSession(userId, billingCycle);
}

export async function createIndividualCheckoutSession(idToken: string, billingCycle: BillingCycle = 'monthly') {
  const adminAuth = getAdminAuth();
  const decoded = await adminAuth.verifyIdToken(idToken);
  await createIndividualSession(decoded.uid, billingCycle);
}

export async function createDealershipCheckoutSession(input: {
  idToken: string;
  dealershipId: string;
  billingTier: DealershipBillingTier;
  billingUserCount?: number;
  billingOwnerAccountCount?: number;
  billingStoreCount?: number;
}) {
  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const stripe = getStripe();
  const appUrl = getAppUrl();
  const trialDays = getTrialDays();

  const decoded = await adminAuth.verifyIdToken(input.idToken);
  const actorSnap = await adminDb.collection('users').doc(decoded.uid).get();
  if (!actorSnap.exists) {
    throw new Error('Requester profile not found.');
  }
  const actor = actorSnap.data() as User;

  const isAuthorized = ['Owner', 'General Manager', 'Admin', 'Developer'].includes(actor.role);
  if (!isAuthorized && !(actor.dealershipIds || []).includes(input.dealershipId)) {
    throw new Error('You do not have permission to manage billing for this dealership.');
  }

  const dealershipRef = adminDb.collection('dealerships').doc(input.dealershipId);
  const dealershipSnap = await dealershipRef.get();
  if (!dealershipSnap.exists) {
    throw new Error('Dealership not found.');
  }

  const dealership = dealershipSnap.data() as Dealership;
  const tier = normalizeTier(input.billingTier || dealership.billingTier);
  const basePriceId = getDealershipTierPriceId(tier);
  if (!basePriceId) {
    throw new Error(`Missing Stripe price ID for dealership tier: ${tier}.`);
  }

  const customerId = await ensureDealershipCustomer(input.dealershipId, dealership);
  const lineItems: Array<{ price: string; quantity: number }> = [{ price: basePriceId, quantity: 1 }];

  if (tier === 'sales_fi' || tier === 'service_parts') {
    const userCount = Math.max(0, Math.round(Number(input.billingUserCount ?? dealership.billingUserCount ?? 0)));
    const additionalUsers = Math.max(0, userCount - BILLING_PRICING[tier].includedUsers);
    const additionalUserPriceId = process.env.STRIPE_PRICE_ADDITIONAL_USER_MONTHLY || '';
    if (additionalUsers > 0) {
      if (!additionalUserPriceId) {
        throw new Error('Missing STRIPE_PRICE_ADDITIONAL_USER_MONTHLY for additional user billing.');
      }
      lineItems.push({ price: additionalUserPriceId, quantity: additionalUsers });
    }
  }

  if (tier === 'owner_hq') {
    const ownerCount = Math.max(0, Math.round(Number(input.billingOwnerAccountCount ?? dealership.billingOwnerAccountCount ?? 0)));
    const storeCount = Math.max(1, Math.round(Number(input.billingStoreCount ?? dealership.billingStoreCount ?? 1)));
    const additionalOwners = Math.max(0, ownerCount - BILLING_PRICING.owner_hq.includedOwnerAccounts);
    const additionalStores = Math.max(0, storeCount - BILLING_PRICING.owner_hq.includedStores);

    if (additionalOwners > 0) {
      const additionalOwnerPriceId = process.env.STRIPE_PRICE_ADDITIONAL_OWNER_ACCOUNT_MONTHLY || '';
      if (!additionalOwnerPriceId) {
        throw new Error('Missing STRIPE_PRICE_ADDITIONAL_OWNER_ACCOUNT_MONTHLY for additional owner billing.');
      }
      lineItems.push({ price: additionalOwnerPriceId, quantity: additionalOwners });
    }

    if (additionalStores > 0) {
      const additionalStorePriceId = process.env.STRIPE_PRICE_ADDITIONAL_STORE_MONTHLY || '';
      if (!additionalStorePriceId) {
        throw new Error('Missing STRIPE_PRICE_ADDITIONAL_STORE_MONTHLY for additional store billing.');
      }
      lineItems.push({ price: additionalStorePriceId, quantity: additionalStores });
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: lineItems,
    success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/payment/cancel`,
    allow_promotion_codes: true,
    metadata: {
      billingScope: 'dealership',
      dealershipId: input.dealershipId,
      dealershipTier: tier,
      actorUserId: actor.userId,
    },
    subscription_data: {
      trial_period_days: trialDays,
      metadata: {
        billingScope: 'dealership',
        dealershipId: input.dealershipId,
        dealershipTier: tier,
      },
    },
  });

  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL.');
  }

  redirect(session.url);
}

export async function createCustomerPortalSession(stripeCustomerId: string) {
  const appUrl = getAppUrl();
  const stripe = getStripe();

  if (!stripeCustomerId) {
    throw new Error('Stripe customer ID is required.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${appUrl}/profile`,
  });

  if (!session.url) {
    throw new Error('Stripe did not return a customer portal URL.');
  }

  redirect(session.url);
}

export async function assertBillingEnabled() {
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!process.env.STRIPE_SECRET_KEY || !appUrl) {
    throw new Error('Billing is not fully configured yet.');
  }
}

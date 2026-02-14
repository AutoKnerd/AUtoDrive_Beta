'use server';

import { redirect } from 'next/navigation';

/**
 * Stripe is temporarily disabled for beta.
 *
 * Why:
 * - Firebase App Hosting build was failing due to missing exports/imports in the Stripe integration chain.
 * - You asked to pull Stripe for now so onboarding + core UX can ship.
 *
 * Re-enable later by restoring the full implementation and wiring the env vars + webhook.
 */

function stripeDisabled(message?: string): never {
  // In server actions, throwing is the cleanest way to surface a controlled failure.
  throw new Error(message || 'Billing is temporarily disabled during beta.');
}

/**
 * Legacy signature used by UI buttons.
 * We redirect to /subscribe (or wherever you want) with a clear state.
 */
export async function createCheckoutSession(
  _userId: string,
  _billingCycle: 'monthly' | 'annual' = 'monthly'
) {
  // If you prefer a hard error instead of redirect, swap to: stripeDisabled(...)
  redirect('/subscribe?billing=disabled');
}

export async function createCustomerPortalSession(_stripeCustomerId: string) {
  redirect('/profile?billing=disabled');
}

/**
 * Used by the individual subscribe flow.
 */
export async function createIndividualCheckoutSession(
  _idToken: string,
  _billingCycle: 'monthly' | 'annual' = 'monthly'
) {
  redirect('/subscribe?billing=disabled');
}

// Convenience export if any callers expect a thrown error path.
export async function assertBillingEnabled() {
  stripeDisabled('Billing is temporarily disabled during beta.');
}

import type { Dealership, User, BillingSubscriptionStatus } from '@/lib/definitions';
import { isTrialActive } from '@/lib/billing/trial';

export type BillingAccessResult = {
  accessGranted: boolean;
  source: 'dealership' | 'individual' | 'none';
  status: BillingSubscriptionStatus;
  trialEndsAt: string | null;
  dealershipId?: string;
};

export function hasDealershipAssignment(user: User): boolean {
  return Array.isArray(user.dealershipIds) && user.dealershipIds.length > 0;
}

export function canPurchaseIndividualSubscription(user: User): boolean {
  if (user.role === 'Owner') return false;
  return !hasDealershipAssignment(user);
}

export function requiresIndividualCheckout(user: User): boolean {
  if (!canPurchaseIndividualSubscription(user)) return false;

  const status = normalizeStatus(user.subscriptionStatus);
  return status === 'inactive';
}

function normalizeStatus(status?: BillingSubscriptionStatus | null): BillingSubscriptionStatus {
  if (!status) return 'inactive';
  return status;
}

export function hasActiveSubscriptionStatus(status?: BillingSubscriptionStatus | null): boolean {
  const normalized = normalizeStatus(status);
  return normalized === 'active' || normalized === 'trialing' || normalized === 'past_due';
}

function hasDealershipAccess(dealership?: Dealership | null): boolean {
  if (!dealership) return false;
  const status = normalizeStatus(dealership.billingSubscriptionStatus);
  if (status === 'active' || status === 'past_due') return true;
  if (status === 'trialing') return isTrialActive(dealership.billingTrialEndsAt || null);
  return false;
}

function hasIndividualAccess(user: User): boolean {
  const status = normalizeStatus(user.subscriptionStatus);
  if (status === 'active' || status === 'past_due') return true;
  if (status === 'trialing') return isTrialActive(user.trialEndsAt || null);
  return false;
}

export function resolveBillingAccess(user: User, dealerships: Dealership[] = []): BillingAccessResult {
  if (user.dealershipIds && user.dealershipIds.length > 0) {
    for (const dealershipId of user.dealershipIds) {
      const dealership = dealerships.find((entry) => entry.id === dealershipId);
      if (!dealership) continue;
      if (hasDealershipAccess(dealership)) {
        return {
          accessGranted: true,
          source: 'dealership',
          status: normalizeStatus(dealership.billingSubscriptionStatus),
          trialEndsAt: dealership.billingTrialEndsAt || null,
          dealershipId: dealership.id,
        };
      }
    }

    return {
      accessGranted: false,
      source: 'dealership',
      status: 'inactive',
      trialEndsAt: null,
    };
  }

  if (hasIndividualAccess(user)) {
    return {
      accessGranted: true,
      source: 'individual',
      status: normalizeStatus(user.subscriptionStatus),
      trialEndsAt: user.trialEndsAt || null,
    };
  }

  return {
    accessGranted: false,
    source: 'none',
    status: normalizeStatus(user.subscriptionStatus),
    trialEndsAt: user.trialEndsAt || null,
  };
}

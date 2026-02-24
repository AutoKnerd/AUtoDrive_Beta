import type { DealershipBillingTier } from '@/lib/definitions';

export const BILLING_PRICING = {
  sales_fi: {
    label: 'Sales and F&I',
    baseMonthlyCents: 75000,
    includedUsers: 30,
    additionalUserMonthlyCents: 3500,
  },
  service_parts: {
    label: 'Service and Parts',
    baseMonthlyCents: 75000,
    includedUsers: 30,
    additionalUserMonthlyCents: 3500,
  },
  owner_hq: {
    label: 'Ownership (All Stores)',
    baseMonthlyCents: 100000,
    includedOwnerAccounts: 2,
    includedStores: 1,
    additionalOwnerMonthlyCents: 50000,
    additionalStoreMonthlyCents: 100000,
  },
} as const;

export type DealershipBillingEstimateInput = {
  tier: DealershipBillingTier;
  userCount?: number;
  ownerAccountCount?: number;
  storeCount?: number;
};

function toSafeCount(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value as number));
}

export function calculateDealershipMonthlyCents(input: DealershipBillingEstimateInput): number {
  const tier = input.tier;
  const config = BILLING_PRICING[tier];

  if (tier === 'sales_fi' || tier === 'service_parts') {
    const userCount = toSafeCount(input.userCount);
    const additionalUsers = Math.max(0, userCount - config.includedUsers);
    return config.baseMonthlyCents + (additionalUsers * config.additionalUserMonthlyCents);
  }

  const ownerCount = toSafeCount(input.ownerAccountCount);
  const storeCount = Math.max(1, toSafeCount(input.storeCount));
  const additionalOwners = Math.max(0, ownerCount - config.includedOwnerAccounts);
  const additionalStores = Math.max(0, storeCount - config.includedStores);

  return (
    config.baseMonthlyCents +
    (additionalOwners * config.additionalOwnerMonthlyCents) +
    (additionalStores * config.additionalStoreMonthlyCents)
  );
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format((Number.isFinite(cents) ? cents : 0) / 100);
}

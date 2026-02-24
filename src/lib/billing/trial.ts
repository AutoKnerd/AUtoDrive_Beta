export const DEFAULT_TRIAL_DAYS = 30;

export function buildTrialWindow(start: Date = new Date(), days: number = DEFAULT_TRIAL_DAYS): {
  trialStartedAt: string;
  trialEndsAt: string;
} {
  const startDate = new Date(start.getTime());
  const endDate = new Date(start.getTime());
  endDate.setDate(endDate.getDate() + Math.max(1, Math.round(days)));

  return {
    trialStartedAt: startDate.toISOString(),
    trialEndsAt: endDate.toISOString(),
  };
}

export function getDaysRemaining(trialEndsAt?: string | null, now: Date = new Date()): number {
  if (!trialEndsAt) return 0;
  const end = new Date(trialEndsAt);
  if (Number.isNaN(end.getTime())) return 0;
  const diffMs = end.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

export function isTrialActive(trialEndsAt?: string | null, now: Date = new Date()): boolean {
  return getDaysRemaining(trialEndsAt, now) > 0;
}

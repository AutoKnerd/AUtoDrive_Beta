export type ConsultantShareLinkType = 'join' | 'demo' | 'tour';
export type ConsultantOutreachLinkType = 'dealerReferral' | 'singleUser' | 'guidedDemo';

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

export function getConsultantShareBaseUrl(): string {
  const configuredBaseUrl = (process.env.NEXT_PUBLIC_SHARE_BASE_URL || '').trim();
  if (configuredBaseUrl) {
    return trimTrailingSlashes(configuredBaseUrl);
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return trimTrailingSlashes(window.location.origin);
  }

  return '';
}

export function buildConsultantShareLink(type: ConsultantShareLinkType, consultantSlug: string): string {
  const normalizedSlug = String(consultantSlug || '').trim().toLowerCase();
  const encodedSlug = encodeURIComponent(normalizedSlug);
  const path = `/${type}/${encodedSlug}`;
  const baseUrl = getConsultantShareBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

function getPublicReferralBaseUrl(): string {
  return trimTrailingSlashes((process.env.NEXT_PUBLIC_REFERRAL_SITE_URL || '').trim() || 'https://www.autodrivecx.com');
}

function getAppBaseUrl(): string {
  return trimTrailingSlashes((process.env.NEXT_PUBLIC_APP_BASE_URL || '').trim() || 'https://app.autodrivecx.com');
}

export function buildConsultantOutreachLink(type: ConsultantOutreachLinkType, consultantSlug: string): string {
  const normalizedSlug = String(consultantSlug || '').trim().toLowerCase();
  const encodedSlug = encodeURIComponent(normalizedSlug);

  if (type === 'dealerReferral') {
    return `${getPublicReferralBaseUrl()}?consultant=${encodedSlug}`;
  }

  if (type === 'singleUser') {
    return `${getAppBaseUrl()}/signup?consultant=${encodedSlug}`;
  }

  return `${getAppBaseUrl()}/demo/${encodedSlug}?tour=true`;
}

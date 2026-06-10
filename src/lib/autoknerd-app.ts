export const AUTOKNERD_APP_ROUTE = '/Autoknerd/app';

export const AUTOKNERD_APP_EMBED_URL =
  process.env.NEXT_PUBLIC_AUTOKNERD_APP_EMBED_URL?.trim() ||
  'https://autoknerdapp-production.up.railway.app';

const configuredLoginUrl = process.env.NEXT_PUBLIC_AUTOKNERD_APP_LOGIN_URL?.trim();
const isLocalDev =
  process.env.NODE_ENV !== 'production'
  || AUTOKNERD_APP_EMBED_URL.includes('localhost')
  || AUTOKNERD_APP_EMBED_URL.includes('127.0.0.1');

// Keep marketing-surface auth on the current Next app in local dev, but allow
// production to keep using a dedicated embedded app login when configured.
export const AUTOKNERD_APP_LOGIN_URL =
  configuredLoginUrl ||
  (isLocalDev ? '/login' : AUTOKNERD_APP_EMBED_URL);

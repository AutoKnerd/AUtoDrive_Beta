export const AUTOKNERD_APP_ROUTE = '/Autoknerd/app';

export const AUTOKNERD_APP_EMBED_URL =
  process.env.NEXT_PUBLIC_AUTOKNERD_APP_EMBED_URL?.trim() ||
  'https://autoknerdapp-production.up.railway.app';

export const AUTOKNERD_APP_LOGIN_URL = AUTOKNERD_APP_EMBED_URL;

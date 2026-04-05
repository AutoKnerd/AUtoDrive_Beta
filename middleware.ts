import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const REDIRECT_HOSTS = new Set(['autoshopcx.com', 'www.autoshopcx.com']);
const REDIRECT_DESTINATION = 'https://app.autodrivecx.com/autoshop';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.toLowerCase();

  if (!host || !REDIRECT_HOSTS.has(host)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(REDIRECT_DESTINATION, 308);
}

export const config = {
  matcher: '/:path*',
};

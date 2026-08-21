import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { locales, routing } from './i18n/routing';
import { SESSION_COOKIE } from './lib/auth/session';

/* Next 16 renamed the `middleware` convention to `proxy`. */

const intlMiddleware = createIntlMiddleware(routing);

/** Every route is locale-prefixed, so read the locale straight off the path. */
function localeOf(pathname: string): string {
  const first = pathname.split('/')[1];
  return locales.includes(first as (typeof locales)[number]) ? first : routing.defaultLocale;
}

function isSignIn(pathname: string): boolean {
  return /^\/[^/]+\/sign-in(\/|$)/.test(pathname);
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The cookie's mere presence is the gate. It is not trusted for anything
  // else: every API call carries the token and the server is the real
  // authority, so a forged cookie buys nothing but an empty dashboard.
  const signedIn = request.cookies.has(SESSION_COOKIE);

  if (!signedIn && !isSignIn(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${localeOf(pathname)}/sign-in`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Already signed in? The sign-in page has nothing to offer.
  if (signedIn && isSignIn(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${localeOf(pathname)}`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  // Skip Next internals and static files; run on everything else.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};

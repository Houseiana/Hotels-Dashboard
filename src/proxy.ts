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

/**
 * A session cookie that is present but already dead counts as signed out.
 *
 * Gating on the cookie merely EXISTING used to trap people: once a token
 * expired, every request 401'd, and any attempt to reach /sign-in was
 * redirected straight back into the broken dashboard. Reading `expiresAt`
 * here — the same field the client writes — lets the redirect go the right
 * way. The token is still never trusted for authorisation; the API decides
 * that, and a forged cookie buys nothing but an empty dashboard.
 */
function hasLiveSession(request: NextRequest): boolean {
  const cookie = request.cookies.get(SESSION_COOKIE);
  if (!cookie?.value) return false;
  try {
    const { expiresAt } = JSON.parse(cookie.value) as { expiresAt?: string };
    if (!expiresAt) return true;
    const at = Date.parse(expiresAt);
    return !Number.isFinite(at) || at > Date.now();
  } catch {
    // Unreadable cookie: treat it as no session rather than a valid one.
    return false;
  }
}

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const signedIn = hasLiveSession(request);

  if (!signedIn && !isSignIn(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${localeOf(pathname)}/sign-in`;
    url.search = '';
    const response = NextResponse.redirect(url);
    // Drop the dead cookie on the way out, so the next request does not have
    // to work it out again.
    if (request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE);
    return response;
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

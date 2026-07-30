import createIntlMiddleware from 'next-intl/middleware';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { locales, routing } from './i18n/routing';
import { CLERK_ENABLED } from './lib/auth';

/* Next 16 renamed the `middleware` convention to `proxy`; Clerk supports both. */

const intlMiddleware = createIntlMiddleware(routing);

/** Everything except the sign-in screen itself is owner/admin only. */
const isPublicRoute = createRouteMatcher(['/:locale/sign-in(.*)']);

/** Every route is locale-prefixed, so an unprefixed path has nothing to serve it. */
function localeOf(pathname: string): string {
  const first = pathname.split('/')[1];
  return locales.includes(first as (typeof locales)[number]) ? first : routing.defaultLocale;
}

const withClerk = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    // Clerk defaults to an unprefixed `/sign-in`, which matches no route *and*
    // is itself unprotected-by-nothing — it would redirect into itself forever.
    await auth.protect({
      unauthenticatedUrl: new URL(
        `/${localeOf(request.nextUrl.pathname)}/sign-in`,
        request.url,
      ).toString(),
    });
  }
  return intlMiddleware(request);
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  // Without Clerk keys the dashboard runs in dev-bypass mode (see src/lib/auth.ts),
  // so the locale middleware handles the request on its own.
  if (!CLERK_ENABLED) return intlMiddleware(request);
  return withClerk(request, event);
}

export const config = {
  // Skip Next internals and static files; run on everything else.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};

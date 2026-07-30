import createIntlMiddleware from 'next-intl/middleware';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { CLERK_ENABLED } from './lib/auth';

/* Next 16 renamed the `middleware` convention to `proxy`; Clerk supports both. */

const intlMiddleware = createIntlMiddleware(routing);

/** Everything except the auth screens themselves is owner/admin only. */
const isPublicRoute = createRouteMatcher(['/:locale/sign-in(.*)', '/:locale/sign-up(.*)']);

const withClerk = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
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

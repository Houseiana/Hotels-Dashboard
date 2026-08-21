import { z } from 'zod';

/* ---------------------------------------------------------------------------
 * Session storage.
 *
 * The dashboard authenticates with its own email/password login and holds the
 * returned bearer token itself. The token lives in a cookie rather than
 * localStorage for one reason: `proxy.ts` runs on the server and must be able
 * to see whether a request is signed in before it renders a protected route.
 *
 * The cookie is deliberately NOT httpOnly — the browser calls the Houseiana API
 * directly and has to read the token to build the Authorization header. That
 * means an XSS bug would expose the token, which is the standard trade-off for
 * a SPA talking straight to an API. Moving to httpOnly would require proxying
 * every API call through a Next route handler.
 * ------------------------------------------------------------------------- */

export const SESSION_COOKIE = 'houseiana_session';

/** Only used if the API ever omits `expiresAt`; normally its value wins. */
const FALLBACK_MAX_AGE_SECONDS = 60 * 60 * 12;

export const sessionUserSchema = z.object({
  /** The `managerId` every HotelManagement endpoint expects. */
  id: z.string(),
  email: z.string().optional(),
  name: z.string().optional(),
  /** e.g. "HotelManager" — reserved for role-aware navigation later. */
  role: z.string().optional(),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

export const sessionSchema = z.object({
  token: z.string(),
  /** ISO timestamp from the API; the cookie is set to expire with the token. */
  expiresAt: z.string().optional(),
  user: sessionUserSchema,
});

export type Session = z.infer<typeof sessionSchema>;

/** Seconds until the API says the token dies, clamped to something sane. */
function maxAgeFor(session: Session): number {
  if (!session.expiresAt) return FALLBACK_MAX_AGE_SECONDS;
  const seconds = Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : FALLBACK_MAX_AGE_SECONDS;
}

export function isExpired(session: Session): boolean {
  if (!session.expiresAt) return false;
  const at = Date.parse(session.expiresAt);
  return Number.isFinite(at) && at <= Date.now();
}

/* -- cookie plumbing ------------------------------------------------------- */

function writeCookie(value: string, maxAge: number): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function readCookie(): string | null {
  const match = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${SESSION_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null;
}

function clearCookie(): void {
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

/* -- api ------------------------------------------------------------------- */

export function loadSession(): Session | null {
  if (typeof document === 'undefined') return null;
  const raw = readCookie();
  if (!raw) return null;
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    // The cookie should have expired on its own, but a clock skew or a manual
    // edit shouldn't leave the app holding a dead token.
    if (isExpired(parsed.data)) {
      clearCookie();
      return null;
    }
    return parsed.data;
  } catch {
    // A malformed cookie is indistinguishable from no session.
    return null;
  }
}

export function saveSession(session: Session): void {
  writeCookie(JSON.stringify(session), maxAgeFor(session));
}

export function clearSession(): void {
  clearCookie();
}

import { z } from 'zod';
import { ApiError, buildUrl, USE_MOCK } from './config';
import { sessionSchema, type Session } from '../auth/session';

/* ---------------------------------------------------------------------------
 * Email/password sign-in. Verified against the live endpoint:
 *
 *   POST /api/hotels/login  { email, password }
 *   200 → { success, token, expiresAt, user: { id, email, fullName, role } }
 *   401 → { success: false, statusCode: 401, message: "Invalid email or password." }
 *   400 → { success: false, statusCode: 400, errors: ["The Email field is required.", …] }
 *
 * Note the success payload has NO `data` envelope — token and user sit at the
 * top level, unlike every other endpoint on this API.
 *
 * `user.id` is the `managerId` that the HotelManagement endpoints require.
 * ------------------------------------------------------------------------- */

export const LOGIN_PATH = '/api/hotels/login';

export type Credentials = {
  email: string;
  password: string;
};

const loginResponseSchema = z.object({
  success: z.boolean().optional(),
  token: z.string().min(1),
  expiresAt: z.string().optional(),
  user: z.object({
    id: z.string().min(1),
    email: z.string().optional(),
    // Currently returned as "" for accounts with no name set.
    fullName: z.string().optional(),
    role: z.string().optional(),
  }),
});

export function readLoginResponse(payload: unknown): Session {
  const parsed = loginResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      'The login response did not include a token and a user id',
      200,
      parsed.error.issues,
    );
  }

  const { token, expiresAt, user } = parsed.data;
  const name = user.fullName?.trim();

  return sessionSchema.parse({
    token,
    expiresAt,
    user: {
      id: user.id,
      email: user.email,
      // An empty fullName is "no name", not a name that happens to be blank.
      name: name || undefined,
      role: user.role,
    },
  });
}

/** A stand-in session so the dashboard runs without a backend. */
function mockSession(email: string): Session {
  return {
    token: 'mock-token',
    expiresAt: new Date(Date.now() + 12 * 60 * 60_000).toISOString(),
    user: { id: 'mock-manager', email, name: 'Demo Owner', role: 'HotelManager' },
  };
}

export const authApi = {
  async login({ email, password }: Credentials): Promise<Session> {
    if (USE_MOCK) return mockSession(email);

    const response = await fetch(buildUrl(LOGIN_PATH), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const payload = await response.json().catch(() => undefined);

    if (!response.ok) {
      const parsed = z
        .object({
          message: z.string().nullable().optional(),
          errors: z.array(z.string()).nullable().optional(),
        })
        .safeParse(payload);
      const detail = parsed.success
        ? parsed.data.errors?.join(' ') || parsed.data.message
        : undefined;
      throw new ApiError(detail || 'signInFailed', response.status, payload);
    }

    return readLoginResponse(payload);
  },
};

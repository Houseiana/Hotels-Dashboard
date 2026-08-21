/**
 * The dashboard owns its own sign-in: email + password against
 * `POST /api/hotels/login`, with the returned bearer token held in a cookie
 * (see src/lib/auth/session.ts).
 *
 * While the mock backend is in use there is no real credential to check, so the
 * login form accepts anything and mints a demo session — this keeps the project
 * runnable without a backend, exactly as USE_MOCK does for the data layer.
 */
export { USE_MOCK as AUTH_IS_MOCKED } from './api/config';

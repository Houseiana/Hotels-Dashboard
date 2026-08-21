import { z } from 'zod';
import { loadSession } from '../auth/session';

/**
 * Flip to a real backend by setting NEXT_PUBLIC_USE_MOCK=false. Nothing above
 * this layer knows which one is in play — the service modules expose the same
 * signatures either way.
 */
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== 'false';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/* -- auth ------------------------------------------------------------------ */

/**
 * Every call carries `Bearer {token}` from the dashboard's own sign-in.
 *
 * The token is read straight from the session cookie on each request rather
 * than handed in from React state. That matters: effects run child-first, so a
 * query mounted below the session provider would otherwise fire before the
 * provider had published the token, and the first request of every page load
 * would 401.
 */
function authHeader(): Record<string, string> {
  const token = loadSession()?.token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/* -- responses ------------------------------------------------------------- */

/**
 * The Houseiana envelope, confirmed against the live API. Business endpoints
 * wrap their payload; the lookup endpoints return a bare array instead.
 *
 *   { success, message, data, pagination, statusCounts,
 *     inventoryStatusCounts, bookingStats, currency }
 *
 * Errors use the same envelope with `errors: string[]`:
 *   { success: false, statusCode: 400, message: "…", errors: ["…"] }
 */
export const paginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

export type Pagination = z.infer<typeof paginationSchema>;

const errorEnvelopeSchema = z.object({
  success: z.literal(false).optional(),
  statusCode: z.number().optional(),
  message: z.string().nullable().optional(),
  errors: z.array(z.string()).nullable().optional(),
});

/** Turns the API's error envelope into a single readable sentence. */
function describeError(body: unknown, fallback: string): string {
  const parsed = errorEnvelopeSchema.safeParse(body);
  if (!parsed.success) return fallback;
  const { message, errors } = parsed.data;
  if (errors?.length) return errors.join(' ');
  return message || fallback;
}

type QueryParams = Record<string, string | number | boolean | undefined | null>;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Sent as multipart/form-data; `body` is ignored when present. */
  form?: FormData;
  signal?: AbortSignal;
  query?: QueryParams;
};

export function buildUrl(path: string, query?: QueryParams): URL {
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

/**
 * Responses are parsed with the same Zod schemas the dashboard writes with, so
 * a backend that drifts from the shared model fails loudly here rather than
 * halfway down a render tree.
 */
export async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const url = buildUrl(path, options.query);
  const isForm = options.form !== undefined;

  const response = await fetch(url, {
    method: options.method ?? (isForm ? 'POST' : 'GET'),
    headers: {
      ...authHeader(),
      // Never set Content-Type for FormData — the browser must add the boundary.
      ...(options.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
    },
    body: isForm ? options.form : options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new ApiError(
      describeError(body, `${options.method ?? 'GET'} ${path} failed with ${response.status}`),
      response.status,
      body,
    );
  }

  if (response.status === 204) return schema.parse(undefined);

  const json = await response.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError(
      `${path} returned a payload that does not match the shared schema`,
      response.status,
      parsed.error.issues,
    );
  }
  return parsed.data;
}

/**
 * Calls an enveloped endpoint and returns the payload plus its pagination.
 * `data` is validated with `schema`; the envelope itself is stripped here so no
 * screen ever has to know it exists.
 */
export async function requestData<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<{ data: T; pagination: Pagination | null }> {
  const envelope = await request(
    path,
    z.object({
      success: z.boolean().optional(),
      message: z.string().nullable().optional(),
      data: z.unknown(),
      pagination: paginationSchema.nullable().optional(),
    }),
    options,
  );

  const parsed = schema.safeParse(envelope.data);
  if (!parsed.success) {
    throw new ApiError(
      `${path} returned a data payload that does not match the shared schema`,
      200,
      parsed.error.issues,
    );
  }

  return { data: parsed.data, pagination: envelope.pagination ?? null };
}

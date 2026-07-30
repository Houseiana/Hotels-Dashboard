import type { z } from 'zod';

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

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined>;
};

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
  const url = new URL(`${API_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    credentials: 'include',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new ApiError(`${options.method ?? 'GET'} ${path} failed`, response.status, body);
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

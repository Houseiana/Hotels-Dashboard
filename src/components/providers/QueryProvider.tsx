'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api/config';

/**
 * Retrying only helps a request that might succeed next time. A rejected token
 * or a missing record will fail identically however many times it is asked, and
 * retrying a 401 turns one dead session into a burst of failed calls.
 */
function retryUnlessHopeless(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status)) return false;
  return failureCount < 1;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // One client per browser session — created in state so React Strict Mode's
  // double render doesn't hand two components two different caches.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: {
            retry: false,
          },
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            retry: retryUnlessHopeless,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

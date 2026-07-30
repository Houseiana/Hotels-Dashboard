'use client';

import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { QueryProvider } from './QueryProvider';
import { ThemeProvider } from './ThemeProvider';
import { ToastProvider } from './ToastProvider';
import { HotelScopeProvider } from './HotelScopeProvider';

export function AppProviders({
  locale,
  messages,
  children,
}: {
  locale: string;
  messages: Record<string, unknown>;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Qatar">
      <ThemeProvider>
        <QueryProvider>
          <ToastProvider>
            {/* Hotel scope needs the query cache, so it sits inside the client. */}
            <HotelScopeProvider>{children}</HotelScopeProvider>
          </ToastProvider>
        </QueryProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}

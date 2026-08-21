import type { Metadata } from 'next';
import { Readex_Pro } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { dirOf, routing } from '@/i18n/routing';
import { AppProviders } from '@/components/providers/AppProviders';
import { themeScript } from '@/components/providers/ThemeProvider';
import '../globals.css';

/**
 * Readex Pro is the brand face. It ships Latin *and* Arabic in one variable
 * family, so both locales render in the same typeface instead of the Arabic
 * side falling back to a system font.
 */
const readexPro = Readex_Pro({
  subsets: ['latin', 'arabic'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-readex',
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });
  return {
    title: t('title'),
    description: t('description'),
    // The monogram from /public is the single source for every icon slot, so
    // there is no second copy of the mark to keep in sync.
    icons: {
      icon: [{ url: '/logo.png', type: 'image/png' }],
      shortcut: '/logo.png',
      apple: '/logo.png',
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={readexPro.variable}
      suppressHydrationWarning
    >
      <head>
        {/* Resolves data-theme before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh bg-bg text-ink antialiased">
        <AppProviders locale={locale} messages={messages as Record<string, unknown>}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}

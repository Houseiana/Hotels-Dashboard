import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { PricingView } from '@/components/pricing/PricingView';

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <PricingView />
    </Suspense>
  );
}

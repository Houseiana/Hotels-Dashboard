import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { WizardPage } from '@/components/wizard/WizardPage';

export default async function NewHotelPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <WizardPage />
    </Suspense>
  );
}

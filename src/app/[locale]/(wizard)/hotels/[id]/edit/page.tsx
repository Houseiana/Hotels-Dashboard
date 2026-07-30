import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { WizardPage } from '@/components/wizard/WizardPage';

export default async function EditHotelPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <Suspense>
      <WizardPage hotelId={id} />
    </Suspense>
  );
}

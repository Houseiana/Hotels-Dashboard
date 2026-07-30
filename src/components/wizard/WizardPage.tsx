'use client';

import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { Button, EmptyState, Skeleton } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { useHotel, useSettings } from '@/lib/query/hooks';
import { WIZARD_STEPS, type WizardStep } from '@/lib/schemas/draft';
import { WizardProvider } from './WizardProvider';
import { HotelWizard } from './HotelWizard';

function WizardSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="border-b border-line bg-surface px-6 py-3">
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="border-b border-line bg-surface px-6 pt-4">
        <div className="mx-auto max-w-wizard pb-4">
          <Skeleton className="h-7 w-64" />
        </div>
        <div className="mx-auto flex max-w-wizard gap-2 pb-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 flex-1" />
          ))}
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-wizard flex-col gap-4 px-6 py-8">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

/**
 * One component drives both /hotels/new and /hotels/[id]/edit — the only
 * difference is whether an existing hotel is hydrated into the draft.
 */
export function WizardPage({ hotelId }: { hotelId?: string }) {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useSearchParams();

  const hotel = useHotel(hotelId);
  const settings = useSettings();

  const requestedStep = params.get('step');
  const initialStep = WIZARD_STEPS.includes(requestedStep as WizardStep)
    ? (requestedStep as WizardStep)
    : undefined;

  if (hotelId && hotel.isPending) return <WizardSkeleton />;
  if (hotelId && hotel.isError) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <EmptyState
          icon={<AlertCircle className="size-5" />}
          title={t('notFoundTitle')}
          body={t('hotelNotFound')}
          action={<Button onClick={() => router.push('/hotels')}>{tCommon('back')}</Button>}
        />
      </div>
    );
  }
  if (!hotelId && settings.isPending) return <WizardSkeleton />;

  return (
    <WizardProvider
      hotel={hotelId ? hotel.data : undefined}
      defaultCurrency={settings.data?.account.defaultCurrency}
      initialStep={initialStep}
    >
      <HotelWizard />
    </WizardProvider>
  );
}

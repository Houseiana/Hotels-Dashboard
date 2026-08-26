'use client';

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { Button, EmptyState, Skeleton } from '@/components/ui/primitives';
import { useRouter } from '@/i18n/navigation';
import { useHotelDetail, useSettings } from '@/lib/query/hooks';
import { useCurrencyLookup, useLookup } from '@/lib/query/lookups';
import { detailToDraft } from '@/lib/api/hotelLoad';
import { WIZARD_STEPS, type WizardStep } from '@/lib/schemas/draft';
import { DEFAULT_CURRENCY } from '@/lib/catalogs';
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
 * difference is whether an existing hotel is loaded into the draft.
 */
export function WizardPage({ hotelId }: { hotelId?: string }) {
  const t = useTranslations('errors');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useSearchParams();

  const detail = useHotelDetail(hotelId);
  const settings = useSettings();

  // Turning the API's record back into a draft needs the same vocabularies the
  // submit direction uses — the API answers in display names, not slugs.
  const amenities = useLookup('amenities');
  // Rooms have their own amenity vocabulary, and board/category/view are read
  // back as names that only these lists can turn into a value we can write.
  // Passing a partial bundle here silently emptied every one of those fields.
  const roomAmenities = useLookup('roomAmenities');
  const roomCategory = useLookup('roomCategory');
  const viewType = useLookup('viewType');
  const boardBasis = useLookup('boardBasis');
  const bedType = useLookup('bedType');
  const currencies = useCurrencyLookup();

  const requestedStep = params.get('step');
  const initialStep = WIZARD_STEPS.includes(requestedStep as WizardStep)
    ? (requestedStep as WizardStep)
    : undefined;

  const currency = settings.data?.account.defaultCurrency ?? DEFAULT_CURRENCY;

  const draft = useMemo(() => {
    if (!detail.data) return undefined;
    // City and country names now come with the hotel record, so the extra
    // lookup this used to need is gone.
    return detailToDraft(
      detail.data,
      {
        amenities: amenities.data,
        roomAmenities: roomAmenities.data,
        roomCategory: roomCategory.data,
        viewType: viewType.data,
        boardBasis: boardBasis.data,
        bedType: bedType.data,
        currencies: currencies.data,
      },
      currency,
    );
  }, [
    detail.data,
    amenities.data,
    roomAmenities.data,
    roomCategory.data,
    viewType.data,
    boardBasis.data,
    bedType.data,
    currencies.data,
    currency,
  ]);

  // The draft is built ONCE, when the provider mounts. Building it before the
  // vocabularies arrive would resolve every amenity and bed to nothing and
  // freeze that emptiness into the wizard — so an edit waits for them too.
  //
  // `isLoading`, not `isPending`: a query that is disabled reports "pending"
  // forever, which used to leave a hotel that failed to load showing a skeleton
  // that never resolved.
  const lookupsPending =
    amenities.isLoading ||
    roomAmenities.isLoading ||
    roomCategory.isLoading ||
    viewType.isLoading ||
    boardBasis.isLoading ||
    bedType.isLoading ||
    currencies.isLoading;

  // Check the failure first, or the skeleton wins and the screen stays blank.
  if (hotelId && detail.isError) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <EmptyState
          icon={<AlertCircle className="size-5" />}
          title={t('notFoundTitle')}
          body={
            detail.error instanceof Error && detail.error.message
              ? detail.error.message
              : t('hotelNotFound')
          }
          action={<Button onClick={() => router.push('/hotels')}>{tCommon('back')}</Button>}
        />
      </div>
    );
  }

  if (hotelId && (detail.isPending || lookupsPending)) return <WizardSkeleton />;

  if (!hotelId && settings.isPending) return <WizardSkeleton />;

  return (
    <WizardProvider
      key={hotelId ?? 'new'}
      initialDraft={draft}
      initialDetail={detail.data}
      defaultCurrency={currency}
      initialStep={initialStep}
    >
      <HotelWizard />
    </WizardProvider>
  );
}

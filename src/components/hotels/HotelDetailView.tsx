'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  BedDouble,
  CalendarRange,
  MapPin,
  Pencil,
  Power,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  EmptyState,
  Skeleton,
  Stars,
  SubHeading,
} from '@/components/ui/primitives';
import { ConfirmDialog } from '@/components/ui/overlay';
import { GuestPreviewCard } from './GuestPreviewCard';
import { HotelPoliciesCard } from './HotelPoliciesCard';
import { HotelServicesCard } from './HotelServicesCard';
import { HotelChildrenCard } from './HotelChildrenCard';
import {
  useActivateHotel,
  useDeleteHotelById,
  useHotelDetail,
  useHotelList,
  useRestoreHotel,
} from '@/lib/query/hooks';
import { statusSlug, type HotelStatusSlug } from '@/lib/schemas/hotelApi';
import { useCurrencyLookup, useLookup } from '@/lib/query/lookups';
import { useToast } from '@/components/providers/ToastProvider';
import { useCatalogLabels } from '@/lib/useLabels';
import { detailToDraft } from '@/lib/api/hotelLoad';
import { DEFAULT_CURRENCY } from '@/lib/catalogs';
import { cn, formatMoney, parseBedConfig, photoStyle } from '@/lib/utils';

/** Chip colours for the API's eight states — mirrors the Hotels list. */
const STATUS_TONE: Record<HotelStatusSlug, 'active' | 'draft' | 'danger' | 'info' | 'neutral'> = {
  active: 'active',
  pending: 'info',
  inactive: 'neutral',
  actionRequired: 'draft',
  draft: 'draft',
  suspended: 'danger',
  rejected: 'danger',
  deleted: 'neutral',
};

export function HotelDetailView({ hotelId }: { hotelId: string }) {
  const t = useTranslations('hotels');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('catalog.hotelStatus');
  /**
   * `GET /api/hotels/{id}` carries `isActive`/`isDeleted` but not the hotel's
   * actual status, so a chip built from those two booleans called a Suspended
   * or Rejected hotel "Draft". The list endpoint does return the real status —
   * and it is usually already cached by the Hotels screen.
   */
  const list = useHotelList({ page: 1, limit: 100 });
  const tWizard = useTranslations('wizard');
  const tReview = useTranslations('wizard.review');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const labels = useCatalogLabels();
  const router = useRouter();
  const toast = useToast();

  const detail = useHotelDetail(hotelId);
  const amenities = useLookup('amenities');
  const bedType = useLookup('bedType');
  const currencies = useCurrencyLookup();

  const activate = useActivateHotel();
  const remove = useDeleteHotelById();
  const restore = useRestoreHotel();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reusing the wizard's loader keeps one definition of "what the API means".
  const draft = useMemo(() => {
    if (!detail.data) return undefined;
    return detailToDraft(
      detail.data,
      { amenities: amenities.data, bedType: bedType.data, currencies: currencies.data },
      DEFAULT_CURRENCY,
    );
  }, [detail.data, amenities.data, bedType.data, currencies.data]);

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-[260px]" />
            <Skeleton className="h-40" />
          </div>
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (detail.isError || !detail.data || !draft) {
    return (
      <EmptyState
        title={tErrors('notFoundTitle')}
        body={tErrors('hotelNotFound')}
        action={
          <Button onClick={() => router.push('/hotels')}>{t('backToHotels')}</Button>
        }
      />
    );
  }

  const hotel = detail.data;
  const photos = draft.photos;
  const summary = list.data?.items.find((item) => item.id === hotelId);
  // Only the two states the detail response can prove, when the list is not
  // available; anything else stays unlabelled rather than guessed.
  const status: HotelStatusSlug | undefined = summary
    ? statusSlug(summary.status)
    : hotel.isDeleted
      ? 'deleted'
      : hotel.isActive
        ? 'active'
        : undefined;
  const currency =
    currencies.data?.find((c) => c.id === hotel.roomTypes[0]?.ratePlans[0]?.currencyId)?.code ??
    DEFAULT_CURRENCY;

  /**
   * The cheapest plan — but only across plans priced in the SAME currency as
   * the one this page is labelled with. Taking the minimum across currencies
   * compares numbers that are not comparable and produces a "from" price that
   * means nothing.
   */
  const currencyId = hotel.roomTypes[0]?.ratePlans[0]?.currencyId ?? null;
  const prices = hotel.roomTypes
    .flatMap((rt) => rt.ratePlans)
    .filter((rp) => (rp.currencyId ?? null) === currencyId)
    .map((rp) => rp.basePrice)
    .filter((p): p is number => typeof p === 'number');
  const fromPrice = prices.length ? Math.min(...prices) : undefined;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/hotels"
        className="flex w-fit items-center gap-1.5 text-[12.5px] font-semibold text-muted transition hover:text-ink"
      >
        <ArrowLeft className="flip-rtl size-3.5" />
        {t('backToHotels')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-serif text-[24px] font-semibold tracking-[-.01em] text-ink">
              {hotel.name}
            </h1>
            {/* The list screen shows all eight API statuses; this one used to
                show two, so a Suspended or Rejected hotel read as "Draft". */}
            {status ? (
              <Chip tone={STATUS_TONE[status]} dot>
                {tStatus(status)}
              </Chip>
            ) : null}
          </div>
          {hotel.nameAr ? (
            <p dir="rtl" className="text-start text-[14px] text-muted">
              {hotel.nameAr}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Stars value={hotel.starRating ?? undefined} size={15} />
            <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
              <MapPin className="size-3.5" />
              {[hotel.streetAddress, hotel.area].filter(Boolean).join(', ') || '—'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => router.push(`/hotels/${hotelId}/edit`)}>
            <Pencil className="size-4" />
            {t('actionEdit')}
          </Button>
          <Button onClick={() => router.push(`/pricing?hotel=${hotelId}`)}>
            <CalendarRange className="size-4" />
            {t('actionPricing')}
          </Button>
          {!hotel.isActive && !hotel.isDeleted ? (
            <Button
              variant="primary"
              disabled={activate.isPending}
              onClick={() =>
                activate.mutate(hotelId, {
                  onSuccess: () => toast(t('activatedToast', { name: hotel.name })),
                  onError: () => toast(tCommon('somethingWentWrong'), 'error'),
                })
              }
            >
              <Power className="size-4" />
              {t('activate')}
            </Button>
          ) : null}
          {/* `/delete` toggles, so a deleted hotel gets the opposite button
              rather than a "delete" that would quietly bring it back. */}
          {hotel.isDeleted ? (
            <Button
              variant="primary"
              disabled={restore.isPending}
              onClick={() =>
                restore.mutate(hotelId, {
                  onSuccess: () => toast(t('restoredToast', { name: hotel.name })),
                  onError: () => toast(tCommon('somethingWentWrong'), 'error'),
                })
              }
            >
              <RotateCcw className="size-4" />
              {t('actionRestore')}
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" />
              {tCommon('delete')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden">
            {photos.length === 0 ? (
              <CardBody>
                <p className="text-[13px] text-muted">{t('noPhotos')}</p>
              </CardBody>
            ) : (
              <>
                <div className="h-[280px]" style={photoStyle(photos[0])} />
                {photos.length > 1 ? (
                  <div className="flex gap-2 overflow-x-auto p-3">
                    {photos.slice(1).map((photo, index) => (
                      <span
                        key={`${photo}-${index}`}
                        className="h-16 w-24 shrink-0 rounded-[var(--radius-ctl)] border border-line"
                        style={photoStyle(photo)}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </Card>

          <Card>
            <CardHeader title={t('about')} hint={t('photoCount', { count: photos.length })} />
            <CardBody>
              {hotel.description ? (
                <p className="text-[13.5px] leading-relaxed text-ink">{hotel.description}</p>
              ) : (
                <p className="text-[13px] text-muted">{t('noDescription')}</p>
              )}
              {hotel.descriptionAr ? (
                <p dir="rtl" className="text-start text-[13.5px] leading-relaxed text-muted">
                  {hotel.descriptionAr}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={tWizard('amenities.title')} />
            <CardBody>
              {draft.amenities.length === 0 ? (
                <p className="text-[13px] text-muted">{t('noAmenities')}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {draft.amenities.map((slug) => (
                    <Chip key={slug} tone="neutral">
                      {labels.amenity(slug)}
                    </Chip>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={tWizard('rooms.title')}
              hint={t('roomTypesCount', { count: draft.roomTypes.length })}
            />
            <CardBody>
              {draft.roomTypes.length === 0 ? (
                <p className="text-[13px] text-muted">{t('noRooms')}</p>
              ) : (
                draft.roomTypes.map((room) => (
                  <div
                    key={room.id}
                    className="flex flex-col gap-3 rounded-[var(--radius-ctl)] border border-line p-3.5"
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <BedDouble className="size-4 shrink-0 text-faint" />
                      <span className="text-[14.5px] font-semibold text-ink">{room.name}</span>
                      <Chip tone="neutral" className="px-2 py-0 text-[11px]">
                        {labels.category(room.category)}
                      </Chip>
                      {room.view ? (
                        <span className="text-[12px] text-muted">{labels.view(room.view)}</span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12.5px] text-muted">
                      <span>
                        {tWizard('rooms.units')}:{' '}
                        <b className="text-ink latn">{room.inventory ?? '—'}</b>
                      </span>
                      <span>
                        {tWizard('rooms.capacity')}:{' '}
                        <b className="text-ink latn">{room.capacity ?? '—'}</b>
                      </span>
                      {room.sizeM2 ? (
                        <span className="latn">{tWizard('rooms.sizeM2', { size: room.sizeM2 })}</span>
                      ) : null}
                    </div>

                    {parseBedConfig(room.bedConfig).length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {parseBedConfig(room.bedConfig).map((bed, index) => (
                          <Chip key={`${bed.type}-${index}`} tone="neutral" className="text-[11px]">
                            <span className="latn">{bed.qty}×</span> {labels.bedType(bed.type)}
                          </Chip>
                        ))}
                      </div>
                    ) : null}

                    {room.ratePlans.length ? (
                      <div className="flex flex-col gap-1.5">
                        <SubHeading>{tWizard('rooms.ratePlans')}</SubHeading>
                        {room.ratePlans.map((plan) => (
                          <div
                            key={plan.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-ctl)] bg-surface-2 px-3 py-2 text-[12.5px]"
                          >
                            <span className="font-semibold text-ink">
                              {labels.boardBasis(plan.boardBasis)}
                            </span>
                            <Chip tone={plan.refundable ? 'active' : 'neutral'}>
                              {plan.refundable
                                ? tWizard('rooms.colCancellation')
                                : labels.cancellation('nonRefundable')}
                            </Chip>
                            <span className="font-bold text-ink latn">
                              {formatMoney(
                                typeof plan.pricePerNight === 'number'
                                  ? plan.pricePerNight
                                  : undefined,
                                currency,
                                locale,
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-warn">{tWizard('rooms.noRatePlans')}</p>
                    )}
                  </div>
                ))
              )}
            </CardBody>
          </Card>

          {/* The optional-extras card used to sit here. The backend withdrew
              the whole fees feature — `/api/hotels/{id}/fees`, its edit and
              delete routes, and the HotelFeeType lookup are all gone from the
              spec and answer 404 — so rendering it only produced failed
              requests. `src/lib/api/fees.ts` still holds the client if the
              endpoints come back. */}

          <HotelServicesCard services={hotel.services} currency={currency} />

          {/* House rules come back with the hotel itself, so no extra call. */}
          <HotelPoliciesCard policies={hotel.policies} />

          <HotelChildrenCard policy={hotel.childrenPolicy} currency={currency} />
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-5 lg:self-start">
          <div className="flex flex-col gap-2">
            <SubHeading>{tReview('guestPreview')}</SubHeading>
            <GuestPreviewCard hotel={{ ...draft, currency }} />
          </div>

          <Card>
            <CardHeader title={t('quickFacts')} />
            <CardBody className="gap-2.5">
              {[
                {
                  k: t('checkInOut'),
                  v: `${hotel.checkInTime ?? '—'} / ${hotel.checkOutTime ?? '—'}`,
                },
                { k: t('colRoomTypes'), v: String(draft.roomTypes.length) },
                {
                  k: tWizard('rooms.units'),
                  v: String(draft.roomTypes.reduce((s, r) => s + (r.inventory ?? 0), 0)),
                },
                { k: t('colFrom'), v: formatMoney(fromPrice, currency, locale) },
                {
                  k: t('coordinates'),
                  v:
                    typeof hotel.latitude === 'number' && typeof hotel.longitude === 'number'
                      ? `${hotel.latitude}, ${hotel.longitude}`
                      : '—',
                },
              ].map((row) => (
                <div key={row.k} className="flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] text-muted">{row.k}</span>
                  <span className={cn('text-[13px] font-semibold text-ink latn')}>{row.v}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          remove.mutate(hotelId, {
            onSuccess: () => {
              toast(t('deletedToast', { name: hotel.name }));
              router.push('/hotels');
            },
            onError: () => toast(tCommon('somethingWentWrong'), 'error'),
          });
        }}
        title={t('deleteConfirmTitle', { name: hotel.name })}
        body={t('deleteConfirmBody')}
        confirmLabel={tCommon('delete')}
        busy={remove.isPending}
      />
    </div>
  );
}

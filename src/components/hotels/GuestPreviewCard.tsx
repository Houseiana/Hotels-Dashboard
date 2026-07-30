'use client';

import { useLocale, useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';
import { Stars } from '@/components/ui/primitives';
import { DEFAULT_CURRENCY } from '@/lib/catalogs';
import { useCatalogLabels } from '@/lib/useLabels';
import { cn, formatMoney, photoStyle } from '@/lib/utils';
import type { Hotel } from '@/lib/schemas/hotel';
import type { HotelDraft } from '@/lib/schemas/draft';

/**
 * A faithful stand-in for the guest-app search card. It reads only fields that
 * exist in the shared model, so if it renders correctly the payload is
 * guest-compatible.
 */
export function GuestPreviewCard({
  hotel,
  className,
}: {
  hotel: Hotel | HotelDraft;
  className?: string;
}) {
  const t = useTranslations('wizard.review');
  const tReviews = useTranslations('reviews');
  const labels = useCatalogLabels();
  const locale = useLocale();

  const cover = hotel.coverPhoto || hotel.photos[0];
  const area = [labels.city(hotel.city), labels.country(hotel.country)]
    .filter(Boolean)
    .join(', ');

  const prices = hotel.roomTypes
    .flatMap((rt) => rt.ratePlans.map((rp) => rp.pricePerNight))
    .filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
  const from = prices.length ? Math.min(...prices) : undefined;

  const tags = hotel.amenities.slice(0, 3);
  const extra = Math.max(0, hotel.amenities.length - tags.length);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]',
        className,
      )}
    >
      <div className="relative aspect-[16/10]" style={photoStyle(cover)}>
        {hotel.photos.length > 0 ? (
          <span className="absolute bottom-2.5 end-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white latn">
            1 / {hotel.photos.length}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 px-[15px] py-3.5">
        <Stars value={hotel.starRating as number | undefined} size={13} />
        <p className="font-serif text-[17px] font-semibold tracking-[-.01em] text-ink">
          {hotel.name || t('noReviewsYet')}
        </p>
        <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
          <MapPin className="size-3" />
          {area || '—'}
        </p>

        {tags.length ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((a) => (
              <span
                key={a}
                className="rounded-[6px] border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-muted"
              >
                {labels.amenity(a)}
              </span>
            ))}
            {extra ? (
              <span className="rounded-[6px] border border-line bg-surface-2 px-2 py-0.5 text-[11px] text-muted latn">
                +{extra}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2.5">
          {hotel.rating ? (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
              <span className="rounded-[6px] bg-accent px-1.5 py-0.5 text-[12px] text-on-accent latn">
                {hotel.rating.toFixed(1)}
              </span>
              {tReviews('basedOn', { count: hotel.reviewCount ?? 0 })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
              <span className="rounded-[6px] bg-accent px-1.5 py-0.5 text-[12px] text-on-accent">
                {t('newBadge')}
              </span>
              {t('noReviewsYet')}
            </span>
          )}
          <span className="text-[18px] font-bold tracking-[-.02em] text-ink">
            <span className="me-1 text-[12px] font-medium text-muted">{t('priceFrom')}</span>
            <span className="latn">
              {formatMoney(from, hotel.currency || DEFAULT_CURRENCY, locale)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

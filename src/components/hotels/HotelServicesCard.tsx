'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { HOTEL_SERVICE_NAMES } from '@/lib/api/catalogMap';
import type { HotelService } from '@/lib/schemas/hotelApi';
import { useCatalogLabels } from '@/lib/useLabels';
import { formatMoney } from '@/lib/utils';

/** Display name → our slug, so an Arabic reader gets an Arabic label. */
function slugForName(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const needle = name.trim().toLowerCase();
  return Object.keys(HOTEL_SERVICE_NAMES).find(
    (slug) => HOTEL_SERVICE_NAMES[slug].trim().toLowerCase() === needle,
  );
}

/**
 * The hotel's paid extras, read-only.
 *
 * The API returns each service's display name, so this renders without holding
 * the lookup — the slug table is only consulted to swap in a translation.
 */
export function HotelServicesCard({
  services,
  currency,
}: {
  services: HotelService[];
  currency: string;
}) {
  const t = useTranslations('hotels');
  const locale = useLocale();
  const labels = useCatalogLabels();

  // Dearest first: the headline extras are what a guest asks about.
  const sorted = [...services].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));

  return (
    <Card>
      <CardHeader title={t('services')} />
      <CardBody>
        {sorted.length === 0 ? (
          <p className="text-[13px] text-muted">{t('servicesNone')}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sorted.map((service) => {
              const slug = slugForName(service.name);
              return (
                <div
                  key={service.id}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-ctl)] px-2.5 py-2 odd:bg-surface-2"
                >
                  <span className="text-[13.5px] text-ink">
                    {slug ? labels.hotelService(slug) : (service.name ?? '')}
                  </span>
                  <span className="ms-auto text-[13.5px] font-semibold text-ink latn">
                    {formatMoney(service.price ?? undefined, currency, locale)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bus,
  Landmark,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { Button, Card, CardBody, CardHeader, Chip } from '@/components/ui/primitives';
import { Field, Grid2, Grid3, Select, TextInput } from '@/components/ui/form';
import { CITY_CENTERS, COUNTRIES, COUNTRY_DEFAULT_CURRENCY } from '@/lib/catalogs';
import { useCatalogLabels } from '@/lib/useLabels';
import { useNearbyPlaces } from '@/lib/query/hooks';
import type { NearbyCategory } from '@/lib/schemas/hotel';
import { clamp, cn } from '@/lib/utils';
import { useWizard } from '../WizardProvider';
import { PanelIntro } from './PanelIntro';

/** Degrees of latitude/longitude covered by the map viewport. */
const SPAN = 0.06;

const CATEGORY_ICONS: Record<NearbyCategory, typeof Landmark> = {
  attraction: Landmark,
  restaurant: UtensilsCrossed,
  transit: Bus,
};

export function LocationStep() {
  const t = useTranslations('wizard.location');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const labels = useCatalogLabels();
  const { draft, update, errorsFor } = useWizard();
  const errors = errorsFor('location');
  const mapRef = useRef<HTMLButtonElement>(null);

  const cities = draft.country ? labels.citiesOf(draft.country) : [];

  const center = useMemo(() => {
    if (typeof draft.latitude === 'number' && typeof draft.longitude === 'number') {
      return { lat: draft.latitude, lng: draft.longitude };
    }
    return CITY_CENTERS[draft.city] ?? CITY_CENTERS.doha;
  }, [draft.latitude, draft.longitude, draft.city]);

  const hasPin = typeof draft.latitude === 'number' && typeof draft.longitude === 'number';

  const nearby = useNearbyPlaces(
    hasPin ? draft.latitude : undefined,
    hasPin ? draft.longitude : undefined,
    locale,
  );

  /* `nearby[]` is derived, never typed: whatever the lookup returns for the
     current pin becomes the stored value. */
  const lastApplied = useRef<string>('');
  useEffect(() => {
    if (!nearby.data) return;
    const signature = JSON.stringify(nearby.data);
    if (signature === lastApplied.current) return;
    lastApplied.current = signature;
    update({ nearby: nearby.data });
  }, [nearby.data, update]);

  const dropPin = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fx = (event.clientX - rect.left) / rect.width;
    const fy = (event.clientY - rect.top) / rect.height;
    // Latitude grows upward, longitude rightward — and rightward flips in RTL.
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    const lng = center.lng + ((rtl ? 1 - fx : fx) - 0.5) * SPAN;
    const lat = center.lat - (fy - 0.5) * SPAN;
    update({
      latitude: Number(clamp(lat, -90, 90).toFixed(5)),
      longitude: Number(clamp(lng, -180, 180).toFixed(5)),
    });
  };

  const pinOffset = hasPin
    ? {
        x: clamp((draft.longitude! - center.lng) / SPAN + 0.5, 0.02, 0.98) * 100,
        y: clamp(0.5 - (draft.latitude! - center.lat) / SPAN, 0.02, 0.98) * 100,
      }
    : { x: 50, y: 48 };

  const grouped = (['attraction', 'restaurant', 'transit'] as NearbyCategory[]).map(
    (category) => ({
      category,
      items: (draft.nearby ?? []).filter((p) => p.category === category),
    }),
  );

  return (
    <>
      <PanelIntro title={t('title')} subtitle={t('subtitle')} />

      <Card>
        <CardHeader title={t('cardAddress')} />
        <CardBody>
          <Grid2>
            <Field
              label={t('address')}
              required
              className="sm:col-span-2"
              error={labels.validation(errors['address'])}
              htmlFor="address"
            >
              <TextInput
                id="address"
                value={draft.address}
                onChange={(e) => update({ address: e.target.value })}
                placeholder={t('addressPlaceholder')}
                invalid={Boolean(errors['address'])}
              />
            </Field>
            <Field label={t('buildingNo')} htmlFor="building">
              <TextInput
                id="building"
                value={draft.buildingNo ?? ''}
                onChange={(e) => update({ buildingNo: e.target.value })}
                className="tnum latn"
              />
            </Field>
            <Field label={t('postalCode')} htmlFor="postal">
              <TextInput
                id="postal"
                value={draft.postalCode ?? ''}
                onChange={(e) => update({ postalCode: e.target.value })}
                className="tnum latn"
              />
            </Field>
          </Grid2>

          <Grid3>
            <Field
              label={t('country')}
              required
              error={labels.validation(errors['country'])}
              htmlFor="country"
            >
              <Select
                id="country"
                value={draft.country}
                onChange={(e) => {
                  const country = e.target.value;
                  // Changing country invalidates the city, the pin and the
                  // currency default — reset them together rather than leaving
                  // a Doha pin on an Egyptian address.
                  update({
                    country,
                    city: '',
                    latitude: undefined,
                    longitude: undefined,
                    nearby: [],
                    currency: COUNTRY_DEFAULT_CURRENCY[country] ?? draft.currency,
                  });
                }}
                invalid={Boolean(errors['country'])}
              >
                <option value="">{tCommon('select')}</option>
                {COUNTRIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {labels.country(c.id)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('city')}
              required
              error={labels.validation(errors['city'])}
              htmlFor="city"
            >
              <Select
                id="city"
                value={draft.city}
                disabled={!draft.country}
                onChange={(e) =>
                  update({
                    city: e.target.value,
                    latitude: undefined,
                    longitude: undefined,
                    nearby: [],
                  })
                }
                invalid={Boolean(errors['city'])}
              >
                <option value="">{tCommon('select')}</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {labels.city(city)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('area')} htmlFor="area">
              <TextInput
                id="area"
                value={draft.area ?? ''}
                onChange={(e) => update({ area: e.target.value })}
                placeholder={t('areaPlaceholder')}
              />
            </Field>
          </Grid3>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('cardPin')} hint={t('mapHint')} />
        <CardBody>
          <Field error={labels.validation(errors['latitude'] ?? errors['longitude'])}>
            <button
              ref={mapRef}
              type="button"
              onClick={dropPin}
              aria-label={t('setPin')}
              className={cn(
                'map-grid relative block h-[190px] w-full overflow-hidden rounded-[var(--radius-ctl)] border',
                errors['latitude'] || errors['longitude'] ? 'border-danger/60' : 'border-line',
              )}
            >
              <MapPin
                className="absolute size-7 -translate-x-1/2 -translate-y-full text-accent-ink drop-shadow-[0_2px_3px_rgba(0,0,0,.25)]"
                style={{ insetInlineStart: `${pinOffset.x}%`, top: `${pinOffset.y}%` }}
                fill={hasPin ? 'currentColor' : 'none'}
                strokeWidth={hasPin ? 1 : 2}
              />
              <span className="pointer-events-none absolute bottom-2.5 start-2.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[11.5px] text-muted tnum latn">
                {hasPin ? `${draft.latitude}, ${draft.longitude}` : t('noPin')}
              </span>
              <span className="pointer-events-none absolute top-2.5 end-2.5 rounded-[var(--radius-ctl)] border border-line-strong bg-surface px-2.5 py-1 text-[12px] font-semibold text-ink">
                {hasPin ? t('movePin') : t('setPin')}
              </span>
            </button>
          </Field>
          <p className="text-[11.5px] text-faint">{t('pinHint')}</p>

          <Grid2>
            <Field label={t('latitude')}>
              <TextInput readOnly value={draft.latitude ?? ''} className="tnum latn" />
            </Field>
            <Field label={t('longitude')}>
              <TextInput readOnly value={draft.longitude ?? ''} className="tnum latn" />
            </Field>
          </Grid2>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t('cardNearby')}
          hint={
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5" />
              {t('nearbyAuto')}
            </span>
          }
          action={
            hasPin ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => nearby.refetch()}
                disabled={nearby.isFetching}
              >
                <RefreshCw className={cn('size-3.5', nearby.isFetching && 'animate-spin')} />
                {t('nearbyRefresh')}
              </Button>
            ) : null
          }
        />
        <CardBody>
          <p className="text-[12px] text-faint">{t('nearbyHint')}</p>

          {!hasPin ? (
            <p className="rounded-[var(--radius-ctl)] border border-dashed border-line-strong bg-surface-2 px-4 py-6 text-center text-[13px] text-muted">
              {t('nearbyEmpty')}
            </p>
          ) : nearby.isPending || nearby.isFetching ? (
            <p className="flex items-center justify-center gap-2 rounded-[var(--radius-ctl)] border border-dashed border-line-strong bg-surface-2 px-4 py-6 text-[13px] text-muted">
              <Loader2 className="size-4 animate-spin" />
              {t('nearbyLoading')}
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <Chip tone="accent" className="self-start">
                {t('nearbyCount', { count: draft.nearby?.length ?? 0 })}
              </Chip>
              {grouped.map(({ category, items }) => {
                if (items.length === 0) return null;
                const Icon = CATEGORY_ICONS[category];
                return (
                  <div key={category} className="flex flex-col gap-2">
                    <span className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[.06em] text-faint">
                      <Icon className="size-3.5" />
                      {labels.nearbyCategory(category)}
                    </span>
                    <ul className="flex flex-col divide-y divide-[var(--border)] rounded-[var(--radius-ctl)] border border-line">
                      {items.map((place) => (
                        <li
                          key={`${category}-${place.name}`}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]"
                        >
                          <span className="truncate text-ink">{place.name}</span>
                          <span className="shrink-0 text-[12px] text-faint tnum">
                            {place.distance}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}

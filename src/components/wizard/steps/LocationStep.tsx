'use client';

import { useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { Field, Grid2, Grid3, Select, TextInput } from '@/components/ui/form';
import { CITY_CENTERS } from '@/lib/catalogs';
import { useCatalogLabels } from '@/lib/useLabels';
import { useCities, useLookup, useStates, useVillages } from '@/lib/query/lookups';
import { clamp, cn } from '@/lib/utils';
import { useWizard } from '../WizardProvider';
import { NearbyPlacesCard } from './NearbyPlacesCard';
import { PanelIntro } from './PanelIntro';

/** Degrees of latitude/longitude covered by the map viewport. */
const SPAN = 0.06;

export function LocationStep() {
  const t = useTranslations('wizard.location');
  const tCommon = useTranslations('common');
  const labels = useCatalogLabels();
  const { draft, update, errorsFor } = useWizard();
  const errors = errorsFor('location');
  const mapRef = useRef<HTMLButtonElement>(null);

  /* The location vocabularies are a server-side chain. */
  const countries = useLookup('countries');
  const states = useStates(draft.stateId === undefined ? draft.countryId : draft.countryId);
  const cities = useCities(draft.stateId);
  const villages = useVillages(draft.cityId);

  const center = useMemo(() => {
    if (typeof draft.latitude === 'number' && typeof draft.longitude === 'number') {
      return { lat: draft.latitude, lng: draft.longitude };
    }
    // No per-city coordinates from the API, so the map opens on a sensible
    // default until the owner drops a pin.
    return CITY_CENTERS.cairo;
  }, [draft.latitude, draft.longitude]);

  const hasPin = typeof draft.latitude === 'number' && typeof draft.longitude === 'number';

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

          {/* Country → state → city → village, each list fetched from the
              server once its parent is chosen. The names are stored alongside
              the ids because the shared guest model carries display text. */}
          <Grid3>
            <Field
              label={t('country')}
              required
              error={labels.validation(errors['country'])}
              htmlFor="country"
            >
              <Select
                id="country"
                value={draft.countryId ?? ''}
                onChange={(e) => {
                  const id = Number(e.target.value) || undefined;
                  const item = countries.data?.find((c) => c.id === id);
                  // Everything below the country is now meaningless, and so is
                  // a pin that was dropped in the previous country.
                  update({
                    countryId: id,
                    country: item?.name ?? '',
                    stateId: undefined,
                    cityId: undefined,
                    city: '',
                    villageId: undefined,
                    latitude: undefined,
                    longitude: undefined,
                    nearby: [],
                  });
                }}
                invalid={Boolean(errors['country'])}
              >
                <option value="">{tCommon('select')}</option>
                {(countries.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('state')} htmlFor="state">
              <Select
                id="state"
                value={draft.stateId ?? ''}
                disabled={!draft.countryId || states.isPending}
                onChange={(e) =>
                  update({
                    stateId: Number(e.target.value) || undefined,
                    cityId: undefined,
                    city: '',
                    villageId: undefined,
                  })
                }
              >
                <option value="">{tCommon('select')}</option>
                {(states.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
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
                value={draft.cityId ?? ''}
                disabled={!draft.stateId || cities.isPending}
                onChange={(e) => {
                  const id = Number(e.target.value) || undefined;
                  const item = cities.data?.find((c) => c.id === id);
                  update({
                    cityId: id,
                    city: item?.name ?? '',
                    villageId: undefined,
                    latitude: undefined,
                    longitude: undefined,
                    nearby: [],
                  });
                }}
                invalid={Boolean(errors['city'])}
              >
                <option value="">{tCommon('select')}</option>
                {(cities.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>

            {/* Only offered where the city actually has villages. */}
            {(villages.data?.length ?? 0) > 0 ? (
              <Field label={t('village')} htmlFor="village">
                <Select
                  id="village"
                  value={draft.villageId ?? ''}
                  onChange={(e) => update({ villageId: Number(e.target.value) || undefined })}
                >
                  <option value="">{tCommon('select')}</option>
                  {(villages.data ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}

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

      <NearbyPlacesCard />
    </>
  );
}

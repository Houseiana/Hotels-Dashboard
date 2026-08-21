'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';
import { COUNTRIES } from './catalogs';

/**
 * Resolves the catalogue IDs stored in the model (`freeWifi`, `deluxe`, `QA`…)
 * to display labels. Unknown IDs — e.g. a value added by another client —
 * fall back to the raw ID instead of throwing a missing-message error.
 */
export function useCatalogLabels() {
  const t = useTranslations('catalog');
  const tv = useTranslations('validation');
  const locale = useLocale();

  const label = useCallback(
    (namespace: string, id: string | undefined): string => {
      if (!id) return '';
      const key = `${namespace}.${id}`;
      return t.has(key) ? t(key) : id;
    },
    [t],
  );

  return useMemo(
    () => ({
      locale,
      amenity: (id: string) => label('amenities', id),
      roomAmenity: (id: string) => label('roomAmenities', id),
      amenityGroup: (id: string) => label('amenityGroups', id),
      category: (id: string) => label('categories', id),
      view: (id: string | undefined) => label('views', id),
      bedType: (id: string) => label('bedTypes', id),
      boardBasis: (id: string) => label('boardBasis', id),
      cancellation: (id: string) => label('cancellation', id),
      bookingStatus: (id: string) => label('bookingStatus', id),
      feeType: (id: string) => label('feeTypes', id),
      reviewCategory: (id: string) => label('reviewCategories', id),
      nearbyCategory: (id: string) => label('nearbyCategories', id),
      country: (id: string) => label('countries', id),
      city: (id: string) => label('cities', id),
      currency: (id: string) => label('currencies', id),
      /** Zod issue keys resolve against the `validation` namespace. */
      validation: (key: string | undefined) =>
        key ? (tv.has(key) ? tv(key) : tv('generic')) : undefined,
      citiesOf: (countryId: string) =>
        COUNTRIES.find((c) => c.id === countryId)?.cities ?? [],
    }),
    [label, tv, locale],
  );
}

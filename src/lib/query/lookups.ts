'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  lookupsApi,
  type CurrencyItem,
  type LookupItem,
  type LookupName,
} from '../api/lookups';

/* Server vocabularies barely change; refetching them per navigation is waste. */
const LOOKUP_STALE_TIME = 60 * 60_000;

export const lookupKeys = {
  all: ['lookups'] as const,
  one: (name: LookupName) => [...lookupKeys.all, name] as const,
  states: (countryId: number | undefined) => [...lookupKeys.all, 'states', countryId] as const,
  cities: (stateId: number | undefined) => [...lookupKeys.all, 'cities', stateId] as const,
  villages: (cityId: number | undefined) => [...lookupKeys.all, 'villages', cityId] as const,
};

export function useLookup(name: LookupName): UseQueryResult<LookupItem[]> {
  return useQuery({
    queryKey: lookupKeys.one(name),
    queryFn: () => lookupsApi.get(name),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useCurrencyLookup(): UseQueryResult<CurrencyItem[]> {
  return useQuery({
    queryKey: [...lookupKeys.all, 'currencies'],
    queryFn: () => lookupsApi.currencies(),
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useStates(countryId: number | undefined): UseQueryResult<LookupItem[]> {
  return useQuery({
    queryKey: lookupKeys.states(countryId),
    queryFn: () => lookupsApi.states(countryId as number),
    enabled: countryId !== undefined,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useCities(stateId: number | undefined): UseQueryResult<LookupItem[]> {
  return useQuery({
    queryKey: lookupKeys.cities(stateId),
    queryFn: () => lookupsApi.cities(stateId as number),
    enabled: stateId !== undefined,
    staleTime: LOOKUP_STALE_TIME,
  });
}

export function useVillages(cityId: number | undefined): UseQueryResult<LookupItem[]> {
  return useQuery({
    queryKey: lookupKeys.villages(cityId),
    queryFn: () => lookupsApi.villages(cityId as number),
    enabled: cityId !== undefined,
    staleTime: LOOKUP_STALE_TIME,
  });
}

/**
 * Reads a lookup's server-side English name by id.
 *
 * Only for vocabularies the dashboard has no translation for (locations). For
 * the fixed vocabularies — categories, views, bed types, board bases — go
 * through the bilingual catalogue instead, or the Arabic UI ends up showing
 * English names.
 */
export function useLookupLabels(name: LookupName) {
  const query = useLookup(name);

  const label = useCallback(
    (id: number | undefined): string => {
      if (id === undefined) return '';
      return query.data?.find((entry) => entry.id === id)?.name ?? String(id);
    },
    [query.data],
  );

  return { ...query, label };
}

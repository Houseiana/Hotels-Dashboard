'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { hotelsApi } from '../api/hotels';
import { bookingsApi } from '../api/bookings';
import { pricingApi } from '../api/pricing';
import { settingsApi } from '../api/settings';
import { queryKeys } from './keys';
import type { Hotel, HotelNearbyPlace, HotelReview } from '../schemas/hotel';
import type {
  AvailabilityCalendar,
  Booking,
  BulkRateUpdate,
  DashboardAlert,
  DayInventory,
  OverviewStats,
  Settings,
} from '../schemas/booking';
import { addDays, toISODate } from '../utils';
import { DEFAULT_CURRENCY } from '../catalogs';

/* ---------------------------------------------------------------------------
 * The dashboard's whole data surface. Components never touch fetch, the mock
 * store or the API modules directly — they call these hooks.
 * ------------------------------------------------------------------------- */

/* -- hotels ---------------------------------------------------------------- */

export function useHotels(): UseQueryResult<Hotel[]> {
  return useQuery({
    queryKey: queryKeys.hotels.list(),
    queryFn: () => hotelsApi.list(),
  });
}

export function useHotel(id: string | undefined): UseQueryResult<Hotel> {
  return useQuery({
    queryKey: queryKeys.hotels.detail(id ?? ''),
    queryFn: () => hotelsApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useSaveHotel(): UseMutationResult<Hotel, Error, Hotel> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (hotel: Hotel) => hotelsApi.save(hotel),
    onSuccess: (saved) => {
      client.setQueryData(queryKeys.hotels.detail(saved.id), saved);
      client.invalidateQueries({ queryKey: queryKeys.hotels.list() });
    },
  });
}

export function useSetHotelStatus(): UseMutationResult<
  Hotel,
  Error,
  { id: string; status: Hotel['status'] },
  { previous: Hotel[] | undefined }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => hotelsApi.setStatus(id, status),
    // Publishing should feel instant; the chip flips before the round trip.
    onMutate: async ({ id, status }) => {
      await client.cancelQueries({ queryKey: queryKeys.hotels.list() });
      const previous = client.getQueryData<Hotel[]>(queryKeys.hotels.list());
      client.setQueryData<Hotel[]>(queryKeys.hotels.list(), (list) =>
        list?.map((h) => (h.id === id ? { ...h, status } : h)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        client.setQueryData(queryKeys.hotels.list(), context.previous);
      }
    },
    onSettled: (_data, _error, { id }) => {
      client.invalidateQueries({ queryKey: queryKeys.hotels.list() });
      client.invalidateQueries({ queryKey: queryKeys.hotels.detail(id) });
    },
  });
}

export function useDeleteHotel(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hotelsApi.remove(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.hotels.all });
    },
  });
}

export function useNearbyPlaces(
  latitude: number | undefined,
  longitude: number | undefined,
  locale: string,
): UseQueryResult<HotelNearbyPlace[]> {
  return useQuery({
    queryKey: queryKeys.places.nearby(latitude ?? 0, longitude ?? 0, locale),
    queryFn: () => hotelsApi.nearby(latitude as number, longitude as number, locale),
    enabled: latitude !== undefined && longitude !== undefined,
    // A pin's surroundings don't change during an editing session.
    staleTime: Infinity,
  });
}

/* -- reviews --------------------------------------------------------------- */

export function useReplyToReview(): UseMutationResult<
  HotelReview,
  Error,
  { hotelId: string; reviewId: string; reply: string }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ hotelId, reviewId, reply }) =>
      hotelsApi.replyToReview(hotelId, reviewId, reply),
    onSuccess: (_review, { hotelId }) => {
      client.invalidateQueries({ queryKey: queryKeys.hotels.detail(hotelId) });
      client.invalidateQueries({ queryKey: queryKeys.hotels.list() });
    },
  });
}

/* -- bookings -------------------------------------------------------------- */

export function useBookings(): UseQueryResult<Booking[]> {
  return useQuery({
    queryKey: queryKeys.bookings.list(),
    queryFn: () => bookingsApi.list(),
  });
}

export function useSetBookingStatus(): UseMutationResult<
  Booking,
  Error,
  { id: string; status: Booking['status'] },
  { previous: Booking[] | undefined }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => bookingsApi.setStatus(id, status),
    onMutate: async ({ id, status }) => {
      await client.cancelQueries({ queryKey: queryKeys.bookings.list() });
      const previous = client.getQueryData<Booking[]>(queryKeys.bookings.list());
      client.setQueryData<Booking[]>(queryKeys.bookings.list(), (list) =>
        list?.map((b) => (b.id === id ? { ...b, status } : b)),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        client.setQueryData(queryKeys.bookings.list(), context.previous);
      }
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: queryKeys.bookings.list() });
    },
  });
}

/* -- pricing & availability ------------------------------------------------ */

export function useAvailability(
  hotelId: string | undefined,
  roomTypeId: string | undefined,
  year: number,
  month: number,
): UseQueryResult<AvailabilityCalendar> {
  return useQuery({
    queryKey: queryKeys.pricing.calendar(hotelId ?? '', roomTypeId ?? '', year, month),
    queryFn: () => pricingApi.calendar(hotelId as string, roomTypeId as string, year, month),
    enabled: Boolean(hotelId && roomTypeId),
    placeholderData: (previous) => previous,
  });
}

export function useUpdateDay(): UseMutationResult<
  DayInventory,
  Error,
  { hotelId: string; roomTypeId: string; day: DayInventory }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ hotelId, roomTypeId, day }) => pricingApi.updateDay(hotelId, roomTypeId, day),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.pricing.all });
    },
  });
}

export function useBulkRateUpdate(): UseMutationResult<number, Error, BulkRateUpdate> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (update: BulkRateUpdate) => pricingApi.bulkUpdate(update),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: queryKeys.pricing.all });
    },
  });
}

/* -- settings -------------------------------------------------------------- */

export function useSettings(): UseQueryResult<Settings> {
  return useQuery({
    queryKey: queryKeys.settings.detail(),
    queryFn: () => settingsApi.get(),
  });
}

export function useSaveSettings(): UseMutationResult<Settings, Error, Settings> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (settings: Settings) => settingsApi.save(settings),
    onSuccess: (saved) => {
      client.setQueryData(queryKeys.settings.detail(), saved);
    },
  });
}

/* -- derived: overview ----------------------------------------------------- */

export type OverviewData = {
  stats: OverviewStats;
  recentBookings: Booking[];
  alerts: DashboardAlert[];
};

/**
 * The overview is a projection of data the dashboard already has, so it reads
 * from the same caches instead of adding a third source of truth.
 */
export function useOverview(hotelId?: string): {
  data: OverviewData | undefined;
  isPending: boolean;
  isError: boolean;
} {
  const hotels = useHotels();
  const bookings = useBookings();
  // Needed for the account-wide reporting currency.
  const settings = useSettings();

  const isPending = hotels.isPending || bookings.isPending || settings.isPending;
  const isError = hotels.isError || bookings.isError;

  if (!hotels.data || !bookings.data) {
    return { data: undefined, isPending, isError };
  }

  const scopedHotels = hotelId ? hotels.data.filter((h) => h.id === hotelId) : hotels.data;
  const scopedIds = new Set(scopedHotels.map((h) => h.id));
  const scopedBookings = bookings.data.filter((b) => scopedIds.has(b.hotelId));

  const now = new Date();
  const today = toISODate(now);
  const weekOut = toISODate(addDays(now, 7));
  const monthBack = toISODate(addDays(now, -30));
  const twoMonthsBack = toISODate(addDays(now, -60));

  const live = scopedBookings.filter((b) => b.status !== 'cancelled');

  const upcomingCheckIns = live.filter(
    (b) => b.checkIn >= today && b.checkIn <= weekOut,
  ).length;

  /**
   * Revenue is reported in ONE currency. Scoped to a single hotel that is the
   * hotel's own currency; across all hotels it is the account default.
   *
   * Only bookings already in that currency are summed — there is no FX rate in
   * this app, so adding a QAR total to an EGP total would produce a number that
   * means nothing. Anything excluded is surfaced via `otherCurrencies`.
   */
  const currency =
    scopedHotels.length === 1
      ? scopedHotels[0].currency
      : (settings.data?.account.defaultCurrency ?? DEFAULT_CURRENCY);

  const reportable = live.filter((b) => b.currency === currency);

  const sumRevenue = (from: string, to: string) =>
    reportable
      .filter((b) => b.checkIn >= from && b.checkIn < to)
      .reduce((sum, b) => sum + b.total, 0);

  const revenue = sumRevenue(monthBack, today);
  const previousRevenue = sumRevenue(twoMonthsBack, monthBack);

  const otherCurrencies = [
    ...new Set(live.filter((b) => b.currency !== currency).map((b) => b.currency)),
  ];

  // Occupancy = sold room-nights over sellable room-nights in the window.
  const soldNights = (from: string, to: string) =>
    live
      .filter((b) => b.checkIn >= from && b.checkIn < to)
      .reduce((sum, b) => sum + b.nights, 0);

  const capacityNights =
    scopedHotels
      .filter((h) => h.status === 'active')
      .reduce((sum, h) => sum + h.roomTypes.reduce((s, rt) => s + rt.inventory, 0), 0) * 30;

  const occupancy = capacityNights
    ? Math.min(100, Math.round((soldNights(monthBack, today) / capacityNights) * 100))
    : 0;
  const previousOccupancy = capacityNights
    ? Math.min(100, Math.round((soldNights(twoMonthsBack, monthBack) / capacityNights) * 100))
    : 0;

  const alerts: DashboardAlert[] = [];
  for (const hotel of scopedHotels) {
    if (hotel.status === 'draft') {
      alerts.push({
        id: `draft-${hotel.id}`,
        severity: 'warning',
        messageKey: 'draftHotel',
        params: { name: hotel.name },
        href: `/hotels/${hotel.id}/edit`,
      });
    }
    for (const room of hotel.roomTypes) {
      if (room.ratePlans.length === 0) {
        alerts.push({
          id: `rates-${room.id}`,
          severity: 'danger',
          messageKey: 'missingRatePlans',
          params: { room: room.name, hotel: hotel.name },
          href: `/hotels/${hotel.id}/edit?step=rooms`,
        });
      }
    }
  }

  const unanswered = scopedHotels.reduce(
    (sum, h) => sum + (h.reviews?.filter((r) => !r.ownerReply).length ?? 0),
    0,
  );
  if (unanswered > 0) {
    alerts.push({
      id: 'reviews-unanswered',
      severity: 'info',
      messageKey: 'unansweredReviews',
      params: { count: unanswered },
      href: '/reviews',
    });
  }

  return {
    isPending,
    isError,
    data: {
      stats: {
        activeHotels: scopedHotels.filter((h) => h.status === 'active').length,
        draftHotels: scopedHotels.filter((h) => h.status === 'draft').length,
        upcomingCheckIns,
        occupancyPercent: occupancy,
        revenue,
        revenueCurrency: currency,
        otherCurrencies,
        revenueChangePercent: previousRevenue
          ? Math.round(((revenue - previousRevenue) / previousRevenue) * 100)
          : 0,
        occupancyChangePercent: occupancy - previousOccupancy,
      },
      recentBookings: [...scopedBookings]
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 6),
      alerts: alerts.slice(0, 6),
    },
  };
}

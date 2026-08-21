'use client';

import { useMemo } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { hotelsApi, type HotelListQuery, type HotelListResult } from '../api/hotels';
import { bookingsApi } from '../api/bookings';
import { pricingApi, type BlockInput, type SpecialPriceInput } from '../api/pricing';
import { payoutApi, settingsApi, type PayoutMethodInput } from '../api/settings';
import { overviewApi } from '../api/overview';
import { feesApi, type HotelFeeInput } from '../api/fees';
import { reviewsApi, type ReviewsQuery, type ReviewsResult } from '../api/reviews';
import { useCurrencyLookup } from './lookups';
import { USE_MOCK } from '../api/config';
import { queryKeys } from './keys';
import { BOARD_NAMES, CATEGORY_NAMES } from '../api/catalogMap';
import type { Hotel, HotelNearbyPlace, HotelReview } from '../schemas/hotel';
import {
  bookingStatusSlug,
  BOOKING_STATUS_TONE,
  type BookingStatusSlug,
  type HotelDetail,
  type OverviewBooking,
  type ApiBooking,
  type HotelFee,
  type PayoutMethodRecord,
} from '../schemas/hotelApi';
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

export function useHotels(options: { enabled?: boolean } = {}): UseQueryResult<Hotel[]> {
  return useQuery({
    queryKey: queryKeys.hotels.list(),
    queryFn: () => hotelsApi.list(),
    enabled: options.enabled ?? true,
  });
}

/**
 * The Hotels screen's paged list. Search and status filtering are the server's
 * job here, so the query key carries them — changing a filter is a new fetch,
 * not a client-side re-filter.
 */
export function useHotelList(
  query: HotelListQuery,
  options: { enabled?: boolean } = {},
): UseQueryResult<HotelListResult> {
  return useQuery({
    queryKey: queryKeys.hotels.summary(query),
    queryFn: () => hotelsApi.listSummary(query),
    // Callers gate on the session being restored — a request sent before the
    // token provider is registered goes out unauthenticated and 401s.
    enabled: options.enabled ?? true,
    // Keeps the current page on screen while the next one loads.
    placeholderData: (previous) => previous,
  });
}

/**
 * Creates a hotel and returns its id.
 *
 * The API's create response carries no id, so this looks the hotel back up by
 * name afterwards. A null id means the hotel almost certainly exists — the
 * lookup just could not identify it — so callers should say so rather than
 * report a failure.
 */
export function useCreateHotel(): UseMutationResult<
  string | null,
  Error,
  { form: FormData; managerId: string | undefined; name: string }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ form, managerId, name }) => {
      await hotelsApi.create(form);
      return hotelsApi.findRecentlyCreated(managerId, name);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.hotels.all }),
  });
}

export function useDeleteHotelById(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hotelsApi.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.hotels.all }),
  });
}

export function useActivateHotel(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hotelsApi.activate(id),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.hotels.all }),
  });
}

/** The API's own hotel record — what the edit wizard loads. */
export function useHotelDetail(id: string | undefined): UseQueryResult<HotelDetail> {
  return useQuery({
    queryKey: [...queryKeys.hotels.detail(id ?? ''), 'api'],
    queryFn: () => hotelsApi.detail(id as string),
    enabled: Boolean(id),
  });
}

/** Companion to `useHotelDetail` — see `hotelsApi.placeNamesFor` for why. */
export function useHotelPlaceNames(
  id: string | undefined,
  managerId: string | undefined,
  name: string | undefined,
): UseQueryResult<{ cityName: string | null; countryName: string | null } | null> {
  return useQuery({
    queryKey: [...queryKeys.hotels.detail(id ?? ''), 'places', name ?? ''],
    queryFn: () => hotelsApi.placeNamesFor(id as string, managerId, name as string),
    enabled: Boolean(id && name),
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

/** The API's review page for one hotel; filtering and sorting are server-side. */
export function useHotelReviews(
  query: ReviewsQuery | undefined,
): UseQueryResult<ReviewsResult> {
  return useQuery({
    queryKey: queryKeys.reviews.page(query ?? {}),
    queryFn: () => reviewsApi.list(query as ReviewsQuery),
    enabled: Boolean(query?.hotelId) && !USE_MOCK,
    placeholderData: (previous) => previous,
  });
}

export function useReplyToReview(): UseMutationResult<
  HotelReview | void,
  Error,
  { hotelId: string; reviewId: string; reply: string; isEdit?: boolean }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ hotelId, reviewId, reply, isEdit }) => {
      if (USE_MOCK) return hotelsApi.replyToReview(hotelId, reviewId, reply);
      await reviewsApi.reply(reviewId, reply, Boolean(isEdit));
    },
    onSuccess: (_review, { hotelId }) => {
      client.invalidateQueries({ queryKey: queryKeys.reviews.all });
      client.invalidateQueries({ queryKey: queryKeys.hotels.detail(hotelId) });
      client.invalidateQueries({ queryKey: queryKeys.hotels.list() });
    },
  });
}

/* -- reviews: one shape for both sources ----------------------------------- */

export type ReviewRow = {
  id: string;
  hotelId: string;
  hotelName: string;
  author: string;
  country?: string;
  /** Null when the server sent a review with no score. */
  score: number | null;
  date: string;
  roomType?: string;
  /** The API stores one free-text comment; the mock splits liked/disliked. */
  comment?: string;
  positive?: string;
  negative?: string;
  ownerReply?: string;
};

export type ReviewsScreen = {
  rows: ReviewRow[];
  total: number;
  average: number | null;
  breakdown: Partial<Record<string, number>>;
  totalPages: number;
  /** True when the API path needs a hotel picked and none is. */
  needsHotel: boolean;
};

export type ReviewFilter = 'all' | 'unanswered' | 'answered';
export type ReviewSort = 'newest' | 'highest' | 'lowest';

/** Ids from the ReviewReplyStatus and ReviewSortOption lookups. */
const REPLY_STATUS_ID: Record<ReviewFilter, number | undefined> = {
  all: undefined,
  unanswered: 1,
  answered: 2,
};
const SORT_ID: Record<ReviewSort, number> = { newest: 1, highest: 2, lowest: 3 };

export function useReviewsScreen(
  hotelId: string | undefined,
  filter: ReviewFilter,
  sort: ReviewSort,
  page: number,
): { data: ReviewsScreen | undefined; isPending: boolean; isError: boolean } {
  const api = useHotelReviews(
    hotelId && !USE_MOCK
      ? { hotelId, replyStatusId: REPLY_STATUS_ID[filter], sortId: SORT_ID[sort], page, limit: 20 }
      : undefined,
  );
  const mock = useHotels({ enabled: USE_MOCK });
  // Only for the hotel's name in API mode; the reviews endpoint omits it.
  const summaries = useHotelList({ page: 1, limit: 100 }, { enabled: !USE_MOCK });

  const isPending = USE_MOCK ? mock.isPending : Boolean(hotelId) && api.isPending;
  const isError = USE_MOCK ? mock.isError : api.isError;

  const data = useMemo<ReviewsScreen | undefined>(() => {
    if (USE_MOCK) {
      if (!mock.data) return undefined;
      const scoped = mock.data.filter((h) => !hotelId || h.id === hotelId);
      const rows = scoped.flatMap((hotel) =>
        (hotel.reviews ?? []).map((review) => ({
          id: review.id,
          hotelId: hotel.id,
          hotelName: hotel.name,
          author: review.author,
          country: review.country,
          score: review.score,
          date: review.date,
          roomType: review.roomType,
          positive: review.positive,
          negative: review.negative,
          ownerReply: review.ownerReply,
        })),
      );
      const matched = rows.filter((r) =>
        filter === 'all' ? true : filter === 'answered' ? Boolean(r.ownerReply) : !r.ownerReply,
      );
      matched.sort((a, b) => {
        if (sort === 'highest') return (b.score ?? 0) - (a.score ?? 0);
        if (sort === 'lowest') return (a.score ?? 0) - (b.score ?? 0);
        return a.date < b.date ? 1 : -1;
      });
      const single = scoped.length === 1 ? scoped[0] : undefined;
      return {
        rows: matched,
        total: matched.length,
        average: single?.rating ?? null,
        breakdown: single?.ratingBreakdown ?? {},
        totalPages: 1,
        needsHotel: false,
      };
    }

    // The API path is per hotel and has no "all hotels" equivalent.
    if (!hotelId) {
      return { rows: [], total: 0, average: null, breakdown: {}, totalPages: 0, needsHotel: true };
    }
    if (!api.data) return undefined;

    const hotelName =
      summaries.data?.items.find((h) => h.id === hotelId)?.name ?? '';
    const { summary, reviews } = api.data.page;

    return {
      rows: reviews.map((review, index) => ({
        id: review.id ?? `${hotelId}-${index}`,
        hotelId,
        hotelName,
        author: review.guestName ?? review.guestId ?? '',
        country: review.guestCountry ?? undefined,
        score: review.ratingValue ?? null,
        date: review.createdAt ?? '',
        roomType: review.roomTypeName ?? undefined,
        comment: review.comment ?? undefined,
        ownerReply: review.reply ?? undefined,
      })),
      total: summary.totalReviews,
      average: summary.averageRating ?? null,
      breakdown: {
        cleanliness: summary.cleanliness ?? undefined,
        accuracy: summary.accuracy ?? undefined,
        checkIn: summary.checkIn ?? undefined,
        communication: summary.communication ?? undefined,
        location: summary.location ?? undefined,
        value: summary.value ?? undefined,
      },
      totalPages: api.data.pagination?.totalPages ?? 1,
      needsHotel: false,
    };
  }, [mock.data, api.data, summaries.data, hotelId, filter, sort]);

  return { data, isPending, isError };
}

/* -- bookings -------------------------------------------------------------- */

export function useBookings(options: { enabled?: boolean } = {}): UseQueryResult<Booking[]> {
  return useQuery({
    queryKey: queryKeys.bookings.list(),
    queryFn: () => bookingsApi.list(),
    enabled: options.enabled ?? true,
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

/* -- fees ------------------------------------------------------------------ */

export function useHotelFees(hotelId: string | undefined): UseQueryResult<HotelFee[]> {
  return useQuery({
    queryKey: queryKeys.fees.forHotel(hotelId ?? ''),
    queryFn: () => feesApi.list(hotelId as string),
    enabled: Boolean(hotelId) && !USE_MOCK,
  });
}

/** Create when `feeId` is absent, edit when it is present. */
export function useSaveHotelFee(): UseMutationResult<
  void,
  Error,
  { hotelId: string; feeId?: string; input: HotelFeeInput }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ hotelId, feeId, input }) =>
      feeId ? feesApi.update(feeId, input) : feesApi.create(hotelId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.fees.all }),
  });
}

export function useDeleteHotelFee(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (feeId: string) => feesApi.remove(feeId),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.fees.all }),
  });
}

/* -- bookings: one shape for both sources ---------------------------------- */

export type BookingRow = {
  id: string;
  reference: string;
  hotelId: string;
  hotelName: string;
  roomTypeName: string;
  guestName: string;
  guestEmail?: string;
  guestCountry?: string;
  guests?: number;
  checkIn: string;
  checkOut: string;
  nights?: number;
  /** Null when the server used a state our slug table does not know. */
  status: BookingStatusSlug | Booking['status'] | null;
  /** The server's own wording, used only when `status` is null. */
  statusLabel: string | null;
  tone: 'active' | 'draft' | 'danger' | 'neutral';
  boardBasis?: string;
  total: number | null;
  currency: string;
  createdAt?: string;
  note?: string;
};

export type BookingsScreen = {
  rows: BookingRow[];
  total: number;
  totalPages: number;
  /** True when rows were merged across hotels rather than paged by the server. */
  merged: boolean;
  /** Some hotel has more bookings than the per-hotel slice could carry. */
  truncated: boolean;
  /** How many hotels failed to answer during a merge. */
  failedHotels: number;
  /** The API has no status-change endpoint, so actions are hidden. */
  canChangeStatus: boolean;
};

export type BookingFilters = {
  search?: string;
  statusId?: number;
  fromDate?: string;
  toDate?: string;
};

const BOOKINGS_PAGE_SIZE = 20;

function fromApiBookingRow(booking: ApiBooking, hotelNames: Map<string, string>): BookingRow {
  const statusName = booking.status ?? booking.statusName ?? null;
  const slug = bookingStatusSlug(statusName);
  const hotelId = booking.hotelId ?? '';
  return {
    id: booking.id ?? booking.bookingId ?? booking.reference ?? '',
    reference: booking.reference ?? booking.bookingReference ?? '',
    hotelId,
    hotelName: booking.hotelName ?? hotelNames.get(hotelId) ?? '',
    roomTypeName: booking.roomTypeName ?? '',
    guestName: booking.guestName ?? '',
    guestEmail: booking.guestEmail ?? undefined,
    guestCountry: booking.guestCountry ?? undefined,
    guests: booking.guests ?? undefined,
    checkIn: booking.checkIn ?? '',
    checkOut: booking.checkOut ?? '',
    nights: booking.nights ?? undefined,
    status: slug,
    statusLabel: slug ? null : statusName,
    tone: slug ? BOOKING_STATUS_TONE[slug] : 'neutral',
    boardBasis: booking.boardBasis ?? undefined,
    total: booking.total ?? booking.totalAmount ?? null,
    currency: booking.currencyCode ?? DEFAULT_CURRENCY,
    createdAt: booking.createdAt ?? undefined,
    note: booking.specialRequests ?? undefined,
  };
}

function fromMockBooking(booking: Booking): BookingRow {
  return {
    id: booking.id,
    reference: booking.reference,
    hotelId: booking.hotelId,
    hotelName: booking.hotelName,
    roomTypeName: booking.roomTypeName,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    guestCountry: booking.guestCountry,
    guests: booking.guests,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    nights: booking.nights,
    status: booking.status,
    statusLabel: null,
    tone:
      booking.status === 'cancelled'
        ? 'danger'
        : booking.status === 'pending'
          ? 'draft'
          : 'active',
    boardBasis: booking.boardBasis,
    total: booking.total,
    currency: booking.currency,
    createdAt: booking.createdAt,
    note: booking.note,
  };
}

/**
 * The Bookings screen's data.
 *
 * With a hotel selected the server does the filtering and paging. With "all
 * hotels" there is no such endpoint, so each hotel is asked separately and the
 * results are merged, sorted and paged here — `merged` tells the screen to say
 * so rather than implying server-side ordering.
 */
export function useBookingsScreen(
  hotelId: string | undefined,
  filters: BookingFilters,
  page: number,
  /** False while the hotel scope is still being restored — see HotelScopeProvider. */
  ready = true,
): { data: BookingsScreen | undefined; isPending: boolean; isError: boolean } {
  const list = useHotelList({ page: 1, limit: 100 }, { enabled: !USE_MOCK });
  // A deleted hotel is still in the list (the Hotels screen shows every status)
  // but its bookings endpoint answers 404 "Hotel not found" — so asking for it
  // would only produce console errors and a false failure count.
  const hotelIds = useMemo(
    () =>
      (list.data?.items ?? [])
        .filter((hotel) => hotel.status !== 'Deleted')
        .map((hotel) => hotel.id),
    [list.data],
  );
  const hotelNames = useMemo(
    () => new Map((list.data?.items ?? []).map((hotel) => [hotel.id, hotel.name])),
    [list.data],
  );

  const single = useQuery({
    queryKey: queryKeys.bookings.forHotel(hotelId ?? '', { ...filters, page }),
    queryFn: () =>
      bookingsApi.listForHotel({
        hotelId: hotelId as string,
        ...filters,
        page,
        limit: BOOKINGS_PAGE_SIZE,
      }),
    enabled: ready && !USE_MOCK && Boolean(hotelId),
    placeholderData: (previous) => previous,
  });

  const merged = useQuery({
    queryKey: queryKeys.bookings.forManager(hotelIds, filters),
    queryFn: () => bookingsApi.listForManager(hotelIds, filters),
    enabled: ready && !USE_MOCK && !hotelId && hotelIds.length > 0,
    placeholderData: (previous) => previous,
  });

  const mock = useBookings({ enabled: USE_MOCK });

  const isPending = USE_MOCK
    ? mock.isPending
    : !ready
      ? true
      : hotelId
        ? single.isPending
        : list.isPending || (hotelIds.length > 0 && merged.isPending);
  const isError = USE_MOCK ? mock.isError : hotelId ? single.isError : merged.isError;

  const data = useMemo<BookingsScreen | undefined>(() => {
    if (!ready) return undefined;
    if (USE_MOCK) {
      if (!mock.data) return undefined;
      const rows = mock.data
        .filter((booking) => !hotelId || booking.hotelId === hotelId)
        .map(fromMockBooking);
      return {
        rows,
        total: rows.length,
        totalPages: 1,
        merged: false,
        truncated: false,
        failedHotels: 0,
        canChangeStatus: true,
      };
    }

    if (hotelId) {
      if (!single.data) return undefined;
      return {
        rows: single.data.items.map((booking) => fromApiBookingRow(booking, hotelNames)),
        total: single.data.pagination?.total ?? single.data.items.length,
        totalPages: single.data.pagination?.totalPages ?? 1,
        merged: false,
        truncated: false,
        failedHotels: 0,
        canChangeStatus: false,
      };
    }

    if (hotelIds.length === 0) {
      return {
        rows: [],
        total: 0,
        totalPages: 0,
        merged: false,
        truncated: false,
        failedHotels: 0,
        canChangeStatus: false,
      };
    }
    if (!merged.data) return undefined;

    const all = merged.data.items
      .map((booking) => fromApiBookingRow(booking, hotelNames))
      // Newest first, by booking date where present and check-in otherwise.
      .sort((a, b) => (a.createdAt ?? a.checkIn) < (b.createdAt ?? b.checkIn) ? 1 : -1);

    const start = (page - 1) * BOOKINGS_PAGE_SIZE;
    return {
      rows: all.slice(start, start + BOOKINGS_PAGE_SIZE),
      total: all.length,
      totalPages: Math.max(1, Math.ceil(all.length / BOOKINGS_PAGE_SIZE)),
      merged: true,
      truncated: merged.data.truncated,
      failedHotels: merged.data.failedHotels,
      canChangeStatus: false,
    };
  }, [ready, mock.data, single.data, merged.data, hotelId, hotelIds.length, hotelNames, page]);

  return { data, isPending, isError };
}

/* -- pricing & availability ------------------------------------------------ */

export function useAvailability(
  hotelId: string | undefined,
  roomTypeId: string | undefined,
  year: number,
  month: number,
  ratePlanId?: string,
  fallbackCurrency?: string,
): UseQueryResult<AvailabilityCalendar> {
  return useQuery({
    queryKey: queryKeys.pricing.calendar(hotelId ?? '', roomTypeId ?? '', year, month, ratePlanId),
    queryFn: () =>
      pricingApi.calendar(
        hotelId as string,
        roomTypeId as string,
        year,
        month,
        ratePlanId,
        fallbackCurrency,
      ),
    enabled: Boolean(hotelId && roomTypeId),
    placeholderData: (previous) => previous,
  });
}

/* -- pricing writes -------------------------------------------------------- */

export function useSetSpecialPrice(): UseMutationResult<void, Error, SpecialPriceInput> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SpecialPriceInput) => pricingApi.setSpecialPrice(input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.pricing.all }),
  });
}

export function useClearSpecialPrice(): UseMutationResult<
  void,
  Error,
  { ratePlanId: string; fromDate: string; toDate: string }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ ratePlanId, fromDate, toDate }) =>
      pricingApi.clearSpecialPrice(ratePlanId, fromDate, toDate),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.pricing.all }),
  });
}

export function useBlockInventory(): UseMutationResult<void, Error, BlockInput> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: BlockInput) => pricingApi.block(input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.pricing.all }),
  });
}

/* -- room types for the pricing screen ------------------------------------- */

/** Display name → our catalogue slug, tolerating case and spacing. */
function slugForName(
  value: string | null | undefined,
  names: Readonly<Record<string, string>>,
): string | undefined {
  if (!value) return undefined;
  const needle = value.trim().toLowerCase();
  return Object.keys(names).find((slug) => names[slug].trim().toLowerCase() === needle);
}


export type PricingRoomType = {
  id: string;
  name: string;
  /** Catalogue slug in mock mode, display name from the API — label as given. */
  categoryLabel: string;
  inventory: number;
  ratePlans: Array<{ id: string; label: string }>;
};

/**
 * The pricing screen needs a hotel's room types AND their rate plans. The
 * summary list carries neither, so this reads the hotel record — the full mock
 * model in mock mode, the API's detail response otherwise.
 */
export function usePricingRoomTypes(hotelId: string | undefined): {
  roomTypes: PricingRoomType[];
  currency: string | undefined;
  isPending: boolean;
} {
  const detail = useHotelDetail(!USE_MOCK ? hotelId : undefined);
  const mockHotels = useHotels({ enabled: USE_MOCK });

  const roomTypes = useMemo<PricingRoomType[]>(() => {
    if (USE_MOCK) {
      const hotel = mockHotels.data?.find((h) => h.id === hotelId);
      return (hotel?.roomTypes ?? []).map((room) => ({
        id: room.id,
        name: room.name,
        categoryLabel: room.category,
        inventory: room.inventory,
        ratePlans: room.ratePlans.map((plan) => ({ id: plan.id, label: plan.boardBasis })),
      }));
    }
    // The API answers with display NAMES ("Standard", "Room Only"). Turning
    // them back into slugs is what lets the Arabic UI label them; a name with
    // no slug is passed through and rendered as the server wrote it.
    return (detail.data?.roomTypes ?? []).map((room) => ({
      id: room.id,
      name: room.name,
      categoryLabel: slugForName(room.roomCategory, CATEGORY_NAMES) ?? room.roomCategory ?? '',
      inventory: room.totalUnits ?? 0,
      ratePlans: room.ratePlans.map((plan) => ({
        id: plan.id,
        label: slugForName(plan.boardBasis, BOARD_NAMES) ?? plan.boardBasis ?? '',
      })),
    }));
  }, [detail.data, mockHotels.data, hotelId]);

  return {
    roomTypes,
    currency: USE_MOCK
      ? mockHotels.data?.find((h) => h.id === hotelId)?.currency
      : undefined,
    isPending: USE_MOCK ? mockHotels.isPending : Boolean(hotelId) && detail.isPending,
  };
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
  // The account endpoint takes a currency ID; the dashboard speaks codes.
  const currencies = useCurrencyLookup();
  return useMutation({
    mutationFn: (settings: Settings) =>
      settingsApi.save(
        settings,
        currencies.data?.find((c) => c.code === settings.account.defaultCurrency)?.id,
      ),
    onSuccess: (saved) => {
      client.setQueryData(queryKeys.settings.detail(), saved);
    },
  });
}

/* -- payout methods -------------------------------------------------------- */

export function usePayoutMethods(): UseQueryResult<PayoutMethodRecord[]> {
  return useQuery({
    queryKey: [...queryKeys.settings.all, 'payoutMethods'],
    queryFn: () => payoutApi.list(),
    enabled: !USE_MOCK,
  });
}

/** Create, update and delete all refresh the same list. */
export function useSavePayoutMethod(): UseMutationResult<
  void,
  Error,
  { id?: string; input: PayoutMethodInput }
> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => (id ? payoutApi.update(id, input) : payoutApi.create(input)),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.settings.all }),
  });
}

export function useDeletePayoutMethod(): UseMutationResult<void, Error, string> {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => payoutApi.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.settings.all }),
  });
}

/* -- derived: overview ----------------------------------------------------- */

/** One row of the overview's recent-bookings table. */
export type RecentBooking = {
  id: string;
  reference: string;
  guestName: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  /** Null when the server reported a state our slug table does not know. */
  status: BookingStatusSlug | Booking['status'] | null;
  /** The server's own wording, used only when `status` is null. */
  statusLabel: string | null;
  tone: 'active' | 'draft' | 'danger' | 'neutral';
  total: number | null;
  currency: string;
};

export type OverviewData = {
  stats: OverviewStats;
  recentBookings: RecentBooking[];
  alerts: DashboardAlert[];
  /** True when a hotel is selected but the figures are still account-wide. */
  accountWide: boolean;
};

/**
 * The overview is a projection of data the dashboard already has, so it reads
 * from the same caches instead of adding a third source of truth.
 */
/**
 * The mock path: the overview is derived from the hotels and bookings caches.
 * Kept because those caches are the only source when NEXT_PUBLIC_USE_MOCK is on.
 */
function useDerivedOverview(hotelId?: string): {
  data: OverviewData | undefined;
  isPending: boolean;
  isError: boolean;
} {
  const hotels = useHotels({ enabled: USE_MOCK });
  const bookings = useBookings({ enabled: USE_MOCK });
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
        .slice(0, 6)
        .map(toRecentBooking),
      alerts: alerts.slice(0, 6),
      accountWide: false,
    },
  };
}

/** A shared-model booking rendered as an overview row. */
function toRecentBooking(booking: Booking): RecentBooking {
  return {
    id: booking.id,
    reference: booking.reference,
    guestName: booking.guestName,
    roomTypeName: booking.roomTypeName,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    status: booking.status,
    statusLabel: null,
    tone: booking.status === 'cancelled' ? 'danger' : booking.status === 'pending' ? 'draft' : 'active',
    total: booking.total,
    currency: booking.currency,
  };
}

/* -- overview: the real endpoint ------------------------------------------- */

function useApiOverview(hotelId?: string): {
  data: OverviewData | undefined;
  isPending: boolean;
  isError: boolean;
} {
  const overview = useQuery({
    queryKey: [...queryKeys.hotels.all, 'overview'],
    queryFn: () => overviewApi.get(),
    enabled: !USE_MOCK,
  });
  // The endpoint reports numbers only; the alert list still comes from the
  // hotels themselves.
  const list = useHotelList({ page: 1, limit: 100 }, { enabled: !USE_MOCK });

  const isPending = overview.isPending || list.isPending;
  const isError = overview.isError;

  const data = useMemo<OverviewData | undefined>(() => {
    if (!overview.data) return undefined;
    const summaries = list.data?.items ?? [];
    const scoped = hotelId ? summaries.filter((h) => h.id === hotelId) : summaries;

    const alerts: DashboardAlert[] = [];
    for (const hotel of scoped) {
      if (hotel.status === 'Draft') {
        alerts.push({
          id: `draft-${hotel.id}`,
          severity: 'warning',
          messageKey: 'draftHotel',
          params: { name: hotel.name },
          href: `/hotels/${hotel.id}/edit`,
        });
      }
      // No cheapest price means no rate plan anywhere in the hotel.
      if (hotel.fromPrice === null || hotel.fromPrice === undefined) {
        alerts.push({
          id: `rates-${hotel.id}`,
          severity: 'danger',
          messageKey: 'noRatePlans',
          params: { hotel: hotel.name },
          href: `/hotels/${hotel.id}/edit?step=rooms`,
        });
      }
    }

    return {
      stats: {
        activeHotels: overview.data.activeHotels,
        draftHotels: overview.data.draftHotels,
        upcomingCheckIns: overview.data.upcomingCheckIns,
        occupancyPercent: overview.data.occupancyPercent,
        revenue: overview.data.monthRevenue,
        revenueCurrency: overview.data.revenueCurrencyCode || DEFAULT_CURRENCY,
        // The server aggregates revenue itself, so there is no excluded set to
        // report — and no prior period, so no trend.
        otherCurrencies: [],
      },
      recentBookings: overview.data.recentBookings.map(fromApiBooking),
      alerts: alerts.slice(0, 6),
      // The endpoint takes no hotel filter; say so rather than imply otherwise.
      accountWide: Boolean(hotelId),
    };
  }, [overview.data, list.data, hotelId]);

  return { data, isPending, isError };
}

function fromApiBooking(booking: OverviewBooking): RecentBooking {
  const slug = bookingStatusSlug(booking.status);
  return {
    id: booking.id ?? booking.reference ?? crypto.randomUUID(),
    reference: booking.reference ?? '',
    guestName: booking.guestName ?? '',
    roomTypeName: booking.roomTypeName ?? '',
    checkIn: booking.checkIn ?? '',
    checkOut: booking.checkOut ?? '',
    status: slug,
    // A state the slug table has not seen is shown in the server's own words.
    statusLabel: slug ? null : (booking.status ?? null),
    tone: slug ? BOOKING_STATUS_TONE[slug] : 'neutral',
    total: booking.total ?? null,
    currency: booking.currencyCode ?? DEFAULT_CURRENCY,
  };
}

/**
 * Picks the real endpoint or the derived mock projection. Both hooks always
 * run — their queries are gated by `enabled`, so the unused one never fetches.
 */
export function useOverview(hotelId?: string): {
  data: OverviewData | undefined;
  isPending: boolean;
  isError: boolean;
} {
  const api = useApiOverview(hotelId);
  const derived = useDerivedOverview(hotelId);
  return USE_MOCK ? derived : api;
}

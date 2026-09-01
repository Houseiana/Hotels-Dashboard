/** Every cache key in one place, so invalidations can never go stale. */
export const queryKeys = {
  hotels: {
    all: ['hotels'] as const,
    list: () => [...queryKeys.hotels.all, 'list'] as const,
    /** Server-paged summary list — the Hotels screen. */
    summary: (query: Record<string, unknown>) =>
      [...queryKeys.hotels.all, 'summary', query] as const,
    detail: (id: string) => [...queryKeys.hotels.all, 'detail', id] as const,
  },
  fees: {
    all: ['fees'] as const,
    forHotel: (hotelId: string) => [...queryKeys.fees.all, hotelId] as const,
  },
  reviews: {
    all: ['reviews'] as const,
    page: (query: Record<string, unknown>) => [...queryKeys.reviews.all, 'page', query] as const,
  },
  bookings: {
    all: ['bookings'] as const,
    list: () => [...queryKeys.bookings.all, 'list'] as const,
    page: (query: Record<string, unknown>) =>
      [...queryKeys.bookings.all, 'page', query] as const,
    detail: (id: string) => [...queryKeys.bookings.all, 'detail', id] as const,
  },
  pricing: {
    all: ['pricing'] as const,
    calendar: (
      hotelId: string,
      roomTypeId: string,
      year: number,
      month: number,
      ratePlanId?: string,
    ) =>
      [...queryKeys.pricing.all, 'calendar', hotelId, roomTypeId, year, month, ratePlanId ?? ''] as const,
  },
  settings: {
    all: ['settings'] as const,
    detail: () => [...queryKeys.settings.all, 'detail'] as const,
  },
  places: {
    all: ['places'] as const,
    /** A hotel's own nearby places, read back from the API. */
    forHotel: (hotelId: string) => [...queryKeys.places.all, 'hotel', hotelId] as const,
  },
} as const;

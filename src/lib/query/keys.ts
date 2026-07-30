/** Every cache key in one place, so invalidations can never go stale. */
export const queryKeys = {
  hotels: {
    all: ['hotels'] as const,
    list: () => [...queryKeys.hotels.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.hotels.all, 'detail', id] as const,
  },
  bookings: {
    all: ['bookings'] as const,
    list: () => [...queryKeys.bookings.all, 'list'] as const,
  },
  pricing: {
    all: ['pricing'] as const,
    calendar: (hotelId: string, roomTypeId: string, year: number, month: number) =>
      [...queryKeys.pricing.all, 'calendar', hotelId, roomTypeId, year, month] as const,
  },
  settings: {
    all: ['settings'] as const,
    detail: () => [...queryKeys.settings.all, 'detail'] as const,
  },
  places: {
    all: ['places'] as const,
    nearby: (lat: number, lng: number, locale: string) =>
      [...queryKeys.places.all, 'nearby', lat, lng, locale] as const,
  },
} as const;

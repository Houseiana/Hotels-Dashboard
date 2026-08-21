import { z } from 'zod';
import { request } from './config';

/* ---------------------------------------------------------------------------
 * HotelManagementLookup — the server-owned vocabularies.
 *
 * Verified against the live API: every lookup returns a BARE array (no
 * envelope) of `{ id, name }`. Currencies carry `code` and `symbol` too.
 *
 * Two consequences worth knowing:
 *
 * 1. There is no `nameAr` on any lookup — the server speaks English only. The
 *    dashboard therefore keeps its own bilingual labels and keys them by server
 *    id (see src/lib/api/catalogMap.ts), rather than rendering `name` directly.
 *    Rendering `name` would leave the Arabic UI with English categories.
 *
 * 2. The paths carry the `/api` prefix because NEXT_PUBLIC_API_BASE_URL is the
 *    host root, not the `/api` segment.
 * ------------------------------------------------------------------------- */

export const lookupItemSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export type LookupItem = z.infer<typeof lookupItemSchema>;

export const currencyItemSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  symbol: z.string().nullable().optional(),
});

export type CurrencyItem = z.infer<typeof currencyItemSchema>;

const lookupListSchema = z.array(lookupItemSchema);
const currencyListSchema = z.array(currencyItemSchema);

/** Lookups that take no arguments. */
export const LOOKUP_PATHS = {
  roomCategory: '/api/HotelManagementLookup/RoomCategory',
  viewType: '/api/HotelManagementLookup/ViewType',
  bedType: '/api/HotelManagementLookup/BedType',
  boardBasis: '/api/HotelManagementLookup/BoardBasis',
  cancellationPolicyType: '/api/HotelManagementLookup/CancellationPolicyType',
  hotelStatus: '/api/HotelManagementLookup/HotelStatus',
  bookingStatus: '/api/HotelManagementLookup/BookingStatus',
  payoutMethod: '/api/HotelManagementLookup/PayoutMethod',
  reviewReplyStatus: '/api/HotelManagementLookup/ReviewReplyStatus',
  hotelFeeType: '/api/HotelManagementLookup/HotelFeeType',
  reviewSortOption: '/api/HotelManagementLookup/ReviewSortOption',
  amenities: '/api/HotelManagementLookup/Amenities',
  countries: '/api/HotelManagementLookup/Countries',
} as const;

export type LookupName = keyof typeof LOOKUP_PATHS;

export const lookupsApi = {
  get(name: LookupName): Promise<LookupItem[]> {
    return request(LOOKUP_PATHS[name], lookupListSchema);
  },

  /** Currencies have a richer shape than the rest. */
  currencies(): Promise<CurrencyItem[]> {
    return request('/api/HotelManagementLookup/Currencies', currencyListSchema);
  },

  /* Location is a four-level chain: country → state → city → village. */

  states(countryId: number): Promise<LookupItem[]> {
    return request('/api/HotelManagementLookup/States', lookupListSchema, {
      query: { countryId },
    });
  },

  cities(stateId: number): Promise<LookupItem[]> {
    return request('/api/HotelManagementLookup/Cities', lookupListSchema, {
      query: { stateId },
    });
  },

  villages(cityId: number): Promise<LookupItem[]> {
    return request('/api/HotelManagementLookup/Villages', lookupListSchema, {
      query: { cityId },
    });
  },
};

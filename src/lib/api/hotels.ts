import { z } from 'zod';
import type { Hotel, HotelNearbyPlace, HotelReview } from '../schemas/hotel';
import {
  hotelDetailSchema,
  hotelListSchema,
  type HotelDetail,
  type HotelListItem,
} from '../schemas/hotelApi';
import { request, requestData, USE_MOCK, type Pagination } from './config';
import type { RatePlanPayload } from './hotelForms';
import * as mock from '../mock/db';
import { lookupNearbyPlaces } from '../mock/places';

export type HotelListQuery = {
  /**
   * Ignored by the API, which scopes the list to the bearer token. Kept only
   * because the mock store has no token to scope by. Passing it to the real
   * endpoint would fragment the query cache for no gain, so it is dropped
   * below rather than forwarded.
   */
  managerId?: string;
  search?: string;
  statusId?: number;
  page?: number;
  limit?: number;
};

export type HotelListResult = {
  items: HotelListItem[];
  pagination: Pagination | null;
};

/** Derives the API's summary shape from a full mock hotel. */
function toSummary(hotel: Hotel): HotelListItem {
  const prices = hotel.roomTypes.flatMap((rt) => rt.ratePlans.map((rp) => rp.pricePerNight));
  return {
    id: hotel.id,
    name: hotel.name,
    // The mock model only knows draft/active; both are real API states too.
    status: hotel.status === 'active' ? 'Active' : 'Draft',
    starRating: hotel.starRating ?? null,
    coverPhoto: hotel.coverPhoto || null,
    cityName: hotel.city,
    countryName: hotel.country,
    roomTypesCount: hotel.roomTypes.length,
    totalUnits: hotel.roomTypes.reduce((sum, rt) => sum + rt.inventory, 0),
    fromPrice: prices.length ? Math.min(...prices) : null,
    currencyCode: hotel.currency,
  };
}

export const hotelsApi = {
  /**
   * The Hotels screen's list. Search, status filtering and paging all happen
   * server-side; the mock branch reproduces that so the screen behaves the same
   * either way.
   */
  async listSummary(query: HotelListQuery): Promise<HotelListResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (USE_MOCK) {
      const all = (await mock.listHotels()).map(toSummary);
      const needle = query.search?.trim().toLowerCase();
      const filtered = all.filter((h) => {
        if (needle && !`${h.name} ${h.cityName ?? ''}`.toLowerCase().includes(needle)) {
          return false;
        }
        return true;
      });
      const start = (page - 1) * limit;
      return {
        items: filtered.slice(start, start + limit),
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
        },
      };
    }

    const { data, pagination } = await requestData('/api/hotels', hotelListSchema, {
      query: {
        search: query.search || undefined,
        statusId: query.statusId,
        page,
        limit,
      },
    });
    return { items: data, pagination };
  },

  detail(id: string): Promise<HotelDetail> {
    return requestData(`/api/hotels/${id}`, hotelDetailSchema).then((r) => r.data);
  },

  /**
   * Creates a hotel with its room types, beds, rate plans and photos in one
   * multipart request.
   *
   * The API answers `{ success, message }` with NO id, so the caller has to go
   * looking for what it just made — see `findRecentlyCreated`.
   */
  async create(form: FormData): Promise<void> {
    await request('/api/hotels', z.unknown(), { form });
  },

  /**
   * Locates a just-created hotel by name. Needed only because the create
   * response omits the id; delete this the day the API returns one.
   */
  async findRecentlyCreated(managerId: string | undefined, name: string): Promise<string | null> {
    const { items } = await hotelsApi.listSummary({ managerId, search: name, page: 1, limit: 20 });
    const target = name.trim().toLowerCase();
    return items.find((h) => h.name.trim().toLowerCase() === target)?.id ?? null;
  },

  /** Soft-deletes; the row stays in the list with status "Deleted". */
  async remove(id: string): Promise<void> {
    if (USE_MOCK) return mock.deleteHotel(id);
    await request(`/api/hotels/${id}/delete`, z.unknown(), { method: 'POST' });
  },

  /** Toggles the hotel's active flag — the API has no separate publish call. */
  async activate(id: string): Promise<void> {
    if (USE_MOCK) {
      await mock.setHotelStatus(id, 'active');
      return;
    }
    await request(`/api/hotels/${id}/activation`, z.unknown(), { method: 'POST' });
  },

  /**
   * The city and country a hotel sits in, by name.
   *
   * `GET /api/hotels/{id}` returns `cityId` but no names, and there is no
   * lookup that reverses a city id — only countries → states → cities →
   * villages, downward. The LIST endpoint does return `cityName` and
   * `countryName`, so the names are fetched from there. Delete this the day the
   * detail response carries them (see the backend notes in capabilities.ts).
   */
  async placeNamesFor(
    id: string,
    managerId: string | undefined,
    name: string,
  ): Promise<{ cityName: string | null; countryName: string | null } | null> {
    if (USE_MOCK) return null;
    const { items } = await hotelsApi.listSummary({ managerId, search: name, page: 1, limit: 50 });
    const match = items.find((hotel) => hotel.id === id);
    if (!match) return null;
    return { cityName: match.cityName ?? null, countryName: match.countryName ?? null };
  },

  /* -- editing ---------------------------------------------------------------
   * Saving an edited hotel is not one call. The hotel's own fields go to
   * `edit-hotel`, but room types and rate plans each have their own
   * create/edit/delete endpoints, so an edit is a batch. `hotelUpdate.ts` works
   * out which of these to call; this layer just speaks HTTP.
   * ------------------------------------------------------------------------ */

  async editHotel(id: string, form: FormData): Promise<void> {
    await request(`/api/hotels/${id}/edit-hotel`, z.unknown(), { form });
  },

  async createRoomType(hotelId: string, form: FormData): Promise<void> {
    await request(`/api/hotels/${hotelId}/room-types/create`, z.unknown(), { form });
  },

  async editRoomType(roomTypeId: string, form: FormData): Promise<void> {
    await request(`/api/room-types/${roomTypeId}/edit`, z.unknown(), { form });
  },

  async deleteRoomType(roomTypeId: string): Promise<void> {
    await request(`/api/room-types/${roomTypeId}/delete`, z.unknown(), { method: 'POST' });
  },

  /* Rate plans are JSON, not multipart — they carry no files. */

  async createRatePlan(roomTypeId: string, body: RatePlanPayload): Promise<void> {
    await request(`/api/room-types/${roomTypeId}/rate-plans/create`, z.unknown(), {
      method: 'POST',
      body,
    });
  },

  /**
   * Note `boardBasis` is absent from the update DTO — the board a plan sells is
   * fixed once created. Changing it means delete + create, which is what
   * `hotelUpdate.ts` does.
   */
  async editRatePlan(ratePlanId: string, body: Omit<RatePlanPayload, 'boardBasis'>): Promise<void> {
    await request(`/api/rate-plans/${ratePlanId}/edit`, z.unknown(), { method: 'POST', body });
  },

  async deleteRatePlan(ratePlanId: string): Promise<void> {
    await request(`/api/rate-plans/${ratePlanId}/delete`, z.unknown(), { method: 'POST' });
  },

  /* -- NOT YET MIGRATED ------------------------------------------------------
   * These back the wizard, Overview and Reviews, which still speak the shared
   * guest model. They stay on the mock regardless of NEXT_PUBLIC_USE_MOCK so
   * those screens keep working while the Hotels list moves over first — the
   * alternative is firing requests at endpoints whose shape does not match.
   * ------------------------------------------------------------------------ */

  list(): Promise<Hotel[]> {
    return mock.listHotels();
  },

  get(id: string): Promise<Hotel> {
    return mock.getHotel(id);
  },

  save(hotel: Hotel): Promise<Hotel> {
    return mock.saveHotel(hotel);
  },

  setStatus(id: string, status: Hotel['status']): Promise<Hotel> {
    return mock.setHotelStatus(id, status);
  },

  /** Real endpoint: POST /api/hotels/reviews/{reviewId}/reply { reply } */
  replyToReview(hotelId: string, reviewId: string, reply: string): Promise<HotelReview> {
    return mock.replyToReview(hotelId, reviewId, reply);
  },

  /** `nearby[]` is derived from the pin; the API has no equivalent — see API_SUPPORTS. */
  nearby(latitude: number, longitude: number, locale: string): Promise<HotelNearbyPlace[]> {
    return lookupNearbyPlaces(latitude, longitude, locale);
  },
};

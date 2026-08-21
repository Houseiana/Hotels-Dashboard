import { z } from 'zod';
import type { Booking } from '../schemas/booking';
import { apiBookingSchema, type ApiBooking } from '../schemas/hotelApi';
import { requestData, USE_MOCK, type Pagination } from './config';
import * as mock from '../mock/db';

/* ---------------------------------------------------------------------------
 * `GET /api/hotels/{hotelId}/bookings` and `GET /api/hotels/bookings/{id}`.
 *
 * The API is scoped PER HOTEL. The dashboard's Bookings screen is per manager
 * with an optional hotel filter, so when no hotel is picked this asks each of
 * the manager's hotels in turn and merges the answers.
 *
 * That merge is honest but not free: sorting and paging happen in the browser
 * over the newest `PER_HOTEL_LIMIT` of each hotel, so a manager with many busy
 * hotels sees a recent slice rather than the true global ordering. The screen
 * says so. A single `GET /api/hotels/bookings` on the server would remove the
 * caveat entirely — see the backend notes in capabilities.ts.
 *
 * There is also NO endpoint for changing a booking's status anywhere under
 * HotelManagement, so the screen is read-only against the real API.
 * ------------------------------------------------------------------------- */

/** How many bookings to pull from each hotel when merging across all of them. */
export const PER_HOTEL_LIMIT = 50;

export type BookingsQuery = {
  hotelId: string;
  search?: string;
  statusId?: number;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
};

export type BookingsPage = {
  items: ApiBooking[];
  pagination: Pagination | null;
};

export const bookingsApi = {
  async listForHotel(query: BookingsQuery): Promise<BookingsPage> {
    const { data, pagination } = await requestData(
      `/api/hotels/${query.hotelId}/bookings`,
      z.array(apiBookingSchema),
      {
        query: {
          search: query.search || undefined,
          statusId: query.statusId,
          fromDate: query.fromDate || undefined,
          toDate: query.toDate || undefined,
          page: query.page ?? 1,
          limit: query.limit ?? 20,
        },
      },
    );
    return { items: data, pagination };
  },

  /**
   * Every hotel's bookings in one list. Requests run in parallel; a hotel whose
   * request fails contributes nothing rather than failing the whole screen,
   * and the count of failures is returned so the screen can say so.
   */
  async listForManager(
    hotelIds: string[],
    query: Omit<BookingsQuery, 'hotelId' | 'page' | 'limit'>,
  ): Promise<{ items: ApiBooking[]; failedHotels: number; truncated: boolean }> {
    const results = await Promise.allSettled(
      hotelIds.map((hotelId) =>
        bookingsApi.listForHotel({ ...query, hotelId, page: 1, limit: PER_HOTEL_LIMIT }),
      ),
    );

    const items: ApiBooking[] = [];
    let failedHotels = 0;
    let truncated = false;

    for (const result of results) {
      if (result.status !== 'fulfilled') {
        failedHotels += 1;
        continue;
      }
      items.push(...result.value.items);
      const total = result.value.pagination?.total;
      if (typeof total === 'number' && total > result.value.items.length) truncated = true;
    }

    return { items, failedHotels, truncated };
  },

  /* -- NOT AVAILABLE ---------------------------------------------------------
   * HotelManagement has no booking status endpoint — no confirm, no cancel, no
   * check-in. This stays on the mock so that mode keeps working; the real
   * screen hides the actions rather than offering buttons that cannot work.
   * ------------------------------------------------------------------------ */

  list(): Promise<Booking[]> {
    return mock.listBookings();
  },

  setStatus(id: string, status: Booking['status']): Promise<Booking> {
    if (!USE_MOCK) {
      throw new Error('The API has no endpoint for changing a booking status');
    }
    return mock.updateBookingStatus(id, status);
  },
};

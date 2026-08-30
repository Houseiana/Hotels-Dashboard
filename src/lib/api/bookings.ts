import { z } from 'zod';
import type { Booking } from '../schemas/booking';
import { apiBookingSchema, type ApiBooking } from '../schemas/hotelApi';
import { requestData, USE_MOCK, type Pagination } from './config';
import * as mock from '../mock/db';

/* ---------------------------------------------------------------------------
 * `GET /api/hotels/bookings` — every booking across the manager's hotels, with
 * an optional `hotelId` filter.
 *
 * This screen used to fan out one request per hotel and merge the answers in
 * the browser, because the API only spoke per hotel. The backend added this
 * endpoint (and dropped the per-hotel one), so searching, filtering, sorting
 * and paging are all the server's job again — which is the only way paging can
 * actually be correct.
 *
 * Still missing: there is NO endpoint anywhere under HotelManagement for
 * changing a booking's status, so the screen stays read-only.
 * ------------------------------------------------------------------------- */

export type BookingsQuery = {
  /** Omit for every hotel the token can see. */
  hotelId?: string;
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
  async list(query: BookingsQuery): Promise<BookingsPage> {
    const { data, pagination } = await requestData(
      '/api/hotels/bookings',
      z.array(apiBookingSchema),
      {
        query: {
          hotelId: query.hotelId || undefined,
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
   * `GET /api/hotels/bookings/{bookingId}` — the one booking, on its own.
   *
   * The drawer used to render nothing but the row it was opened from, so
   * opening a booking showed exactly what the table already showed. It calls
   * this now and merges the answer over the row.
   *
   * Parsed with the list's own schema: it is `.loose()`, so any field the
   * detail adds survives, and the fields the drawer knows how to render are
   * picked up without guessing at names that have not been observed.
   */
  async get(bookingId: string): Promise<ApiBooking> {
    const { data } = await requestData(
      `/api/hotels/bookings/${bookingId}`,
      apiBookingSchema,
    );
    return data;
  },

  /* -- NOT AVAILABLE ---------------------------------------------------------
   * HotelManagement has no booking status endpoint — no confirm, no cancel, no
   * check-in. This stays on the mock so that mode keeps working; the real
   * screen hides the actions rather than offering buttons that cannot work.
   * ------------------------------------------------------------------------ */

  listMock(): Promise<Booking[]> {
    return mock.listBookings();
  },

  setStatus(id: string, status: Booking['status']): Promise<Booking> {
    if (!USE_MOCK) {
      throw new Error('The API has no endpoint for changing a booking status');
    }
    return mock.updateBookingStatus(id, status);
  },
};

import { z } from 'zod';
import { hotelFeeSchema, type HotelFee } from '../schemas/hotelApi';
import { request, requestData, USE_MOCK } from './config';

/* ---------------------------------------------------------------------------
 * `GET/POST /api/hotels/{hotelId}/fees` and the per-fee edit/delete calls.
 *
 * Optional extras a hotel charges for on top of the room rate — spa, parking,
 * an extra bed. A fee either belongs to the whole hotel or to one room type,
 * decided by whether `roomTypeId` is set.
 *
 * The mock store has no concept of fees, so this is API-only: in mock mode the
 * screen hides the section rather than inventing a second source of truth.
 * ------------------------------------------------------------------------- */

export type HotelFeeInput = {
  /** Integer id from the HotelFeeType lookup. */
  type: number;
  /** Omit for a hotel-wide fee. */
  roomTypeId?: string;
  /** Only meaningful with the "Other" type; the rest are named by the lookup. */
  customName?: string;
  customNameAr?: string;
  price: number;
};

export const feesApi = {
  async list(hotelId: string): Promise<HotelFee[]> {
    if (USE_MOCK) return [];
    const { data } = await requestData(
      `/api/hotels/${hotelId}/fees`,
      z.array(hotelFeeSchema),
    );
    return data;
  },

  async create(hotelId: string, input: HotelFeeInput): Promise<void> {
    await request(`/api/hotels/${hotelId}/fees`, z.unknown(), { method: 'POST', body: input });
  },

  async update(feeId: string, input: HotelFeeInput): Promise<void> {
    await request(`/api/hotels/fees/${feeId}/edit`, z.unknown(), { method: 'POST', body: input });
  },

  async remove(feeId: string): Promise<void> {
    await request(`/api/hotels/fees/${feeId}/delete`, z.unknown(), { method: 'POST' });
  },
};

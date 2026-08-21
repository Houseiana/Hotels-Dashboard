import { z } from 'zod';
import type { AvailabilityCalendar, BulkRateUpdate, DayInventory } from '../schemas/booking';
import { request, requestData, USE_MOCK } from './config';
import * as mock from '../mock/db';

/* ---------------------------------------------------------------------------
 * `GET /api/room-types/{id}/calendar` plus the two write endpoints behind it.
 *
 * Three things about this API shape the screen:
 *
 *  1. Prices live on the RATE PLAN, not the room type. A room type with three
 *     board bases has three prices per night, so the calendar always shows one
 *     chosen plan and `ratePlanId` is part of every price write.
 *  2. Blocking inventory is a different call from pricing, on a different
 *     resource — so "make this night unavailable" and "charge more that night"
 *     are two operations, not one save.
 *  3. There is NO year parameter. The endpoint answers for the current year
 *     whatever month you ask for, so the screen cannot page beyond it; see
 *     `CALENDAR_YEAR`.
 * ------------------------------------------------------------------------- */

/** The only year the calendar endpoint can answer for. */
export const CALENDAR_YEAR = new Date().getFullYear();

const calendarDaySchema = z.object({
  date: z.string(),
  unitsSold: z.number().default(0),
  unitsBlocked: z.number().default(0),
  available: z.number().default(0),
  price: z.number().nullable().optional(),
  isSpecialPrice: z.boolean().default(false),
});

const calendarSchema = z.object({
  roomTypeId: z.string(),
  roomTypeName: z.string().nullable().optional(),
  totalUnits: z.number().default(0),
  year: z.number(),
  month: z.number(),
  summary: z
    .object({
      avgAvailablePerNight: z.number().nullable().optional(),
      occupancyPercent: z.number().nullable().optional(),
      soldOutNights: z.number().nullable().optional(),
      nightsWithBlocks: z.number().nullable().optional(),
      totalNights: z.number().nullable().optional(),
      avgRatePerNight: z.number().nullable().optional(),
      currencyCode: z.string().nullable().optional(),
    })
    .optional(),
  ratePlans: z
    .array(
      z.object({
        ratePlanId: z.string(),
        boardBasis: z.string().nullable().optional(),
        basePrice: z.number().nullable().optional(),
        currencyId: z.number().nullable().optional(),
      }),
    )
    .default([]),
  days: z.array(calendarDaySchema).default([]),
});

export type SpecialPriceInput = {
  ratePlanId: string;
  fromDate: string;
  toDate: string;
  price: number;
};

export type BlockInput = {
  roomTypeId: string;
  from: string;
  to: string;
  /** Zero unblocks the range — the API has no separate unblock call. */
  units: number;
};

export const pricingApi = {
  async calendar(
    hotelId: string,
    roomTypeId: string,
    year: number,
    month: number,
    ratePlanId?: string,
    fallbackCurrency?: string,
  ): Promise<AvailabilityCalendar> {
    if (USE_MOCK) return mock.getAvailability(hotelId, roomTypeId, year, month);

    const { data } = await requestData(
      `/api/room-types/${roomTypeId}/calendar`,
      calendarSchema,
      // `month` is 1-based on the wire; the screen keeps it 0-based like Date.
      { query: { month: month + 1, ratePlanId } },
    );

    return {
      hotelId,
      roomTypeId,
      totalUnits: data.totalUnits,
      currency: data.summary?.currencyCode || fallbackCurrency || 'EGP',
      ratePlans: data.ratePlans.map((plan) => ({
        id: plan.ratePlanId,
        boardBasis: plan.boardBasis ?? undefined,
        basePrice: plan.basePrice ?? undefined,
      })),
      days: data.days.map((day) => ({
        date: day.date,
        price: day.price ?? 0,
        sold: day.unitsSold,
        blocked: day.unitsBlocked,
        isSpecialPrice: day.isSpecialPrice,
      })),
    };
  },

  /** Overrides the rate plan's base price for every night in the range. */
  async setSpecialPrice(input: SpecialPriceInput): Promise<void> {
    await request(`/api/rate-plans/${input.ratePlanId}/special-prices`, z.unknown(), {
      method: 'POST',
      body: { fromDate: input.fromDate, toDate: input.toDate, price: input.price },
    });
  },

  /** Drops the override, so the range falls back to the base price. */
  async clearSpecialPrice(ratePlanId: string, fromDate: string, toDate: string): Promise<void> {
    await request(`/api/rate-plans/${ratePlanId}/special-prices/delete`, z.unknown(), {
      method: 'POST',
      body: { fromDate, toDate },
    });
  },

  async block(input: BlockInput): Promise<void> {
    await request(`/api/room-types/${input.roomTypeId}/inventory/block`, z.unknown(), {
      method: 'POST',
      body: { from: input.from, to: input.to, units: input.units },
    });
  },

  /* -- mock-only ------------------------------------------------------------
   * The mock's day and bulk editors write fields the API has no home for
   * (discounts, closed-for-arrival, minimum stay). They stay on the mock so
   * that mode keeps working; the real screen uses the three calls above.
   * ---------------------------------------------------------------------- */

  updateDay(hotelId: string, roomTypeId: string, day: DayInventory): Promise<DayInventory> {
    return mock.updateDay(hotelId, roomTypeId, day);
  },

  bulkUpdate(update: BulkRateUpdate): Promise<number> {
    return mock.applyBulkUpdate(update);
  },
};

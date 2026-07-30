import { z } from 'zod';
import {
  availabilityCalendarSchema,
  dayInventorySchema,
  type AvailabilityCalendar,
  type BulkRateUpdate,
  type DayInventory,
} from '../schemas/booking';
import { request, USE_MOCK } from './config';
import * as mock from '../mock/db';

export const pricingApi = {
  calendar(
    hotelId: string,
    roomTypeId: string,
    year: number,
    month: number,
  ): Promise<AvailabilityCalendar> {
    if (USE_MOCK) return mock.getAvailability(hotelId, roomTypeId, year, month);
    return request(`/room-types/${roomTypeId}/availability`, availabilityCalendarSchema, {
      // Month is zero-based in JS; the wire format is the human 1–12.
      query: { hotelId, year, month: month + 1 },
    });
  },

  updateDay(hotelId: string, roomTypeId: string, day: DayInventory): Promise<DayInventory> {
    if (USE_MOCK) return mock.updateDay(hotelId, roomTypeId, day);
    return request(`/room-types/${roomTypeId}/availability/${day.date}`, dayInventorySchema, {
      method: 'PUT',
      body: day,
    });
  },

  bulkUpdate(update: BulkRateUpdate): Promise<number> {
    if (USE_MOCK) return mock.applyBulkUpdate(update);
    return request(
      `/room-types/${update.roomTypeId}/availability/bulk`,
      z.object({ updated: z.number() }),
      { method: 'POST', body: update },
    ).then((r) => r.updated);
  },
};

import { z } from 'zod';
import { bookingSchema, type Booking } from '../schemas/booking';
import { request, USE_MOCK } from './config';
import * as mock from '../mock/db';

const bookingListSchema = z.array(bookingSchema);

export const bookingsApi = {
  list(): Promise<Booking[]> {
    return USE_MOCK ? mock.listBookings() : request('/bookings', bookingListSchema);
  },

  setStatus(id: string, status: Booking['status']): Promise<Booking> {
    if (USE_MOCK) return mock.updateBookingStatus(id, status);
    return request(`/bookings/${id}/status`, bookingSchema, {
      method: 'PATCH',
      body: { status },
    });
  },
};

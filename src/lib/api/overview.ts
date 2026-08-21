import { hotelOverviewSchema, type HotelOverview } from '../schemas/hotelApi';
import { requestData, USE_MOCK } from './config';

/* ---------------------------------------------------------------------------
 * `GET /api/hotels/overview`.
 *
 * The KPI tiles used to be derived client-side from the hotels and bookings
 * caches, which meant summing money across currencies and guessing at
 * occupancy. The server computes all of it now, including which currency the
 * revenue figure is in — so the dashboard reports rather than infers.
 *
 * The endpoint is scoped by the bearer token; there is no managerId parameter
 * and no way to ask for one hotel, so the per-hotel view is still derived.
 * ------------------------------------------------------------------------- */

export const overviewApi = {
  async get(): Promise<HotelOverview> {
    if (USE_MOCK) {
      throw new Error('overviewApi.get is API-only; the mock path derives its own overview');
    }
    const { data } = await requestData('/api/hotels/overview', hotelOverviewSchema);
    return data;
  },
};

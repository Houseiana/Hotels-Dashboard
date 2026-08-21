import { USE_MOCK } from './config';

/* ---------------------------------------------------------------------------
 * What the real backend can actually persist.
 *
 * Four fields exist in the shared model (and in the mock backend) but have no
 * home in the Houseiana API's HotelManagement contract yet:
 *
 *   bathrooms        — absent from CreateHotelRoomTypeDto and the room edit form
 *   policies         — the hotel form takes checkInTime/checkOutTime only, so
 *                      childrenPolicy / paymentNote / petsAllowed / smokingAllowed
 *                      have nowhere to go
 *   nearby[]         — no nearby-place endpoint under the HotelManagement tag
 *                      (the one that exists belongs to properties, not hotels)
 *   hotel currency   — currency lives on the rate plan (`currencyId`), not the hotel
 *
 * Rather than show inputs whose values would be silently dropped on save, each
 * is gated here. Against the mock backend they all work; against the real API
 * they are hidden until the endpoint gains the field.
 *
 * When the backend ships one, flip its flag to `true` — that is the only edit
 * needed on the UI side. The wizard, the schemas and the mock data already
 * carry these fields end to end.
 * ------------------------------------------------------------------------- */
export const API_SUPPORTS = {
  /** Per-room-type bathroom count. */
  roomBathrooms: USE_MOCK,
  /** Children policy, payment note, pets and smoking flags. */
  hotelPolicies: USE_MOCK,
  /** Auto-derived nearby places from the map pin. */
  nearbyPlaces: USE_MOCK,
  /** A single currency for the whole hotel rather than per rate plan. */
  hotelLevelCurrency: USE_MOCK,
} as const;

import type { Hotel, HotelReview } from '../schemas/hotel';
import type {
  AvailabilityCalendar,
  Booking,
  BulkRateUpdate,
  DayInventory,
  Settings,
} from '../schemas/booking';
import { buildSeedBookings, SEED_HOTELS, SEED_SETTINGS, seededRandom } from './data';
import { daysInMonth, toISODate } from '../utils';

/* ---------------------------------------------------------------------------
 * In-memory mock backend. Runs only in the browser (every screen fetches from
 * a client component), so the seed data is generated exactly once per session
 * and there is nothing for React to hydrate-mismatch on.
 *
 * Mutations persist to localStorage so an autosaved draft survives a reload.
 * ------------------------------------------------------------------------- */

/**
 * Bump the suffix whenever the seed data changes shape or defaults: an existing
 * browser would otherwise keep serving the old snapshot and the change would
 * look like it never landed. (v3: seed properties and payout moved to EGP.)
 */
const STORAGE_KEY = 'houseiana.mock.v3';

type Store = {
  hotels: Hotel[];
  bookings: Booking[];
  settings: Settings;
  /** roomTypeId -> ISO date -> inventory */
  inventory: Record<string, Record<string, DayInventory>>;
};

let store: Store | null = null;

function freshStore(): Store {
  const hotels = structuredClone(SEED_HOTELS);
  return {
    hotels,
    bookings: buildSeedBookings(hotels, new Date()),
    settings: structuredClone(SEED_SETTINGS),
    inventory: {},
  };
}

function load(): Store {
  if (store) return store;
  if (typeof window === 'undefined') {
    // Defensive: nothing should read the mock store during SSR.
    store = freshStore();
    return store;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Store;
      if (parsed?.hotels?.length) {
        store = parsed;
        return store;
      }
    }
  } catch {
    /* corrupted storage — fall through to a fresh seed */
  }
  store = freshStore();
  persist();
  return store;
}

function persist(): void {
  if (typeof window === 'undefined' || !store) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* quota exceeded — the session still works, it just won't survive reload */
  }
}

export function resetMockStore(): void {
  store = freshStore();
  persist();
}

/** Simulated network latency so loading skeletons are actually exercised. */
const delay = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));

/* -- hotels ---------------------------------------------------------------- */

export async function listHotels(): Promise<Hotel[]> {
  await delay();
  return structuredClone(load().hotels);
}

export async function getHotel(id: string): Promise<Hotel> {
  await delay(160);
  const hotel = load().hotels.find((h) => h.id === id);
  if (!hotel) throw new Error('hotelNotFound');
  return structuredClone(hotel);
}

export async function saveHotel(hotel: Hotel): Promise<Hotel> {
  await delay(280);
  const db = load();
  const index = db.hotels.findIndex((h) => h.id === hotel.id);
  // Guest-authored fields are never writable from the dashboard: preserve
  // whatever the platform already holds instead of trusting the payload.
  const existing = index >= 0 ? db.hotels[index] : undefined;
  const next: Hotel = {
    ...hotel,
    rating: existing?.rating,
    reviewCount: existing?.reviewCount,
    ratingBreakdown: existing?.ratingBreakdown,
    reviews: existing?.reviews,
  };
  if (index >= 0) db.hotels[index] = next;
  else db.hotels.push(next);
  persist();
  return structuredClone(next);
}

export async function deleteHotel(id: string): Promise<void> {
  await delay();
  const db = load();
  db.hotels = db.hotels.filter((h) => h.id !== id);
  persist();
}

export async function setHotelStatus(
  id: string,
  status: Hotel['status'],
): Promise<Hotel> {
  await delay();
  const db = load();
  const hotel = db.hotels.find((h) => h.id === id);
  if (!hotel) throw new Error('hotelNotFound');
  hotel.status = status;
  persist();
  return structuredClone(hotel);
}

/* -- reviews --------------------------------------------------------------- */

export async function replyToReview(
  hotelId: string,
  reviewId: string,
  reply: string,
): Promise<HotelReview> {
  await delay();
  const db = load();
  const hotel = db.hotels.find((h) => h.id === hotelId);
  const review = hotel?.reviews?.find((r) => r.id === reviewId);
  if (!review) throw new Error('notFound');
  review.ownerReply = reply.trim() || undefined;
  persist();
  return structuredClone(review);
}

/* -- bookings -------------------------------------------------------------- */

export async function listBookings(): Promise<Booking[]> {
  await delay();
  return structuredClone(load().bookings);
}

export async function updateBookingStatus(
  id: string,
  status: Booking['status'],
): Promise<Booking> {
  await delay();
  const db = load();
  const booking = db.bookings.find((b) => b.id === id);
  if (!booking) throw new Error('notFound');
  booking.status = status;
  persist();
  return structuredClone(booking);
}

/* -- settings -------------------------------------------------------------- */

export async function getSettings(): Promise<Settings> {
  await delay(140);
  return structuredClone(load().settings);
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  await delay(240);
  const db = load();
  db.settings = structuredClone(settings);
  persist();
  return structuredClone(db.settings);
}

/* -- availability ---------------------------------------------------------- */

function findRoomType(db: Store, hotelId: string, roomTypeId: string) {
  const hotel = db.hotels.find((h) => h.id === hotelId);
  const roomType = hotel?.roomTypes.find((rt) => rt.id === roomTypeId);
  if (!hotel || !roomType) throw new Error('notFound');
  return { hotel, roomType };
}

/**
 * Lazily materialise a month of inventory. The baseline is derived from a seed
 * built out of the room-type id and the month, so the same month always looks
 * the same; owner edits are then layered on top and persisted.
 */
function ensureMonth(
  db: Store,
  hotelId: string,
  roomTypeId: string,
  year: number,
  month: number,
): DayInventory[] {
  const { roomType } = findRoomType(db, hotelId, roomTypeId);
  const bucket = (db.inventory[roomTypeId] ??= {});

  let seed = year * 100 + month;
  for (const char of roomTypeId) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const rand = seededRandom(seed);

  const total = daysInMonth(year, month);
  const days: DayInventory[] = [];

  for (let day = 1; day <= total; day += 1) {
    const date = toISODate(new Date(year, month, day));
    const weekday = new Date(year, month, day).getDay();
    const isWeekend = weekday === 5 || weekday === 6;

    if (!bucket[date]) {
      const demand = rand();
      const sold = Math.min(
        roomType.inventory,
        Math.round(roomType.inventory * (isWeekend ? 0.45 + demand * 0.6 : 0.2 + demand * 0.55)),
      );
      const blocked = rand() < 0.08 ? 1 + Math.floor(rand() * 3) : 0;
      // Weekends carry a modest uplift, matching how the rate would really move.
      const price = Math.round(roomType.pricePerNight * (isWeekend ? 1.15 : 1) * (0.95 + demand * 0.15));
      bucket[date] = {
        date,
        price,
        sold: Math.max(0, sold),
        blocked: Math.min(blocked, Math.max(0, roomType.inventory - sold)),
      };
    }
    days.push(bucket[date]);
  }

  persist();
  return days;
}

export async function getAvailability(
  hotelId: string,
  roomTypeId: string,
  year: number,
  month: number,
): Promise<AvailabilityCalendar> {
  await delay(200);
  const db = load();
  const { hotel, roomType } = findRoomType(db, hotelId, roomTypeId);
  const days = ensureMonth(db, hotelId, roomTypeId, year, month);
  return {
    hotelId,
    roomTypeId,
    totalUnits: roomType.inventory,
    currency: hotel.currency,
    // The mock prices the room type directly, so there is no plan to pick.
    ratePlans: [],
    days: structuredClone(days),
  };
}

export async function updateDay(
  hotelId: string,
  roomTypeId: string,
  day: DayInventory,
): Promise<DayInventory> {
  await delay(180);
  const db = load();
  findRoomType(db, hotelId, roomTypeId);
  const bucket = (db.inventory[roomTypeId] ??= {});
  bucket[day.date] = { ...bucket[day.date], ...day };
  persist();
  return structuredClone(bucket[day.date]);
}

export async function applyBulkUpdate(update: BulkRateUpdate): Promise<number> {
  await delay(320);
  const db = load();
  const { roomType } = findRoomType(db, update.hotelId, update.roomTypeId);
  const bucket = (db.inventory[update.roomTypeId] ??= {});

  const from = new Date(`${update.from}T00:00:00`);
  const to = new Date(`${update.to}T00:00:00`);
  let touched = 0;

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    if (update.weekdays?.length && !update.weekdays.includes(d.getDay())) continue;

    // Materialise the month first so an untouched day keeps its baseline
    // sold/blocked figures instead of resetting to zero.
    ensureMonth(db, update.hotelId, update.roomTypeId, d.getFullYear(), d.getMonth());

    const date = toISODate(d);
    const existing = bucket[date] ?? {
      date,
      price: roomType.pricePerNight,
      sold: 0,
      blocked: 0,
    };

    bucket[date] = {
      ...existing,
      price: update.price ?? existing.price,
      priceWithoutDiscount:
        update.priceWithoutDiscount ?? existing.priceWithoutDiscount,
      discountPercent: update.discountPercent ?? existing.discountPercent,
      blocked: update.blocked ?? existing.blocked,
      closed: update.closed ?? existing.closed,
      minStay: update.minStay ?? existing.minStay,
    };
    touched += 1;
  }

  persist();
  return touched;
}

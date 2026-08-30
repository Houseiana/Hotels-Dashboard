import type { LookupItem } from './lookups';

/* ---------------------------------------------------------------------------
 * Slug ⇄ server id.
 *
 * The dashboard stores readable slugs ('deluxe', 'wifi') because they are what
 * the shared guest model carries; the API speaks integer ids. This is the only
 * place the two vocabularies meet.
 *
 * Resolution goes through the server's NAME, not a hard-coded id: ids are
 * assigned per environment, so matching on name keeps staging and production
 * working from the same build.
 * ------------------------------------------------------------------------- */

type SlugTable = Readonly<Record<string, string>>;

export const CATEGORY_NAMES: SlugTable = {
  standard: 'Standard',
  superior: 'Superior',
  deluxe: 'Deluxe',
  juniorSuite: 'Junior Suite',
  suite: 'Suite',
  executiveSuite: 'Executive Suite',
  presidentialSuite: 'Presidential Suite',
  family: 'Family',
};

export const VIEW_NAMES: SlugTable = {
  sea: 'Sea View',
  city: 'City View',
  garden: 'Garden View',
  pool: 'Pool View',
  mountain: 'Mountain View',
  none: 'None',
};

export const BED_NAMES: SlugTable = {
  king: 'King Bed',
  queen: 'Queen Bed',
  double: 'Double Bed',
  twin: 'Twin Bed',
  sofa: 'Sofa Bed',
  bunk: 'Bunk Bed',
};

export const BOARD_NAMES: SlugTable = {
  roomOnly: 'Room Only',
  breakfast: 'Bed & Breakfast',
  halfBoard: 'Half Board',
  fullBoard: 'Full Board',
  allInclusive: 'All Inclusive',
  ultraAllInclusive: 'Ultra All Inclusive',
};

/**
 * `GET /api/HotelManagementLookup/Amenities` — what the HOTEL offers.
 *
 * The backend replaced the old 39-item short-let list (Swing, Pool Table,
 * Ski-in/Ski-out) with these 17 after we flagged that a hotel could not say it
 * had a restaurant. Room-level amenities are a separate lookup now; see
 * ROOM_AMENITY_NAMES.
 */
export const AMENITY_NAMES: SlugTable = {
  swimmingPool: 'Swimming Pool',
  gym: 'Gym / Fitness Center',
  spa: 'Spa & Wellness Center',
  restaurant: 'Restaurant',
  cafe: 'Café / Coffee Shop',
  freeWifi: 'Free WiFi',
  parking: 'Parking',
  elevator: 'Elevator',
  businessCenter: 'Business Center',
  meetingRooms: 'Meeting & Event Rooms',
  kidsPlayArea: "Kids' Play Area",
  prayerRoom: 'Prayer Room',
  gardenTerrace: 'Garden / Terrace',
  beachAccess: 'Beach Access',
  wheelchairAccessible: 'Wheelchair Accessible',
  barLounge: 'Bar / Lounge',
  banquetHall: 'Banquet / Events Hall',
};

/** `GET /api/HotelManagementLookup/RoomAmenities` — what one ROOM has. */
export const ROOM_AMENITY_NAMES: SlugTable = {
  roomAirConditioning: 'Air Conditioning',
  roomTv: 'TV',
  roomMinibar: 'Minibar',
  roomSafe: 'In-Room Safe',
  roomHairDryer: 'Hair Dryer',
  roomIron: 'Iron & Ironing Board',
  roomCoffeeMaker: 'Coffee / Tea Maker',
  roomRefrigerator: 'Refrigerator',
  roomMicrowave: 'Microwave',
  roomBalcony: 'Balcony',
  roomBathtub: 'Bathtub',
  roomWorkspace: 'Desk / Workspace',
  roomWardrobe: 'Wardrobe / Closet',
  roomBlackoutCurtains: 'Blackout Curtains',
  roomKitchenette: 'Kitchenette',
  roomSeatingArea: 'Sofa / Seating Area',
};

/**
 * The dashboard's four cancellation presets expressed the way the API wants
 * them: a policy type plus a free-cancellation window.
 *
 * The server's own vocabulary is FLEXIBLE / MODERATE / FIXED, which says
 * nothing about how long the free window is — the hours/days fields carry that.
 * "Non-refundable" is FIXED with a zero window.
 */
export const CANCELLATION_RULES: Readonly<
  Record<string, { policyName: string; freeCancellationHours?: number; freeCancellationDays?: number }>
> = {
  free24h: { policyName: 'FLEXIBLE', freeCancellationHours: 24 },
  free48h: { policyName: 'FLEXIBLE', freeCancellationHours: 48 },
  free7d: { policyName: 'MODERATE', freeCancellationDays: 7 },
  nonRefundable: { policyName: 'FIXED', freeCancellationHours: 0 },
};

/* -- resolution ------------------------------------------------------------ */

const normalise = (value: string) => value.trim().toLowerCase();

/** Ignores spacing too: the API writes "Fixed Amount" but reads "FixedAmount". */
export const looseMatch = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, '');

/**
 * A server entry the dashboard has no slug for is carried as "#<id>".
 *
 * This is what lets the lists be genuinely server-driven: the backend can add a
 * room category or bed type tomorrow and it shows up immediately, labelled with
 * the server's own English name until someone translates it — rather than being
 * invisible because our table has never heard of it.
 */
export const UNKNOWN_PREFIX = '#';

export const idSlug = (id: number): string => `${UNKNOWN_PREFIX}${id}`;

export function parseIdSlug(slug: string | undefined): number | undefined {
  if (!slug || !slug.startsWith(UNKNOWN_PREFIX)) return undefined;
  const id = Number(slug.slice(UNKNOWN_PREFIX.length));
  return Number.isFinite(id) ? id : undefined;
}

/** Builds a slug → id lookup from a fetched list. Unknown slugs give undefined. */
export function resolver(
  items: readonly LookupItem[] | undefined,
  names: SlugTable,
): (slug: string | undefined) => number | undefined {
  const list = items ?? [];
  const byName = new Map(list.map((item) => [normalise(item.name), item.id]));
  const ids = new Set(list.map((item) => item.id));
  return (slug) => {
    if (!slug) return undefined;
    const direct = parseIdSlug(slug);
    if (direct !== undefined) return ids.has(direct) ? direct : undefined;
    const name = names[slug];
    return name ? byName.get(normalise(name)) : undefined;
  };
}

/** The reverse direction, for turning an API response back into slugs. */
export function reverseResolver(
  items: readonly LookupItem[] | undefined,
  names: SlugTable,
): (id: number | undefined) => string | undefined {
  const idToName = new Map((items ?? []).map((item) => [item.id, normalise(item.name)]));
  const nameToSlug = new Map(
    Object.entries(names).map(([slug, name]) => [normalise(name), slug]),
  );
  return (id) => {
    if (id === undefined) return undefined;
    const name = idToName.get(id);
    if (name === undefined) return undefined;
    // Keep the value rather than dropping it just because we lack a translation.
    return nameToSlug.get(name) ?? idSlug(id);
  };
}

/**
 * `GET /api/HotelManagementLookup/HotelFeeType`.
 *
 * Optional extras a hotel charges for. "Other" is the escape hatch: pair it
 * with `customName`/`customNameAr` to name a fee this list does not cover.
 */
/**
 * `GET /api/HotelManagementLookup/HotelPolicyTypes`.
 *
 * The hotel's house rules. The server owns the list — this table only maps its
 * names onto slugs we have Arabic for; an entry it adds still renders, in the
 * server's own words.
 */
export const POLICY_TYPE_NAMES: Readonly<Record<string, string>> = {
  petsAllowed: 'Pets Allowed',
  idRequired: 'ID Required at Check-in',
  partiesAllowed: 'Parties / Events Allowed',
  visitorsAllowed: 'Visitors Allowed',
  marriedCouplesOnly: 'Married Couples Only',
};

/**
 * `GET /api/HotelManagementLookup/HotelServices` — extras the HOTEL sells.
 *
 * This is what the withdrawn "fees" feature became, and it is a better fit: a
 * service is something a guest pays for on top of the room, which is a
 * different question from whether the hotel HAS the thing (that is an amenity).
 */
/**
 * `GET /api/HotelManagementLookup/ChildPricingMode` — how a child is charged.
 *
 * The lookup spells these with spaces ("Fixed Amount") but the hotel record
 * reads them back compacted ("FixedAmount"), so matching ignores spacing —
 * see `normalise` below.
 */
export const PRICING_MODE_NAMES: SlugTable = {
  free: 'Free',
  fixedAmount: 'Fixed Amount',
  percentageDiscount: 'Percentage Discount',
  asAdult: 'As Adult',
};

/** The two modes the API rejects a `value` for. */
export const PRICING_MODES_WITHOUT_VALUE = ['free', 'asAdult'] as const;

export const HOTEL_SERVICE_NAMES: SlugTable = {
  airportTransfer: 'Airport Transfer',
  shuttleService: 'Shuttle Service',
  chauffeur: 'Chauffeur / Private Driver',
  valetParking: 'Valet Parking',
  concierge: 'Concierge',
  frontDesk24h: '24-Hour Front Desk',
  luggageStorage: 'Luggage Storage',
  dailyHousekeeping: 'Daily Housekeeping',
  laundry: 'Laundry & Dry Cleaning',
  ironing: 'Ironing Service',
  roomService: 'In-Room Dining (Room Service)',
  earlyCheckIn: 'Early Check-in',
  lateCheckOut: 'Late Check-out',
  babysitting: 'Babysitting / Childcare',
  carRental: 'Car Rental Desk',
  tourDesk: 'Tour & Excursion Desk',
  currencyExchange: 'Currency Exchange',
  safeDeposit: 'Safe Deposit at Reception',
  spaMassage: 'Spa Treatments & Massage',
  wakeUpCall: 'Wake-up Call',
  doctorOnCall: 'Doctor on Call',
};

/** `GET /api/HotelManagementLookup/RoomServices` — extras sold per ROOM. */
export const ROOM_SERVICE_NAMES: SlugTable = {
  extraBed: 'Extra Bed',
  babyCot: 'Baby Cot / Crib',
  turndown: 'Turndown Service',
  butler: 'Butler Service',
  minibarRestock: 'Minibar Restocking',
  welcomeAmenities: 'Welcome Amenities',
  pillowMenu: 'Pillow Menu',
};

/** WITHDRAWN with the fees endpoints on 2026-08-24; kept for reference. */
export const FEE_TYPE_NAMES: Readonly<Record<string, string>> = {
  spa: 'Spa',
  laundry: 'Laundry',
  airportTransfer: 'Airport Transfer',
  parking: 'Parking',
  gym: 'Gym',
  pool: 'Pool',
  lateCheckout: 'Late Checkout',
  earlyCheckIn: 'Early Check-in',
  extraBed: 'Extra Bed',
  babyCot: 'Baby Cot',
  minibar: 'Minibar',
  breakfast: 'Breakfast',
  other: 'Other',
};

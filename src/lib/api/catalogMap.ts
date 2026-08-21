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
};

export const AMENITY_NAMES: SlugTable = {
  wifi: 'WiFi',
  kitchen: 'Kitchen',
  washer: 'Washer',
  dryer: 'Dryer',
  airConditioning: 'Air Conditioning',
  heating: 'Heating',
  workspace: 'Workspace',
  tv: 'TV',
  freeParking: 'Free Parking',
  pool: 'Pool',
  gym: 'Gym',
  hotTub: 'Hot Tub',
  security: 'Security',
  bbqGrill: 'BBQ Grill',
  jacuzzi: 'Jacuzzi',
  privateGarden: 'Private Garden',
  rooftop: 'RoofTop',
  swing: 'Swing',
  iron: 'Iron',
  hairDryer: 'Hair Dryer',
  coffeeMaker: 'Coffee Maker',
  microwave: 'Microwave',
  dishwasher: 'Dishwasher',
  elevator: 'Elevator',
  balcony: 'Balcony',
  fireplace: 'Fireplace',
  securitySystem: 'Security System',
  firePit: 'Fire Pit',
  poolTable: 'Pool Table',
  piano: 'Piano',
  exerciseEquipment: 'Exercise Equipment',
  lakeAccess: 'Lake Access',
  beachAccess: 'Beach Access',
  skiInSkiOut: 'Ski-in/Ski-out',
  outdoorShower: 'Outdoor Shower',
  smokeAlarm: 'Smoke Alarm',
  firstAidKit: 'First Aid Kit',
  fireExtinguisher: 'Fire Extinguisher',
  carbonMonoxideAlarm: 'Carbon Monoxide Alarm',
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

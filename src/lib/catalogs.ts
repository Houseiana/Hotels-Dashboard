import type { BoardBasis } from './schemas/hotel';

/* ---------------------------------------------------------------------------
 * Shared vocabularies. The IDs here are what lands in the model and what the
 * guest app reads — the human labels live in src/messages/{en,ar}.json under
 * `catalog.*`, so both languages are always covered.
 * ------------------------------------------------------------------------- */

/* ---------------------------------------------------------------------------
 * Amenities.
 *
 * The API exposes ONE amenity list (`/api/HotelManagementLookup/Amenities`,
 * 39 entries) and uses it for both the hotel and its room types — so the
 * dashboard has one list too, not the separate hotel/room lists it used to
 * carry. The slugs below mirror the server's names one-for-one; the grouping is
 * ours, purely to keep the chip wall readable.
 *
 * The server names are English-only, so the Arabic labels live in
 * src/messages/*.json under `catalog.amenities`.
 *
 * KNOWN GAP: the list is short-let vocabulary (Swing, Pool Table, Ski-in) and
 * has no hotel services at all — no restaurant, spa, room service, concierge,
 * airport shuttle, 24h reception, laundry, meeting rooms. Those need adding to
 * the lookup before a real hotel can describe itself properly.
 * ------------------------------------------------------------------------- */

export const AMENITY_GROUPS = [
  {
    id: 'essentials',
    items: ['wifi', 'airConditioning', 'heating', 'tv', 'elevator', 'workspace', 'iron', 'hairDryer'],
  },
  {
    id: 'facilities',
    items: [
      'pool',
      'gym',
      'exerciseEquipment',
      'hotTub',
      'jacuzzi',
      'rooftop',
      'privateGarden',
      'balcony',
      'fireplace',
      'poolTable',
      'piano',
      'swing',
    ],
  },
  {
    id: 'kitchen',
    items: ['kitchen', 'coffeeMaker', 'microwave', 'dishwasher', 'washer', 'dryer'],
  },
  {
    id: 'outdoor',
    items: ['bbqGrill', 'firePit', 'outdoorShower', 'beachAccess', 'lakeAccess', 'skiInSkiOut'],
  },
  { id: 'parking', items: ['freeParking'] },
  {
    id: 'safety',
    items: [
      'security',
      'securitySystem',
      'smokeAlarm',
      'firstAidKit',
      'fireExtinguisher',
      'carbonMonoxideAlarm',
    ],
  },
] as const;

export const AMENITIES: string[] = AMENITY_GROUPS.flatMap((g) => [...g.items] as string[]);

/** Kept as aliases so the wizard's two amenity pickers share one vocabulary. */
export const HOTEL_AMENITY_GROUPS = AMENITY_GROUPS;
export const HOTEL_AMENITIES = AMENITIES;
export const ROOM_AMENITIES = AMENITIES;

/* These three mirror the server's lookups exactly. Anything the server does not
 * know cannot be saved — there would be no id to send — so Studio, Apartment,
 * Courtyard, Nile/river view and Single bed were removed rather than left in
 * the UI as choices that silently vanish on save. */

export const ROOM_CATEGORIES = [
  'standard',
  'superior',
  'deluxe',
  'juniorSuite',
  'suite',
  'executiveSuite',
  'presidentialSuite',
  'family',
] as const;

export const ROOM_VIEWS = ['sea', 'city', 'garden', 'pool', 'mountain', 'none'] as const;

export const BED_TYPES = ['king', 'queen', 'double', 'twin', 'sofa', 'bunk'] as const;

export type BedType = (typeof BED_TYPES)[number];

export const BOARD_BASES: BoardBasis[] = [
  'roomOnly',
  'breakfast',
  'halfBoard',
  'fullBoard',
];

/** Board bases that imply breakfast — keeps `breakfastIncluded` derivable. */
export const BOARD_INCLUDES_BREAKFAST: Record<BoardBasis, boolean> = {
  roomOnly: false,
  breakfast: true,
  halfBoard: true,
  fullBoard: true,
};

export const CURRENCIES = [
  'EGP',
  'QAR',
  'AED',
  'SAR',
  'BHD',
  'KWD',
  'OMR',
  'USD',
  'EUR',
  'GBP',
  'TRY',
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number];

/**
 * Pre-selected for a new hotel and used as the display fallback wherever a
 * record has no currency of its own. Declared once so the wizard, the guest
 * preview and the overview KPIs can never disagree.
 *
 * Note this is only the *starting* value: picking a country in the Location
 * step still switches the hotel to that country's currency (see
 * COUNTRY_DEFAULT_CURRENCY), and the owner can override it in Basics.
 */
export const DEFAULT_CURRENCY: CurrencyCode = 'EGP';

/** Countries the platform operates in, with their bookable cities. */
export const COUNTRIES = [
  { id: 'QA', cities: ['doha', 'alKhor', 'alWakrah', 'lusail'] },
  { id: 'AE', cities: ['dubai', 'abuDhabi', 'sharjah', 'rasAlKhaimah'] },
  { id: 'SA', cities: ['riyadh', 'jeddah', 'makkah', 'madinah', 'alUla'] },
  { id: 'BH', cities: ['manama', 'muharraq'] },
  { id: 'KW', cities: ['kuwaitCity'] },
  { id: 'OM', cities: ['muscat', 'salalah'] },
  { id: 'EG', cities: ['cairo', 'alexandria', 'hurghada', 'sharmElSheikh'] },
] as const;

/** Map centres used by the wizard's pin picker before the owner drops a pin. */
export const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  doha: { lat: 25.2854, lng: 51.531 },
  alKhor: { lat: 25.6804, lng: 51.4969 },
  alWakrah: { lat: 25.1659, lng: 51.6034 },
  lusail: { lat: 25.4265, lng: 51.4919 },
  dubai: { lat: 25.2048, lng: 55.2708 },
  abuDhabi: { lat: 24.4539, lng: 54.3773 },
  sharjah: { lat: 25.3463, lng: 55.4209 },
  rasAlKhaimah: { lat: 25.8007, lng: 55.9762 },
  riyadh: { lat: 24.7136, lng: 46.6753 },
  jeddah: { lat: 21.4858, lng: 39.1925 },
  makkah: { lat: 21.3891, lng: 39.8579 },
  madinah: { lat: 24.5247, lng: 39.5692 },
  alUla: { lat: 26.6089, lng: 37.9216 },
  manama: { lat: 26.2285, lng: 50.586 },
  muharraq: { lat: 26.2572, lng: 50.6119 },
  kuwaitCity: { lat: 29.3759, lng: 47.9774 },
  muscat: { lat: 23.588, lng: 58.3829 },
  salalah: { lat: 17.0151, lng: 54.0924 },
  cairo: { lat: 30.0444, lng: 31.2357 },
  alexandria: { lat: 31.2001, lng: 29.9187 },
  hurghada: { lat: 27.2579, lng: 33.8116 },
  sharmElSheikh: { lat: 27.9158, lng: 34.33 },
};

export const COUNTRY_DEFAULT_CURRENCY: Record<string, CurrencyCode> = {
  QA: 'QAR',
  AE: 'AED',
  SA: 'SAR',
  BH: 'BHD',
  KW: 'KWD',
  OM: 'OMR',
  EG: 'EGP',
};

export const CANCELLATION_PRESETS = ['free24h', 'free48h', 'free7d', 'nonRefundable'] as const;
export type CancellationPreset = (typeof CANCELLATION_PRESETS)[number];

export const CANCELLATION_IS_REFUNDABLE: Record<CancellationPreset, boolean> = {
  free24h: true,
  free48h: true,
  free7d: true,
  nonRefundable: false,
};

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'checkedIn',
  'checkedOut',
  'cancelled',
] as const;

/**
 * Display order for the rating breakdown. The first six are the API's own
 * sub-scores; the remainder are the older categories the mock data uses. The
 * breakdown card renders only the entries a hotel actually has a score for.
 */
export const REVIEW_CATEGORIES = [
  'cleanliness',
  'accuracy',
  'checkIn',
  'communication',
  'location',
  'value',
  'staff',
  'comfort',
  'facilities',
  'valueForMoney',
  'freeWifi',
] as const;

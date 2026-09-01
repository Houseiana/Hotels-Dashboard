import { z } from 'zod';

/* ---------------------------------------------------------------------------
 * The API's own hotel shapes, verified against the live endpoints.
 *
 * These are deliberately SEPARATE from the shared guest model in hotel.ts. The
 * list endpoint returns a lightweight summary — not a Hotel — and squeezing it
 * into the shared schema would mean inventing the fields it doesn't carry.
 * ------------------------------------------------------------------------- */

/**
 * `/api/HotelManagementLookup/HotelStatus` — eight states, not the two the
 * guest model knows about. The API sends the display name as a string, so this
 * maps it onto a stable slug the UI can translate and colour.
 */
export const HOTEL_STATUS_SLUGS = {
  Active: 'active',
  Pending: 'pending',
  Inactive: 'inactive',
  'Action Required': 'actionRequired',
  Draft: 'draft',
  Suspended: 'suspended',
  Rejected: 'rejected',
  Deleted: 'deleted',
} as const;

export const HOTEL_STATUSES = Object.values(HOTEL_STATUS_SLUGS);
export type HotelStatusSlug = (typeof HOTEL_STATUSES)[number];

/** Unknown states degrade to `pending` rather than crashing the list. */
export function statusSlug(name: string | null | undefined): HotelStatusSlug {
  if (!name) return 'pending';
  const direct = HOTEL_STATUS_SLUGS[name as keyof typeof HOTEL_STATUS_SLUGS];
  if (direct) return direct;
  const lowered = name.trim().toLowerCase();
  return (
    HOTEL_STATUSES.find((slug) => slug.toLowerCase() === lowered) ??
    HOTEL_STATUSES.find((slug) => slug.toLowerCase() === lowered.replace(/\s+/g, '')) ??
    'pending'
  );
}

/** What `GET /api/hotels` returns per row — everything the list card needs. */
export const hotelListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string().nullable().optional(),
  starRating: z.number().nullable().optional(),
  coverPhoto: z.string().nullable().optional(),
  cityName: z.string().nullable().optional(),
  countryName: z.string().nullable().optional(),
  roomTypesCount: z.number().nullable().optional(),
  totalUnits: z.number().nullable().optional(),
  fromPrice: z.number().nullable().optional(),
  currencyCode: z.string().nullable().optional(),
});

export type HotelListItem = z.infer<typeof hotelListItemSchema>;

export const hotelListSchema = z.array(hotelListItemSchema);

/* -- detail ---------------------------------------------------------------- */

const photoSchema = z.object({ id: z.string(), url: z.string() });

/**
 * Note the asymmetry: you POST integer ids for category/view/board/bed, but the
 * API reads them back as display names. `currencyId` and `amenityIds` stay
 * numeric. `bedType` is inconsistent — it can be either a name or the raw id as
 * a string, which is a known backend bug.
 */
/**
 * A house rule, as `GET /api/hotels/{id}` reads it back.
 *
 * The write side takes only `{ policyTypeId, allowed }`; the read side adds the
 * type's display name, so a screen can render a hotel's rules without also
 * holding the HotelPolicyTypes lookup.
 */
/**
 * A paid extra, as the API reads it back: `{ id, name, price }`.
 *
 * Note the asymmetry — writes take `serviceId`, reads return `id`. Both
 * refer to the same HotelServices / RoomServices lookup entry.
 */
export const hotelServiceSchema = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
});

export type HotelService = z.infer<typeof hotelServiceSchema>;

/**
 * One age band of the children policy, as the API reads it back.
 *
 * `pricingMode` is a NAME on the way in and an integer id on the way out —
 * the same asymmetry as every other lookup-backed field here. `value` is null
 * for Free and As Adult, which the server enforces.
 */
export const childRuleSchema = z.object({
  minAge: z.number(),
  /** Nullable, like `ordinal` — an open-ended band runs to the policy's max. */
  maxAge: z.number().nullable().optional(),
  /**
   * Which child this band prices: 1st, 2nd, 3rd…
   *
   * Nullable. Most policies read "ages 0–5 are free" and never single a child
   * out — and `UpsertChildrenPricingRuleDto.ordinal` is nullable on the write
   * side too. Requiring it here made the WHOLE hotel fail to parse, so one
   * ordinal-less band turned the screen into "hotel not found".
   */
  ordinal: z.number().nullable().optional(),
  pricingMode: z.string().nullable().optional(),
  value: z.number().nullable().optional(),
});

export const childrenPolicySchema = z.object({
  childrenAllowed: z.boolean().default(false),
  minChildAge: z.number().nullable().optional(),
  maxChildAge: z.number().nullable().optional(),
  rules: z.array(childRuleSchema).default([]),
});

export type ChildRule = z.infer<typeof childRuleSchema>;
export type ChildrenPolicy = z.infer<typeof childrenPolicySchema>;

export const hotelPolicySchema = z.object({
  policyTypeId: z.number(),
  name: z.string().nullable().optional(),
  allowed: z.boolean(),
});

export type HotelPolicy = z.infer<typeof hotelPolicySchema>;

const roomTypeDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameAr: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  descriptionAr: z.string().nullable().optional(),
  roomCategory: z.string().nullable().optional(),
  viewType: z.string().nullable().optional(),
  sizeSqm: z.number().nullable().optional(),
  baseOccupancy: z.number().nullable().optional(),
  totalUnits: z.number().nullable().optional(),
  coverPhoto: z.string().nullable().optional(),
  beds: z
    .array(z.object({ id: z.string(), bedType: z.string(), count: z.number() }))
    .default([]),
  amenityIds: z.array(z.number()).default([]),
  photos: z.array(photoSchema).default([]),
  services: z.array(hotelServiceSchema).default([]),
  ratePlans: z
    .array(
      z.object({
        id: z.string(),
        boardBasis: z.string().nullable().optional(),
        basePrice: z.number().nullable().optional(),
        currencyId: z.number().nullable().optional(),
        cancellationPolicyType: z.string().nullable().optional(),
        freeCancellationHours: z.number().nullable().optional(),
        freeCancellationDays: z.number().nullable().optional(),
      }),
    )
    .default([]),
});

export const hotelDetailSchema = z.object({
  id: z.string(),
  managerId: z.string().nullable().optional(),
  name: z.string(),
  nameAr: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  descriptionAr: z.string().nullable().optional(),
  starRating: z.number().nullable().optional(),
  checkInTime: z.string().nullable().optional(),
  checkOutTime: z.string().nullable().optional(),
  coverPhoto: z.string().nullable().optional(),
  streetAddress: z.string().nullable().optional(),
  postalCode: z.string().nullable().optional(),
  cityId: z.number().nullable().optional(),
  // Added by the backend after we asked for them; the old workaround that
  // fetched these from the LIST endpoint is gone.
  cityName: z.string().nullable().optional(),
  stateName: z.string().nullable().optional(),
  countryName: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  villageId: z.number().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  isActive: z.boolean().nullable().optional(),
  isDeleted: z.boolean().nullable().optional(),
  amenityIds: z.array(z.number()).default([]),
  photos: z.array(photoSchema).default([]),
  roomTypes: z.array(roomTypeDetailSchema).default([]),
  policies: z.array(hotelPolicySchema).default([]),
  services: z.array(hotelServiceSchema).default([]),
  childrenPolicy: childrenPolicySchema.nullable().optional(),
});

export type HotelDetail = z.infer<typeof hotelDetailSchema>;
export type RoomTypeDetail = z.infer<typeof roomTypeDetailSchema>;

/* -- overview -------------------------------------------------------------- */

/**
 * `GET /api/hotels/overview`.
 *
 * NOTE on `recentBookings`: the account this was built against has no bookings
 * yet, so the element shape is inferred from the booking DTOs rather than
 * observed. Every field is therefore optional and unknown keys are kept — a
 * mismatch must degrade to a thinner row, never to a screen that fails to
 * parse. Tighten this once a real booking exists to check it against.
 */
export const overviewBookingSchema = z
  .object({
    id: z.string().optional(),
    reference: z.string().nullable().optional(),
    hotelId: z.string().nullable().optional(),
    hotelName: z.string().nullable().optional(),
    roomTypeId: z.string().nullable().optional(),
    roomTypeName: z.string().nullable().optional(),
    guestName: z.string().nullable().optional(),
    guestEmail: z.string().nullable().optional(),
    guests: z.number().nullable().optional(),
    checkIn: z.string().nullable().optional(),
    checkOut: z.string().nullable().optional(),
    nights: z.number().nullable().optional(),
    status: z.string().nullable().optional(),
    total: z.number().nullable().optional(),
    currencyCode: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
  })
  .loose();

export const hotelOverviewSchema = z.object({
  activeHotels: z.number().default(0),
  draftHotels: z.number().default(0),
  upcomingCheckIns: z.number().default(0),
  occupancyPercent: z.number().default(0),
  monthRevenue: z.number().default(0),
  revenueCurrencyCode: z.string().nullable().optional(),
  recentBookings: z.array(overviewBookingSchema).default([]),
});

export type HotelOverview = z.infer<typeof hotelOverviewSchema>;
export type OverviewBooking = z.infer<typeof overviewBookingSchema>;

/* -- booking status -------------------------------------------------------- */

/**
 * The API's BookingStatus lookup carries eleven states; the shared guest model
 * has five. Rather than collapse the extras into the nearest neighbour — which
 * would tell an owner "Confirmed" when the server said "Awaiting Approval" —
 * every server state gets its own slug and is shown as-is.
 */
export const BOOKING_STATUS_SLUGS = {
  Upcoming: 'upcoming',
  Past: 'past',
  Cancelled: 'cancelled',
  'Need to Pay': 'needToPay',
  'Awaiting Approval': 'awaitingApproval',
  Pending: 'pending',
  Requested: 'requested',
  Declined: 'declined',
  'Currently Hosting': 'currentlyHosting',
  'Checking Out': 'checkingOut',
  Completed: 'completed',
} as const;

export type BookingStatusSlug =
  (typeof BOOKING_STATUS_SLUGS)[keyof typeof BOOKING_STATUS_SLUGS];

/** Null for a state the lookup gained after this table was written. */
export function bookingStatusSlug(name: string | null | undefined): BookingStatusSlug | null {
  if (!name) return null;
  const key = Object.keys(BOOKING_STATUS_SLUGS).find(
    (k) => k.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  return key ? BOOKING_STATUS_SLUGS[key as keyof typeof BOOKING_STATUS_SLUGS] : null;
}

export const BOOKING_STATUS_TONE: Record<BookingStatusSlug, 'active' | 'draft' | 'danger' | 'neutral'> = {
  upcoming: 'active',
  currentlyHosting: 'active',
  completed: 'neutral',
  past: 'neutral',
  checkingOut: 'active',
  pending: 'draft',
  requested: 'draft',
  awaitingApproval: 'draft',
  needToPay: 'draft',
  cancelled: 'danger',
  declined: 'danger',
};

/* -- reviews --------------------------------------------------------------- */

/**
 * `GET /api/hotels/{hotelId}/hotel-reviews`.
 *
 * The account this was built against has no reviews, so — as with
 * `overviewBookingSchema` — the element shape is inferred from the create DTO
 * and every field is optional. Unknown keys are preserved.
 *
 * The scale of `ratingValue` is NOT confirmed. It is read as the 0–10 the
 * shared model uses; if the backend is actually storing 1–5, every score on
 * this screen reads half what it should. Confirm before trusting it.
 */
export const apiReviewSchema = z
  .object({
    id: z.string().optional(),
    guestId: z.string().nullable().optional(),
    guestName: z.string().nullable().optional(),
    guestCountry: z.string().nullable().optional(),
    ratingValue: z.number().nullable().optional(),
    comment: z.string().nullable().optional(),
    cleanliness: z.number().nullable().optional(),
    accuracy: z.number().nullable().optional(),
    checkIn: z.number().nullable().optional(),
    communication: z.number().nullable().optional(),
    location: z.number().nullable().optional(),
    value: z.number().nullable().optional(),
    roomTypeName: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    reply: z.string().nullable().optional(),
    repliedAt: z.string().nullable().optional(),
  })
  .loose();

export const reviewSummarySchema = z.object({
  totalReviews: z.number().default(0),
  averageRating: z.number().nullable().optional(),
  cleanliness: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  checkIn: z.number().nullable().optional(),
  communication: z.number().nullable().optional(),
  location: z.number().nullable().optional(),
  value: z.number().nullable().optional(),
});

export const hotelReviewsPageSchema = z.object({
  summary: reviewSummarySchema,
  reviews: z.array(apiReviewSchema).default([]),
});

export type ApiReview = z.infer<typeof apiReviewSchema>;
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;
export type HotelReviewsPage = z.infer<typeof hotelReviewsPageSchema>;

/* -- manager account ------------------------------------------------------- */

/** `GET /api/hotels/account`. Scoped by the bearer token. */
export const managerAccountSchema = z.object({
  name: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  currencyId: z.number().nullable().optional(),
  currencyCode: z.string().nullable().optional(),
});

/**
 * `GET /api/hotels/account/payout-methods`. Verified against the live API:
 *
 *   { id: 14, userId, payoutMethodId: "PAYPAL", accountId, accountName }
 *
 * Two of these shapes are NOT the ones the create DTO takes, and getting them
 * wrong failed the whole array parse — which the screen then rendered as "no
 * payout method saved yet", hiding methods that were really there:
 *
 *   - `id` comes back as a NUMBER, while the edit and delete paths take it as a
 *     path segment. It is normalised to a string so the rest of the dashboard
 *     has one type to hold.
 *   - `payoutMethodId` comes back as the enum's NAME ("PAYPAL"), not the integer
 *     id the create/edit DTO expects. It is resolved against the PayoutMethod
 *     lookup by name — see `payoutMethodOption`.
 *
 * `accountId` is the API's single account identifier: it holds the IBAN for a
 * bank account and the address for PayPal, so the dashboard labels it by method.
 */
export const payoutMethodRecordSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    payoutMethodId: z.union([z.string(), z.number()]).nullable().optional(),
    payoutMethodName: z.string().nullable().optional(),
    accountId: z.string().nullable().optional(),
    accountName: z.string().nullable().optional(),
  })
  .loose();

/**
 * Matches a record's `payoutMethodId` — an integer id OR an enum name — to its
 * entry in the PayoutMethod lookup, so the list can name the method and the
 * edit form can preselect it. Names are compared without case or separators, so
 * "Bank Account" and "BANK_ACCOUNT" are the same method.
 */
export function payoutMethodOption<T extends { id: number; name: string }>(
  value: string | number | null | undefined,
  options: readonly T[],
): T | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return options.find((option) => option.id === value);
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return options.find((option) => option.id === Number(trimmed));
  const key = trimmed.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return options.find((option) => option.name.replace(/[^a-z0-9]/gi, '').toLowerCase() === key);
}

export type ManagerAccount = z.infer<typeof managerAccountSchema>;
export type PayoutMethodRecord = z.infer<typeof payoutMethodRecordSchema>;

/* -- bookings -------------------------------------------------------------- */

/**
 * `GET /api/hotels/bookings`. The list row, now confirmed against a live
 * account that actually has a booking:
 *
 *   { bookingId, bookingCode, guestName, guests, hotelName, roomTypeName,
 *     checkIn, checkOut, nights, status, totalPrice, currencyCode }
 *
 * Two names differ from what was inferred before, and both were showing as an
 * em dash in the table: the reference is `bookingCode` (not `reference`) and
 * the money is `totalPrice` (not `total`). The earlier guesses are kept as
 * fallbacks rather than swapped out, so nothing breaks if the backend ever
 * answers with them. Everything stays optional and unknown keys are preserved.
 */
export const apiBookingSchema = z
  .object({
    id: z.string().optional(),
    bookingId: z.string().nullable().optional(),
    bookingCode: z.string().nullable().optional(),
    reference: z.string().nullable().optional(),
    bookingReference: z.string().nullable().optional(),
    hotelId: z.string().nullable().optional(),
    hotelName: z.string().nullable().optional(),
    roomTypeId: z.string().nullable().optional(),
    roomTypeName: z.string().nullable().optional(),
    guestName: z.string().nullable().optional(),
    guestEmail: z.string().nullable().optional(),
    guestPhone: z.string().nullable().optional(),
    guestCountry: z.string().nullable().optional(),
    guests: z.number().nullable().optional(),
    checkIn: z.string().nullable().optional(),
    checkOut: z.string().nullable().optional(),
    nights: z.number().nullable().optional(),
    status: z.string().nullable().optional(),
    statusName: z.string().nullable().optional(),
    boardBasis: z.string().nullable().optional(),
    total: z.number().nullable().optional(),
    totalAmount: z.number().nullable().optional(),
    totalPrice: z.number().nullable().optional(),
    currencyCode: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    specialRequests: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .loose();

export type ApiBooking = z.infer<typeof apiBookingSchema>;

/* -- fees ------------------------------------------------------------------ */

/**
 * `GET /api/hotels/{hotelId}/fees`. Verified against the live API.
 *
 * Note the usual asymmetry: reads give `typeName` (a display name) while writes
 * take `type` (an integer id from the HotelFeeType lookup). A fee with a
 * `roomTypeId` applies to that room type only; without one it applies to the
 * whole hotel.
 */
export const hotelFeeSchema = z.object({
  feeId: z.string(),
  typeName: z.string().nullable().optional(),
  customName: z.string().nullable().optional(),
  customNameAr: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  roomTypeId: z.string().nullable().optional(),
  roomTypeName: z.string().nullable().optional(),
});

export type HotelFee = z.infer<typeof hotelFeeSchema>;

/**
 * `GET /api/hotels/{hotelId}/nearby-places?categoryId=<id>`.
 *
 * The write DTO is documented (`CreateHotelNearbyPlaceDto`); the read is not,
 * and the QA account has no place to read back, so this accepts the write
 * spelling (`nameAR`) alongside the one the rest of the API's reads use
 * (`nameAr`), and both `id` and `placeId` for the key. Unknown keys survive.
 * Whichever pair the server actually sends, the mapper below finds it.
 */
export const apiNearbyPlaceSchema = z
  .object({
    id: z.string().nullable().optional(),
    placeId: z.string().nullable().optional(),
    categoryId: z.number().nullable().optional(),
    categoryName: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    nameAr: z.string().nullable().optional(),
    nameAR: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    descriptionAr: z.string().nullable().optional(),
    descriptionAR: z.string().nullable().optional(),
    rating: z.number().nullable().optional(),
    reviewCount: z.number().nullable().optional(),
    distanceMeters: z.number().nullable().optional(),
    walkMinutes: z.number().nullable().optional(),
    driveMinutes: z.number().nullable().optional(),
    googleMapsUrl: z.string().nullable().optional(),
    priceLevel: z.number().nullable().optional(),
    displayOrder: z.number().nullable().optional(),
    timeOfDay: z.number().nullable().optional(),
  })
  .loose();

export type ApiNearbyPlace = z.infer<typeof apiNearbyPlaceSchema>;

/**
 * The body both `nearby-places/create` and `nearby-places/{id}/edit` take.
 *
 * Note `nameAR` / `descriptionAR`: the API capitalises the suffix here, unlike
 * the hotel and room-type forms, which use `nameAr`.
 */
export type NearbyPlacePayload = {
  categoryId?: number;
  name?: string;
  nameAR?: string;
  description?: string;
  descriptionAR?: string;
  rating?: number;
  reviewCount?: number;
  distanceMeters?: number;
  walkMinutes?: number;
  driveMinutes?: number;
  googleMapsUrl?: string;
  priceLevel?: number;
  displayOrder?: number;
  timeOfDay?: number;
};

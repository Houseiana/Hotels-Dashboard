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
  area: z.string().nullable().optional(),
  villageId: z.number().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  isActive: z.boolean().nullable().optional(),
  isDeleted: z.boolean().nullable().optional(),
  amenityIds: z.array(z.number()).default([]),
  photos: z.array(photoSchema).default([]),
  roomTypes: z.array(roomTypeDetailSchema).default([]),
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
 * `GET /api/hotels/account/payout-methods`.
 *
 * The account this was built against has none saved, so the field names beyond
 * the create DTO's three are unconfirmed — hence the lenient parse. `accountId`
 * is the API's single account identifier: it holds the IBAN for a bank account
 * and the address for PayPal, so the dashboard labels it by method.
 */
export const payoutMethodRecordSchema = z
  .object({
    id: z.string(),
    payoutMethodId: z.number().nullable().optional(),
    payoutMethodName: z.string().nullable().optional(),
    accountId: z.string().nullable().optional(),
    accountName: z.string().nullable().optional(),
  })
  .loose();

export type ManagerAccount = z.infer<typeof managerAccountSchema>;
export type PayoutMethodRecord = z.infer<typeof payoutMethodRecordSchema>;

/* -- bookings -------------------------------------------------------------- */

/**
 * `GET /api/hotels/{hotelId}/bookings`.
 *
 * The account this was built against has no bookings, so — like the review and
 * overview shapes — the fields are inferred rather than observed and every one
 * is optional. Alternative spellings the backend might use are accepted where
 * they are cheap to allow, and unknown keys are preserved.
 */
export const apiBookingSchema = z
  .object({
    id: z.string().optional(),
    bookingId: z.string().nullable().optional(),
    reference: z.string().nullable().optional(),
    bookingReference: z.string().nullable().optional(),
    hotelId: z.string().nullable().optional(),
    hotelName: z.string().nullable().optional(),
    roomTypeId: z.string().nullable().optional(),
    roomTypeName: z.string().nullable().optional(),
    guestName: z.string().nullable().optional(),
    guestEmail: z.string().nullable().optional(),
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
    currencyCode: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    specialRequests: z.string().nullable().optional(),
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

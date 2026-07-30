import { z } from 'zod';

/* ---------------------------------------------------------------------------
 * Houseiana — shared hotel model.
 *
 * These Zod schemas are the SINGLE SOURCE OF TRUTH for the hotel domain. The
 * TypeScript types below are inferred with z.infer, never hand-written, so the
 * dashboard and the guest-facing app can never drift apart.
 *
 * Every validation message is an i18n key resolved against the `validation`
 * namespace (see src/messages/*.json) — see `translateIssues()` in
 * src/lib/schemas/errors.ts.
 * ------------------------------------------------------------------------- */

/* -- enums ---------------------------------------------------------------- */

export const boardBasisSchema = z.enum([
  'roomOnly',
  'breakfast',
  'halfBoard',
  'fullBoard',
]);

export const hotelStatusSchema = z.enum(['draft', 'active']);

export const nearbyCategorySchema = z.enum([
  'attraction',
  'restaurant',
  'transit',
]);

/* -- rate plan ------------------------------------------------------------ */

export const hotelRatePlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  boardBasis: boardBasisSchema,
  pricePerNight: z
    .number({ message: 'priceRequired' })
    .positive('pricePositive'),
  /** Set from Pricing & availability (seasonal), never in the wizard. */
  priceWithoutDiscount: z.number().positive('pricePositive').optional(),
  /** Set from Pricing & availability (seasonal), never in the wizard. */
  discountPercent: z.number().min(0).max(100, 'discountRange').optional(),
  refundable: z.boolean(),
  breakfastIncluded: z.boolean(),
});

/* -- room type ------------------------------------------------------------ */

export const hotelRoomTypeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'roomNameRequired'),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  category: z.string().min(1, 'categoryRequired'),
  view: z.string().optional(),
  capacity: z.number().int('integerRequired').min(1, 'capacityMin'),
  beds: z.number().int('integerRequired').min(1, 'bedsMin'),
  /** Human-readable summary of the bed rows, e.g. "1 King bed, 1 Sofa bed". */
  bedConfig: z.string().optional(),
  bathrooms: z.number().int('integerRequired').min(0, 'bathroomsMin'),
  sizeM2: z.number().positive('sizePositive').optional(),
  inventory: z.number().int('integerRequired').min(1, 'inventoryMin'),
  pricePerNight: z.number().positive('pricePositive'),
  amenities: z.array(z.string()),
  photos: z.array(z.string()),
  refundable: z.boolean().optional(),
  breakfastIncluded: z.boolean().optional(),
  ratePlans: z.array(hotelRatePlanSchema).min(1, 'ratePlanRequired'),
});

/* -- policies ------------------------------------------------------------- */

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'timeFormat');

export const hotelPoliciesSchema = z.object({
  checkInFrom: timeString.optional(),
  checkOutUntil: timeString.optional(),
  cancellation: z.string().optional(),
  childrenPolicy: z.string().optional(),
  paymentNote: z.string().optional(),
  petsAllowed: z.boolean().optional(),
  smokingAllowed: z.boolean().optional(),
});

/* -- nearby (auto-derived from the map pin, never typed by the owner) ------ */

export const hotelNearbyPlaceSchema = z.object({
  name: z.string().min(1),
  category: nearbyCategorySchema,
  distance: z.string().min(1),
});

/* -- guest-generated, READ-ONLY in the dashboard --------------------------- */

const score10 = z.number().min(0).max(10);

export const hotelRatingBreakdownSchema = z.object({
  staff: score10.optional(),
  cleanliness: score10.optional(),
  comfort: score10.optional(),
  location: score10.optional(),
  facilities: score10.optional(),
  valueForMoney: score10.optional(),
  freeWifi: score10.optional(),
});

export const hotelReviewSchema = z.object({
  id: z.string().min(1),
  author: z.string().min(1),
  country: z.string().optional(),
  score: score10,
  date: z.string().min(1),
  roomType: z.string().optional(),
  positive: z.string().optional(),
  negative: z.string().optional(),
  /** The only guest-review field the owner may write. */
  ownerReply: z.string().optional(),
});

/* -- hotel ---------------------------------------------------------------- */

export const hotelSchema = z.object({
  id: z.string().min(1),
  status: hotelStatusSchema,
  name: z.string().min(1, 'hotelNameRequired'),
  nameAr: z.string().optional(),
  description: z.string().min(1, 'descriptionRequired'),
  descriptionAr: z.string().optional(),
  city: z.string().min(1, 'cityRequired'),
  country: z.string().min(1, 'countryRequired'),
  address: z.string().min(1, 'addressRequired'),
  latitude: z.number().min(-90).max(90, 'latitudeRange').optional(),
  longitude: z.number().min(-180).max(180, 'longitudeRange').optional(),
  starRating: z.number().int('integerRequired').min(1).max(5, 'starRange').optional(),
  currency: z.string().length(3, 'currencyRequired'),
  coverPhoto: z.string().min(1, 'coverPhotoRequired'),
  photos: z.array(z.string()).min(1, 'photosRequired'),
  amenities: z.array(z.string()),
  roomTypes: z.array(hotelRoomTypeSchema).min(1, 'roomTypeRequired'),
  policies: hotelPoliciesSchema.optional(),
  nearby: z.array(hotelNearbyPlaceSchema).optional(),
  /* read-only guest data */
  rating: score10.optional(),
  reviewCount: z.number().int().min(0).optional(),
  ratingBreakdown: hotelRatingBreakdownSchema.optional(),
  reviews: z.array(hotelReviewSchema).optional(),
});

/* -- inferred types (never hand-written) ---------------------------------- */

export type BoardBasis = z.infer<typeof boardBasisSchema>;
export type HotelStatus = z.infer<typeof hotelStatusSchema>;
export type NearbyCategory = z.infer<typeof nearbyCategorySchema>;
export type HotelRatePlan = z.infer<typeof hotelRatePlanSchema>;
export type HotelRoomType = z.infer<typeof hotelRoomTypeSchema>;
export type HotelPolicies = z.infer<typeof hotelPoliciesSchema>;
export type HotelNearbyPlace = z.infer<typeof hotelNearbyPlaceSchema>;
export type HotelRatingBreakdown = z.infer<typeof hotelRatingBreakdownSchema>;
export type HotelReview = z.infer<typeof hotelReviewSchema>;
export type Hotel = z.infer<typeof hotelSchema>;

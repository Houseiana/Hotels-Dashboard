import { z } from 'zod';
import { DEFAULT_CURRENCY } from '../catalogs';
import {
  boardBasisSchema,
  hotelNearbyPlaceSchema,
  hotelPoliciesSchema,
  hotelRatingBreakdownSchema,
  hotelReviewSchema,
  hotelSchema,
  hotelStatusSchema,
  type Hotel,
  type HotelRatePlan,
  type HotelRoomType,
} from './hotel';

/* ---------------------------------------------------------------------------
 * The wizard edits a LENIENT mirror of the hotel model: a half-filled draft
 * must be storable and autosaveable without being publishable. Strictness is
 * applied per step by the step schemas below, and in full by `hotelSchema`
 * when the owner hits Publish.
 *
 * Every draft field name matches the shared model exactly, so publishing is a
 * cast + parse, never a mapping.
 * ------------------------------------------------------------------------- */

/** A number input that is allowed to be empty while the owner is still typing. */
const draftNumber = z.union([z.number(), z.nan(), z.undefined()]).optional();

export const ratePlanDraftSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  boardBasis: boardBasisSchema,
  pricePerNight: draftNumber,
  priceWithoutDiscount: draftNumber,
  discountPercent: draftNumber,
  refundable: z.boolean(),
  breakfastIncluded: z.boolean(),
});

export const roomTypeDraftSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  category: z.string(),
  view: z.string().optional(),
  capacity: draftNumber,
  beds: draftNumber,
  bedConfig: z.string().optional(),
  bathrooms: draftNumber,
  sizeM2: draftNumber,
  inventory: draftNumber,
  pricePerNight: draftNumber,
  amenities: z.array(z.string()),
  photos: z.array(z.string()),
  refundable: z.boolean().optional(),
  breakfastIncluded: z.boolean().optional(),
  ratePlans: z.array(ratePlanDraftSchema),
});

export const hotelDraftSchema = z.object({
  id: z.string(),
  status: hotelStatusSchema,
  name: z.string(),
  nameAr: z.string().optional(),
  description: z.string(),
  descriptionAr: z.string().optional(),
  /* The shared model carries display names; the API needs numeric ids. Both are
   * kept: `city`/`country` are what the guest app reads, the *Id fields are what
   * `POST /api/hotels` is given. countryId and stateId are UI-only — they drive
   * the location cascade but are never sent. */
  city: z.string(),
  country: z.string(),
  countryId: z.union([z.number(), z.undefined()]).optional(),
  stateId: z.union([z.number(), z.undefined()]).optional(),
  cityId: z.union([z.number(), z.undefined()]).optional(),
  villageId: z.union([z.number(), z.undefined()]).optional(),
  /** Draft-only: kept out of the shared model, folded into `address` on save. */
  area: z.string().optional(),
  buildingNo: z.string().optional(),
  postalCode: z.string().optional(),
  address: z.string(),
  latitude: draftNumber,
  longitude: draftNumber,
  starRating: draftNumber,
  currency: z.string(),
  coverPhoto: z.string(),
  photos: z.array(z.string()),
  amenities: z.array(z.string()),
  roomTypes: z.array(roomTypeDraftSchema),
  policies: hotelPoliciesSchema.optional(),
  nearby: z.array(hotelNearbyPlaceSchema).optional(),
  rating: z.number().optional(),
  reviewCount: z.number().optional(),
  ratingBreakdown: hotelRatingBreakdownSchema.optional(),
  reviews: z.array(hotelReviewSchema).optional(),
});

export type HotelDraft = z.infer<typeof hotelDraftSchema>;
export type RoomTypeDraft = z.infer<typeof roomTypeDraftSchema>;
export type RatePlanDraft = z.infer<typeof ratePlanDraftSchema>;

/* -- per-step validation --------------------------------------------------- */

export const WIZARD_STEPS = [
  'basics',
  'location',
  'amenities',
  'photos',
  'rooms',
  'review',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'timeFormat');

export const basicsStepSchema = z.object({
  name: z.string().min(1, 'hotelNameRequired'),
  description: z.string().min(1, 'descriptionRequired'),
  currency: z.string().length(3, 'currencyRequired'),
  starRating: z
    .number({ message: 'starRequired' })
    .int('integerRequired')
    .min(1, 'starRange')
    .max(5, 'starRange'),
  policies: z
    .object({
      checkInFrom: time.optional(),
      checkOutUntil: time.optional(),
    })
    .optional(),
});

export const locationStepSchema = z.object({
  address: z.string().min(1, 'addressRequired'),
  country: z.string().min(1, 'countryRequired'),
  city: z.string().min(1, 'cityRequired'),
  latitude: z
    .number({ message: 'pinRequired' })
    .min(-90, 'latitudeRange')
    .max(90, 'latitudeRange'),
  longitude: z
    .number({ message: 'pinRequired' })
    .min(-180, 'longitudeRange')
    .max(180, 'longitudeRange'),
});

export const amenitiesStepSchema = z.object({
  amenities: z.array(z.string()).min(1, 'amenitiesRequired'),
});

export const photosStepSchema = z.object({
  photos: z.array(z.string()).min(1, 'photosRequired'),
  coverPhoto: z.string().min(1, 'coverPhotoRequired'),
});

export const roomsStepSchema = z.object({
  roomTypes: z
    .array(
      z.object({
        name: z.string().min(1, 'roomNameRequired'),
        category: z.string().min(1, 'categoryRequired'),
        capacity: z.number({ message: 'capacityMin' }).int('integerRequired').min(1, 'capacityMin'),
        beds: z.number({ message: 'bedsMin' }).int('integerRequired').min(1, 'bedsMin'),
        bathrooms: z
          .number({ message: 'bathroomsMin' })
          .int('integerRequired')
          .min(0, 'bathroomsMin'),
        inventory: z
          .number({ message: 'inventoryMin' })
          .int('integerRequired')
          .min(1, 'inventoryMin'),
        pricePerNight: z.number({ message: 'priceRequired' }).positive('pricePositive'),
        ratePlans: z
          .array(
            z.object({
              boardBasis: boardBasisSchema,
              pricePerNight: z.number({ message: 'priceRequired' }).positive('pricePositive'),
            }),
          )
          .min(1, 'ratePlanRequired'),
      }),
    )
    .min(1, 'roomTypeRequired'),
});

/** Step 6 runs the real shared-model schema — exactly what the guest app parses. */
export const reviewStepSchema = hotelSchema;

export const STEP_SCHEMAS: Record<WizardStep, z.ZodType> = {
  basics: basicsStepSchema,
  location: locationStepSchema,
  amenities: amenitiesStepSchema,
  photos: photosStepSchema,
  rooms: roomsStepSchema,
  review: reviewStepSchema,
};

/* -- draft <-> model ------------------------------------------------------- */

const num = (v: number | undefined): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

const clean = (v: string | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

const stripUndefined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/**
 * Project a draft onto the shared model shape. The result is what gets sent to
 * the API and what `hotelSchema` validates — it contains no draft-only fields.
 */
export function draftToHotel(draft: HotelDraft): Hotel {
  const roomTypes = draft.roomTypes.map((rt): HotelRoomType => {
    const ratePlans = rt.ratePlans.map(
      (rp): HotelRatePlan =>
        stripUndefined({
          id: rp.id,
          name: clean(rp.name),
          boardBasis: rp.boardBasis,
          pricePerNight: num(rp.pricePerNight) as number,
          priceWithoutDiscount: num(rp.priceWithoutDiscount),
          discountPercent: num(rp.discountPercent),
          refundable: rp.refundable,
          breakfastIncluded: rp.breakfastIncluded,
        }),
    );

    // The room's headline price is the cheapest rate plan, so the guest card and
    // the room list agree without a second source of truth.
    const cheapest = ratePlans.reduce<number | undefined>(
      (min, rp) =>
        typeof rp.pricePerNight === 'number' && (min === undefined || rp.pricePerNight < min)
          ? rp.pricePerNight
          : min,
      undefined,
    );

    return stripUndefined({
      id: rt.id,
      name: rt.name.trim(),
      nameAr: clean(rt.nameAr),
      description: clean(rt.description),
      descriptionAr: clean(rt.descriptionAr),
      category: rt.category,
      view: clean(rt.view),
      capacity: num(rt.capacity) as number,
      beds: num(rt.beds) as number,
      bedConfig: clean(rt.bedConfig),
      bathrooms: num(rt.bathrooms) as number,
      sizeM2: num(rt.sizeM2),
      inventory: num(rt.inventory) as number,
      pricePerNight: (cheapest ?? num(rt.pricePerNight)) as number,
      amenities: rt.amenities,
      photos: rt.photos,
      // Mirrored from the most permissive rate plan so guest-side filters
      // ("free cancellation", "breakfast included") work at room level too.
      refundable: ratePlans.some((rp) => rp.refundable),
      breakfastIncluded: ratePlans.some((rp) => rp.breakfastIncluded),
      ratePlans,
    });
  });

  const addressParts = [draft.address.trim(), clean(draft.area)].filter(Boolean);

  return stripUndefined({
    id: draft.id,
    status: draft.status,
    name: draft.name.trim(),
    nameAr: clean(draft.nameAr),
    description: draft.description.trim(),
    descriptionAr: clean(draft.descriptionAr),
    city: draft.city,
    country: draft.country,
    address: addressParts.join(', '),
    latitude: num(draft.latitude),
    longitude: num(draft.longitude),
    starRating: num(draft.starRating),
    currency: draft.currency,
    coverPhoto: draft.coverPhoto || draft.photos[0] || '',
    photos: draft.photos,
    amenities: draft.amenities,
    roomTypes,
    policies: draft.policies,
    nearby: draft.nearby,
    rating: draft.rating,
    reviewCount: draft.reviewCount,
    ratingBreakdown: draft.ratingBreakdown,
    reviews: draft.reviews,
  }) as Hotel;
}

/** Hydrate the wizard from a stored hotel. */
export function hotelToDraft(hotel: Hotel): HotelDraft {
  return {
    ...hotel,
    nameAr: hotel.nameAr ?? '',
    descriptionAr: hotel.descriptionAr ?? '',
    area: '',
    buildingNo: '',
    postalCode: '',
    roomTypes: hotel.roomTypes.map((rt) => ({
      ...rt,
      nameAr: rt.nameAr ?? '',
      description: rt.description ?? '',
      descriptionAr: rt.descriptionAr ?? '',
      ratePlans: rt.ratePlans.map((rp) => ({ ...rp })),
    })),
  };
}

export function emptyDraft(id: string, currency: string = DEFAULT_CURRENCY): HotelDraft {
  return {
    id,
    status: 'draft',
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    city: '',
    country: '',
    countryId: undefined,
    stateId: undefined,
    cityId: undefined,
    villageId: undefined,
    area: '',
    buildingNo: '',
    postalCode: '',
    address: '',
    latitude: undefined,
    longitude: undefined,
    starRating: 4,
    currency,
    coverPhoto: '',
    photos: [],
    amenities: [],
    roomTypes: [],
    policies: { checkInFrom: '15:00', checkOutUntil: '12:00' },
    nearby: [],
  };
}

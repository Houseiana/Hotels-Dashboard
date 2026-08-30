import type { HotelDraft } from '../schemas/draft';
import type { LookupItem } from './lookups';
import {
  AMENITY_NAMES,
  BED_NAMES,
  BOARD_NAMES,
  CANCELLATION_RULES,
  CATEGORY_NAMES,
  PRICING_MODE_NAMES,
  PRICING_MODES_WITHOUT_VALUE,
  ROOM_AMENITY_NAMES,
  looseMatch,
  VIEW_NAMES,
  resolver,
} from './catalogMap';
import {
  buildCreateHotelForm,
  type CreateHotelPayload,
  type HotelRoomTypePayload,
  type RatePlanPayload,
} from './hotelForms';
import { parseBedConfig } from '../utils';

/* ---------------------------------------------------------------------------
 * Draft → `POST /api/hotels`.
 *
 * The wizard speaks slugs and the API speaks integer ids, so every vocabulary
 * is resolved through the server's own lookups here. A slug the server does not
 * know resolves to `undefined` and is simply omitted rather than sent as a
 * guess — the field is optional on their side.
 * ------------------------------------------------------------------------- */

export type SubmitLookups = {
  amenities?: LookupItem[];
  /**
   * What a ROOM has, a separate vocabulary from the hotel's own amenities.
   *
   * Resolving room amenities through `amenities` looked like it worked and
   * wasn't: no room slug is in that table, so every ticked in-room amenity
   * resolved to `undefined` and was dropped on the way to the server.
   */
  roomAmenities?: LookupItem[];
  roomCategory?: LookupItem[];
  viewType?: LookupItem[];
  bedType?: LookupItem[];
  boardBasis?: LookupItem[];
  cancellationPolicyType?: LookupItem[];
  childPricingMode?: LookupItem[];
  currencies?: Array<{ id: number; code: string }>;
};

/**
 * Service rows in the API's shape.
 *
 * `price` is nullable on their side, so a service the hotel quotes on request
 * is sent WITHOUT one. Omitting the field is not the same as sending zero —
 * zero would tell guests the extra is free.
 */
export function serviceRows(
  rows: ReadonlyArray<{ serviceId: number; price?: number }>,
): Array<{ serviceId: number; price?: number }> {
  return rows.map((row) => ({
    serviceId: row.serviceId,
    price: typeof row.price === 'number' && Number.isFinite(row.price) ? row.price : undefined,
  }));
}

const num = (v: number | undefined): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

const text = (v: string | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

/**
 * Photos live in the draft as data URLs so they survive localStorage; the API
 * wants real files. This converts one back on the way out.
 */
async function toFile(dataUrl: string, name: string): Promise<File | undefined> {
  if (!dataUrl.startsWith('data:')) return undefined;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const extension = blob.type.split('/')[1]?.split('+')[0] || 'jpg';
    return new File([blob], `${name}.${extension}`, { type: blob.type || 'image/jpeg' });
  } catch {
    return undefined;
  }
}

/**
 * A photo list split the way every write endpoint wants it: the first photo is
 * the cover, the rest the gallery.
 *
 * Gradient placeholders are not files and drop out on the way — the server can
 * only be sent what an owner actually uploaded.
 */
async function splitPhotos(
  photos: readonly string[],
  prefix: string,
): Promise<{ coverFile?: File; photoFiles: File[] }> {
  const [cover, ...rest] = photos;
  const coverFile = cover ? await toFile(cover, `${prefix}-cover`) : undefined;
  const photoFiles = (
    await Promise.all(rest.map((photo, index) => toFile(photo, `${prefix}-${index + 1}`)))
  ).filter((file): file is File => Boolean(file));
  return { coverFile, photoFiles };
}

/**
 * The children policy in the API's own terms.
 *
 * Returns undefined when a band's pricing mode is not one the server offers —
 * dropping the band would silently change the policy, so the caller reports it
 * instead. `value` is omitted for Free and As Adult, which the API rejects a
 * value for.
 */
export function childrenPolicyPayload(
  draft: HotelDraft,
  lookups: SubmitLookups,
):
  | {
      childrenAllowed: boolean;
      minChildAge?: number;
      maxChildAge?: number;
      rules: Array<{
        minAge: number;
        maxAge: number;
        /** Nullable: a band need not single out which child it prices. */
        ordinal?: number;
        pricingMode: number;
        value?: number;
      }>;
    }
  | undefined {
  const policy = draft.childrenPolicy;
  const modeId = (slug: string): number | undefined => {
    const name = PRICING_MODE_NAMES[slug];
    if (!name) return undefined;
    return lookups.childPricingMode?.find((item) => looseMatch(item.name) === looseMatch(name))?.id;
  };

  // The whole policy is replaced on save, so a band we cannot express would be
  // DELETED server-side rather than left alone. Refuse the payload instead and
  // let the caller report it — this is what the doc comment above promises.
  if (policy.rules.some((rule) => modeId(rule.pricingMode) === undefined)) return undefined;

  const rules = policy.rules.flatMap((rule) => {
    const mode = modeId(rule.pricingMode);
    if (mode === undefined) return [];
    const carriesValue = !PRICING_MODES_WITHOUT_VALUE.includes(
      rule.pricingMode as (typeof PRICING_MODES_WITHOUT_VALUE)[number],
    );
    return [
      {
        minAge: rule.minAge,
        maxAge: rule.maxAge,
        ordinal: rule.ordinal,
        pricingMode: mode,
        value: carriesValue ? rule.value : undefined,
      },
    ];
  });

  return {
    childrenAllowed: policy.childrenAllowed,
    minChildAge: typeof policy.minChildAge === 'number' ? policy.minChildAge : undefined,
    maxChildAge: typeof policy.maxChildAge === 'number' ? policy.maxChildAge : undefined,
    rules,
  };
}

export async function draftToCreatePayload(
  draft: HotelDraft,
  managerId: string | undefined,
  lookups: SubmitLookups,
): Promise<CreateHotelPayload> {
  const amenityId = resolver(lookups.amenities, AMENITY_NAMES);
  const roomAmenityId = resolver(lookups.roomAmenities, ROOM_AMENITY_NAMES);
  const categoryId = resolver(lookups.roomCategory, CATEGORY_NAMES);
  const viewId = resolver(lookups.viewType, VIEW_NAMES);
  const bedId = resolver(lookups.bedType, BED_NAMES);
  const boardId = resolver(lookups.boardBasis, BOARD_NAMES);

  const policyId = (slug: string): number | undefined => {
    const rule = CANCELLATION_RULES[slug];
    if (!rule) return undefined;
    return lookups.cancellationPolicyType?.find(
      (item) => item.name.trim().toUpperCase() === rule.policyName,
    )?.id;
  };

  const currencyId = lookups.currencies?.find((c) => c.code === draft.currency)?.id;

  const roomTypes: HotelRoomTypePayload[] = await Promise.all(
    draft.roomTypes.map(async (room, roomIndex) => {
      const ratePlans: RatePlanPayload[] = room.ratePlans.flatMap((plan) => {
        const board = boardId(plan.boardBasis);
        const price = num(plan.pricePerNight);
        // The API requires both; a plan missing either is not a plan yet.
        if (board === undefined || price === undefined) return [];

        // The wizard offers presets; the API wants a policy type plus a window.
        // The owner's actual choice, not a guess reconstructed from a boolean.
        const preset = plan.cancellation || (plan.refundable ? 'free24h' : 'nonRefundable');
        const rule = CANCELLATION_RULES[preset];

        return [
          {
            boardBasis: board,
            basePrice: price,
            currencyId,
            cancellationPolicyType: policyId(preset),
            freeCancellationHours: rule?.freeCancellationHours,
            freeCancellationDays: rule?.freeCancellationDays,
          },
        ];
      });

      return {
        name: room.name.trim(),
        nameAr: text(room.nameAr),
        description: text(room.description),
        descriptionAr: text(room.descriptionAr),
        roomCategory: categoryId(room.category),
        viewType: viewId(room.view),
        sizeSqm: num(room.sizeM2),
        baseOccupancy: num(room.capacity),
        totalUnits: num(room.inventory) ?? 1,
        beds: parseBedConfig(room.bedConfig).flatMap((bed) => {
          const type = bedId(bed.type);
          return type === undefined ? [] : [{ bedType: type, count: bed.qty }];
        }),
        amenityIds: room.amenities.flatMap((slug) => {
          const id = roomAmenityId(slug);
          return id === undefined ? [] : [id];
        }),
        services: serviceRows(room.services),
        ratePlans,
        // A room's own cover and gallery, sent alongside the hotel's own.
        ...(await splitPhotos(room.photos, `room-${roomIndex + 1}`)),
    };
    }),
  );

  const hotelPhotos = await splitPhotos(draft.photos, 'photo');

  return {
    managerId,
    name: draft.name.trim(),
    nameAr: text(draft.nameAr),
    description: text(draft.description),
    descriptionAr: text(draft.descriptionAr),
    starRating: num(draft.starRating),
    checkInTime: text(draft.policies?.checkInFrom),
    checkOutTime: text(draft.policies?.checkOutUntil),
    streetAddress: draft.address.trim(),
    postalCode: text(draft.postalCode),
    cityId: num(draft.cityId),
    area: text(draft.area),
    villageId: num(draft.villageId),
    latitude: num(draft.latitude),
    longitude: num(draft.longitude),
    amenityIds: draft.amenities.flatMap((slug) => {
      const id = amenityId(slug);
      return id === undefined ? [] : [id];
    }),
    roomTypes,
    policies: draft.houseRules,
    services: serviceRows(draft.services),
    childrenPolicy: childrenPolicyPayload(draft, lookups),
    cover: hotelPhotos.coverFile,
    photos: hotelPhotos.photoFiles,
  };
}

export async function draftToCreateForm(
  draft: HotelDraft,
  managerId: string | undefined,
  lookups: SubmitLookups,
): Promise<FormData> {
  return buildCreateHotelForm(await draftToCreatePayload(draft, managerId, lookups));
}

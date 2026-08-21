import type { HotelDraft } from '../schemas/draft';
import type { LookupItem } from './lookups';
import {
  AMENITY_NAMES,
  BED_NAMES,
  BOARD_NAMES,
  CANCELLATION_RULES,
  CATEGORY_NAMES,
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
  roomCategory?: LookupItem[];
  viewType?: LookupItem[];
  bedType?: LookupItem[];
  boardBasis?: LookupItem[];
  cancellationPolicyType?: LookupItem[];
  currencies?: Array<{ id: number; code: string }>;
};

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

export async function draftToCreatePayload(
  draft: HotelDraft,
  managerId: string | undefined,
  lookups: SubmitLookups,
): Promise<CreateHotelPayload> {
  const amenityId = resolver(lookups.amenities, AMENITY_NAMES);
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

  const roomTypes: HotelRoomTypePayload[] = draft.roomTypes.map((room) => {
    const ratePlans: RatePlanPayload[] = room.ratePlans.flatMap((plan) => {
      const board = boardId(plan.boardBasis);
      const price = num(plan.pricePerNight);
      // The API requires both; a plan missing either is not a plan yet.
      if (board === undefined || price === undefined) return [];

      // The wizard offers presets; the API wants a policy type plus a window.
      const preset = plan.refundable ? 'free24h' : 'nonRefundable';
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
        const id = amenityId(slug);
        return id === undefined ? [] : [id];
      }),
      ratePlans,
    };
  });

  const [cover, ...rest] = draft.photos;
  const coverFile = cover ? await toFile(cover, 'cover') : undefined;
  const photoFiles = (
    await Promise.all(rest.map((photo, index) => toFile(photo, `photo-${index + 1}`)))
  ).filter((file): file is File => Boolean(file));

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
    cover: coverFile,
    photos: photoFiles,
  };
}

export async function draftToCreateForm(
  draft: HotelDraft,
  managerId: string | undefined,
  lookups: SubmitLookups,
): Promise<FormData> {
  return buildCreateHotelForm(await draftToCreatePayload(draft, managerId, lookups));
}

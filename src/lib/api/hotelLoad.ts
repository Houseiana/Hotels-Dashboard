import { emptyDraft, type HotelDraft, type RoomTypeDraft } from '../schemas/draft';
import type { HotelDetail } from '../schemas/hotelApi';
import type { LookupItem } from './lookups';
import {
  AMENITY_NAMES,
  BED_NAMES,
  BOARD_NAMES,
  CATEGORY_NAMES,
  VIEW_NAMES,
  reverseResolver,
} from './catalogMap';
import type { SubmitLookups } from './hotelSubmit';
import { formatBedConfig, totalBeds, type BedRow } from '../utils';

/* ---------------------------------------------------------------------------
 * `GET /api/hotels/{id}` → wizard draft.
 *
 * The read direction is not a mirror of the write direction: you POST integer
 * ids but the API reads most of them back as display NAMES, while `amenityIds`
 * and `currencyId` stay numeric. Each field is therefore reversed on its own
 * terms rather than through one shared helper.
 * ------------------------------------------------------------------------- */

const nz = (v: number | null | undefined): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

const str = (v: string | null | undefined): string => v ?? '';

/** Matches a display name back to its slug, tolerating case and spacing. */
function nameToSlug(names: Readonly<Record<string, string>>) {
  const table = new Map(
    Object.entries(names).map(([slug, name]) => [name.trim().toLowerCase(), slug]),
  );
  return (value: string | null | undefined): string | undefined => {
    if (!value) return undefined;
    return table.get(value.trim().toLowerCase());
  };
}

export function detailToDraft(
  detail: HotelDetail,
  lookups: SubmitLookups,
  fallbackCurrency: string,
): HotelDraft {
  const amenitySlug = reverseResolver(lookups.amenities as LookupItem[], AMENITY_NAMES);
  const categorySlug = nameToSlug(CATEGORY_NAMES);
  const viewSlug = nameToSlug(VIEW_NAMES);
  const boardSlug = nameToSlug(BOARD_NAMES);
  const bedSlug = nameToSlug(BED_NAMES);
  const bedById = reverseResolver(lookups.bedType as LookupItem[], BED_NAMES);

  const base = emptyDraft(detail.id, fallbackCurrency);

  const roomTypes: RoomTypeDraft[] = detail.roomTypes.map((room) => {
    const bedRows: BedRow[] = room.beds.flatMap((bed) => {
      // `bedType` is usually a name, but comes back as the raw id when the
      // server can no longer resolve it — handle both.
      const slug = bedSlug(bed.bedType) ?? bedById(Number(bed.bedType));
      return slug ? [{ type: slug, qty: bed.count }] : [];
    });

    const ratePlans = room.ratePlans.map((plan) => {
      const price = nz(plan.basePrice);
      // FIXED with no free window is the API's way of saying non-refundable.
      const refundable =
        (plan.cancellationPolicyType ?? '').trim().toUpperCase() !== 'FIXED' ||
        (nz(plan.freeCancellationHours) ?? 0) > 0 ||
        (nz(plan.freeCancellationDays) ?? 0) > 0;
      const board = boardSlug(plan.boardBasis) ?? 'roomOnly';
      return {
        id: plan.id,
        boardBasis: board as RoomTypeDraft['ratePlans'][number]['boardBasis'],
        pricePerNight: price,
        refundable,
        breakfastIncluded: board !== 'roomOnly',
      };
    });

    const cheapest = ratePlans
      .map((p) => p.pricePerNight)
      .filter((p): p is number => typeof p === 'number')
      .sort((a, b) => a - b)[0];

    return {
      id: room.id,
      name: room.name,
      nameAr: str(room.nameAr),
      description: str(room.description),
      descriptionAr: str(room.descriptionAr),
      category: categorySlug(room.roomCategory) ?? 'standard',
      view: viewSlug(room.viewType) ?? 'none',
      capacity: nz(room.baseOccupancy),
      beds: totalBeds(bedRows) || undefined,
      bedConfig: formatBedConfig(bedRows),
      // The API has no bathrooms field — see API_SUPPORTS.
      bathrooms: 1,
      sizeM2: nz(room.sizeSqm),
      inventory: nz(room.totalUnits),
      pricePerNight: cheapest,
      amenities: room.amenityIds.flatMap((id) => {
        const slug = amenitySlug(id);
        return slug ? [slug] : [];
      }),
      photos: room.photos.map((p) => p.url),
      ratePlans,
    };
  });

  return {
    ...base,
    id: detail.id,
    status: detail.isActive ? 'active' : 'draft',
    name: detail.name,
    nameAr: str(detail.nameAr),
    description: str(detail.description),
    descriptionAr: str(detail.descriptionAr),
    starRating: nz(detail.starRating),
    address: str(detail.streetAddress),
    postalCode: str(detail.postalCode),
    area: str(detail.area),
    // NOTE: the detail response carries cityId/villageId but NOT stateId or
    // countryId, so the location cascade cannot be pre-selected. The ids are
    // preserved so an untouched hotel keeps its location on save; picking a
    // country resets them, which is the correct behaviour anyway.
    cityId: nz(detail.cityId),
    villageId: nz(detail.villageId),
    latitude: nz(detail.latitude),
    longitude: nz(detail.longitude),
    coverPhoto: str(detail.coverPhoto),
    photos: [
      ...(detail.coverPhoto ? [detail.coverPhoto] : []),
      ...detail.photos.map((p) => p.url),
    ],
    amenities: detail.amenityIds.flatMap((id) => {
      const slug = amenitySlug(id);
      return slug ? [slug] : [];
    }),
    policies: {
      checkInFrom: detail.checkInTime ?? undefined,
      checkOutUntil: detail.checkOutTime ?? undefined,
    },
    roomTypes,
  };
}

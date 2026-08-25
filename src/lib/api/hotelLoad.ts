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
  CANCELLATION_RULES,
  looseMatch,
  PRICING_MODE_NAMES,
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

/** "PercentageDiscount" and "Percentage Discount" both map to our slug. */
function pricingSlug(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const needle = looseMatch(name);
  return Object.keys(PRICING_MODE_NAMES).find(
    (slug) => looseMatch(PRICING_MODE_NAMES[slug]) === needle,
  );
}

/**
 * The API stores a policy type plus a window; the wizard offers named presets.
 * This picks the preset whose rule matches what came back, so an owner who set
 * "free for 7 days" sees that again rather than the 24-hour default.
 */
function cancellationPreset(
  policyType: string | null | undefined,
  hours: number | undefined,
  days: number | undefined,
): string {
  const name = (policyType ?? '').trim().toUpperCase();
  const match = Object.keys(CANCELLATION_RULES).find((slug) => {
    const rule = CANCELLATION_RULES[slug];
    if (rule.policyName !== name) return false;
    if (rule.freeCancellationDays !== undefined) return rule.freeCancellationDays === days;
    return (rule.freeCancellationHours ?? 0) === (hours ?? 0);
  });
  if (match) return match;
  // An unrecognised combination is still refundable if it has any window.
  return (hours ?? 0) > 0 || (days ?? 0) > 0 ? 'free24h' : 'nonRefundable';
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
      const preset = cancellationPreset(
        plan.cancellationPolicyType,
        nz(plan.freeCancellationHours),
        nz(plan.freeCancellationDays),
      );
      const board = boardSlug(plan.boardBasis) ?? 'roomOnly';
      return {
        id: plan.id,
        boardBasis: board as RoomTypeDraft['ratePlans'][number]['boardBasis'],
        pricePerNight: price,
        cancellation: preset,
        // Kept so a save writes the plan back in the currency it was priced
        // in, not whatever the hotel's default happens to be.
        currencyId: nz(plan.currencyId),
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
      services: room.services.map((service) => ({
        serviceId: service.id,
        price: service.price ?? 0,
      })),
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
    // The response now carries the place NAMES, which is what the guest model
    // and the edit screen's validation read. It still has no stateId/countryId,
    // so the location cascade cannot be pre-selected — the ids below keep an
    // untouched hotel's location intact on save, and picking a country resets
    // them, which is the right behaviour anyway.
    city: str(detail.cityName),
    country: str(detail.countryName),
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
    services: detail.services.map((service) => ({
      serviceId: service.id,
      price: service.price ?? 0,
    })),
    // `pricingMode` comes back as a NAME; the wizard holds our slug.
    childrenPolicy: {
      childrenAllowed: detail.childrenPolicy?.childrenAllowed ?? false,
      minChildAge: nz(detail.childrenPolicy?.minChildAge) ?? 0,
      maxChildAge: nz(detail.childrenPolicy?.maxChildAge) ?? 12,
      rules: (detail.childrenPolicy?.rules ?? []).map((rule) => ({
        minAge: rule.minAge,
        maxAge: rule.maxAge,
        ordinal: rule.ordinal,
        pricingMode: pricingSlug(rule.pricingMode) ?? 'free',
        value: nz(rule.value),
      })),
    },
    houseRules: detail.policies.map((policy) => ({
      policyTypeId: policy.policyTypeId,
      allowed: policy.allowed,
    })),
    roomTypes,
  };
}

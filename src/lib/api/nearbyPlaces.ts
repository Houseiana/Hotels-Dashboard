import type { HotelNearbyPlace } from '../schemas/hotel';
import type { ApiNearbyPlace, NearbyPlacePayload } from '../schemas/hotelApi';

/* ---------------------------------------------------------------------------
 * Nearby places, both directions.
 *
 * Built to match what the guest app already does with a property's places
 * (`src/features/property/components/nearby-experience.tsx` over there): the
 * seven categories are TABS, a place belongs to exactly one of them, and the
 * places carrying a `displayOrder` are the steps of the suggested day.
 *
 * Two rules come from that side and are load-bearing here:
 *
 *  - a category is identified by ID, never by name — the lookup localises the
 *    name, so matching on it breaks the moment the locale is Arabic;
 *  - the write DTO spells the Arabic fields `nameAR` / `descriptionAR`, unlike
 *    the hotel and room-type forms, which use `nameAr`.
 * ------------------------------------------------------------------------- */

const num = (v: number | null | undefined): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

const text = (v: string | null | undefined): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

/** One row as the API returned it, in the wizard's own shape. */
export function apiToNearbyPlace(place: ApiNearbyPlace): HotelNearbyPlace {
  return {
    id: text(place.id) ?? text(place.placeId),
    categoryId: num(place.categoryId),
    name: text(place.name) ?? '',
    nameAr: text(place.nameAr) ?? text(place.nameAR),
    description: text(place.description),
    descriptionAr: text(place.descriptionAr) ?? text(place.descriptionAR),
    // A place the server numbered IS a step of the suggested day.
    inDayPlan: (num(place.displayOrder) ?? 0) > 0,
    distanceMeters: num(place.distanceMeters),
    walkMinutes: num(place.walkMinutes),
    driveMinutes: num(place.driveMinutes),
    rating: num(place.rating),
    googleMapsUrl: text(place.googleMapsUrl),
    displayOrder: num(place.displayOrder),
    timeOfDay: num(place.timeOfDay),
  };
}

/**
 * A row in the shape create and edit both take.
 *
 * `displayOrder` is the place's step in the suggested day, passed in by the
 * caller: the guest app builds that itinerary from the places that HAVE one, so
 * a place the owner left out of the plan must be sent without it.
 */
export function nearbyPlacePayload(
  place: HotelNearbyPlace,
  displayOrder: number | undefined,
): NearbyPlacePayload {
  return {
    categoryId: place.categoryId,
    name: place.name.trim(),
    nameAR: text(place.nameAr),
    description: text(place.description),
    descriptionAR: text(place.descriptionAr),
    rating: num(place.rating),
    distanceMeters: num(place.distanceMeters),
    walkMinutes: num(place.walkMinutes),
    driveMinutes: num(place.driveMinutes),
    googleMapsUrl: text(place.googleMapsUrl),
    displayOrder,
    timeOfDay: num(place.timeOfDay),
  };
}

/** Everything about a place except its step in the day, compared separately. */
export function nearbyPlaceSignature(place: HotelNearbyPlace): string {
  return JSON.stringify([
    place.categoryId ?? null,
    place.name.trim(),
    place.nameAr?.trim() ?? '',
    place.description?.trim() ?? '',
    place.descriptionAr?.trim() ?? '',
    place.distanceMeters ?? null,
    place.walkMinutes ?? null,
    place.driveMinutes ?? null,
    place.rating ?? null,
    place.googleMapsUrl?.trim() ?? '',
    place.timeOfDay ?? null,
  ]);
}

/**
 * The rows worth sending: a place with no name is a row the owner started and
 * never finished, and a place with no category has no tab to appear under.
 */
export function nearbyRows(places: HotelNearbyPlace[] | undefined): HotelNearbyPlace[] {
  return (places ?? []).filter(
    (place) => place.name.trim().length > 0 && place.categoryId !== undefined,
  );
}

/**
 * The step number each place gets, keyed by its position in the list.
 *
 * Only the places the owner put in the day plan are numbered, and they are
 * numbered 1..n in list order — exactly what the guest app sorts the itinerary
 * by. Everything else is sent without a `displayOrder` and stays off the plan.
 */
export function dayPlanOrders(places: HotelNearbyPlace[]): Map<number, number> {
  const orders = new Map<number, number>();
  let step = 0;
  places.forEach((place, index) => {
    if (!place.inDayPlan) return;
    step += 1;
    orders.set(index, step);
  });
  return orders;
}

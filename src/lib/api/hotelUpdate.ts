import type { HotelDraft, RoomTypeDraft } from '../schemas/draft';
import type { HotelNearbyPlace } from '../schemas/hotel';
import type { HotelDetail, RoomTypeDetail } from '../schemas/hotelApi';
import type { LookupItem } from './lookups';
import {
  AMENITY_NAMES,
  BED_NAMES,
  BOARD_NAMES,
  CANCELLATION_RULES,
  CATEGORY_NAMES,
  ROOM_AMENITY_NAMES,
  VIEW_NAMES,
  resolver,
} from './catalogMap';
import { detailToDraft } from './hotelLoad';
import {
  buildCreateRoomTypeForm,
  buildEditHotelForm,
  buildEditRoomTypeForm,
  type EditRoomBedPayload,
  type RatePlanPayload,
} from './hotelForms';
import { hotelsApi } from './hotels';
import { childrenPolicyPayload, serviceRows, type SubmitLookups } from './hotelSubmit';
import {
  dayPlanOrders,
  nearbyPlacePayload,
  nearbyPlaceSignature,
  nearbyRows,
} from './nearbyPlaces';
import { parseBedConfig } from '../utils';

/* ---------------------------------------------------------------------------
 * Draft → the seven write endpoints an edit actually touches.
 *
 * There is no "save hotel" call. `edit-hotel` covers the hotel's own fields;
 * room types and rate plans are separate resources with their own create, edit
 * and delete endpoints. So saving is a diff: compare what was loaded against
 * what the owner now has, and issue only the calls that difference implies.
 *
 * Two consequences worth knowing before reading further:
 *
 *  - The update DTO for a rate plan has no `boardBasis`. The board a plan sells
 *    is immutable, so changing it is expressed as delete + create.
 *  - `coverPhoto` is a file upload. There is no way to promote a photo the
 *    server already holds, so choosing an existing photo as the cover is
 *    reported as unsupported rather than silently ignored.
 *
 * Calls run in sequence, not in parallel. Each one's outcome is recorded, so a
 * batch that half-succeeds says exactly which half — hiding a partial failure
 * behind one error message would leave the owner with no idea what saved.
 * ------------------------------------------------------------------------- */

export type EditStepKind =
  | 'hotel'
  | 'policies'
  | 'services'
  | 'childrenPolicy'
  | 'roomServices'
  | 'roomCreate'
  | 'roomEdit'
  | 'roomDelete'
  | 'planCreate'
  | 'planEdit'
  | 'planDelete'
  | 'nearbyCreate'
  | 'nearbyEdit'
  | 'nearbyDelete';

export type EditStep = {
  kind: EditStepKind;
  /** What the step acted on, for the owner to read — a room name, or the hotel. */
  subject: string;
  ok: boolean;
  error?: string;
};

export type EditResult = {
  ok: boolean;
  steps: EditStep[];
  /** Changes the API cannot express; the save succeeded without them. */
  warnings: string[];
};

const num = (v: number | undefined | null): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

const text = (v: string | undefined | null): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};

const isNew = (url: string): boolean => url.startsWith('data:');

async function toFile(dataUrl: string, name: string): Promise<File | undefined> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const extension = blob.type.split('/')[1]?.split('+')[0] || 'jpg';
    return new File([blob], `${name}.${extension}`, { type: blob.type || 'image/jpeg' });
  } catch {
    return undefined;
  }
}

async function filesFrom(urls: string[], prefix: string): Promise<File[]> {
  const files = await Promise.all(urls.map((url, index) => toFile(url, `${prefix}-${index + 1}`)));
  return files.filter((file): file is File => Boolean(file));
}

/**
 * Splits a draft's photo list into the three things the edit endpoints want:
 * a new cover file, files to add, and ids of server photos to drop.
 */
async function diffPhotos(
  next: string[],
  existing: Array<{ id: string; url: string }>,
  currentCover: string | undefined,
  prefix: string,
): Promise<{
  coverPhoto?: File;
  added: File[];
  removedIds: string[];
  coverUnsupported: boolean;
}> {
  const kept = new Set(next.filter((url) => !isNew(url)));
  const removedIds = existing.filter((photo) => !kept.has(photo.url)).map((photo) => photo.id);

  const [first, ...rest] = next;
  let coverPhoto: File | undefined;
  let coverUnsupported = false;
  let addable = next.filter(isNew);

  if (first && isNew(first)) {
    coverPhoto = await toFile(first, `${prefix}-cover`);
    addable = rest.filter(isNew);
  } else if (first && currentCover && first !== currentCover) {
    // An existing photo was moved to the front. `coverPhoto` only accepts a
    // file, so the server keeps the cover it has.
    coverUnsupported = true;
  }

  return { coverPhoto, added: await filesFrom(addable, prefix), removedIds, coverUnsupported };
}

/** Everything about a room except its rate plans, which are diffed separately. */
function roomSignature(room: RoomTypeDraft): string {
  return JSON.stringify({
    name: room.name.trim(),
    nameAr: text(room.nameAr),
    description: text(room.description),
    descriptionAr: text(room.descriptionAr),
    category: room.category,
    view: room.view,
    sizeM2: num(room.sizeM2),
    capacity: num(room.capacity),
    inventory: num(room.inventory),
    beds: parseBedConfig(room.bedConfig),
    amenities: [...room.amenities].sort(),
    photos: room.photos,
  });
}

/** `currencyId` is passed in: it can change without the plan itself changing. */
function planSignature(
  plan: RoomTypeDraft['ratePlans'][number],
  currencyId: number | undefined,
): string {
  return JSON.stringify({
    board: plan.boardBasis,
    currencyId,
    price: num(plan.pricePerNight),
    cancellation: plan.cancellation,
    refundable: plan.refundable,
  });
}

export async function applyHotelEdit(
  detail: HotelDetail,
  draft: HotelDraft,
  lookups: SubmitLookups,
  fallbackCurrency: string,
  /**
   * The hotel's nearby places as the server currently has them. Omitted — or
   * with `before` missing because that read failed — they are left untouched.
   */
  nearby?: { before?: HotelNearbyPlace[] },
): Promise<EditResult> {
  const steps: EditStep[] = [];
  const warnings: string[] = [];
  /** Rooms whose new plans could not be built; reported, never swallowed. */
  const incompletePlans: string[] = [];

  const amenityId = resolver(lookups.amenities, AMENITY_NAMES);
  const roomAmenityId = resolver(lookups.roomAmenities, ROOM_AMENITY_NAMES);
  const categoryId = resolver(lookups.roomCategory, CATEGORY_NAMES);
  const viewId = resolver(lookups.viewType, VIEW_NAMES);
  const bedId = resolver(lookups.bedType, BED_NAMES);
  const boardId = resolver(lookups.boardBasis, BOARD_NAMES);
  const draftCurrencyId = lookups.currencies?.find((c) => c.code === draft.currency)?.id;
  /** Set once `original` is known, below; read by `planBody`. */
  let currencyChanged = false;

  /** The API reads bed and board back as names; map a name to its id. */
  const idByName = (items: LookupItem[] | undefined) => {
    const table = new Map((items ?? []).map((item) => [item.name.trim().toLowerCase(), item.id]));
    return (value: string | null | undefined): number | undefined => {
      if (!value) return undefined;
      const direct = Number(value);
      if (Number.isInteger(direct) && direct > 0) return direct;
      return table.get(value.trim().toLowerCase());
    };
  };
  const bedIdFromName = idByName(lookups.bedType);
  const boardIdFromName = idByName(lookups.boardBasis);

  const policyId = (slug: string): number | undefined => {
    const rule = CANCELLATION_RULES[slug];
    if (!rule) return undefined;
    return lookups.cancellationPolicyType?.find(
      (item) => item.name.trim().toUpperCase() === rule.policyName,
    )?.id;
  };

  /** The hotel's own amenities. */
  const slugAmenityIds = (slugs: string[]): number[] =>
    slugs.flatMap((slug) => {
      const id = amenityId(slug);
      return id === undefined ? [] : [id];
    });

  /** A room's amenities — a different lookup, see SubmitLookups.roomAmenities. */
  const slugRoomAmenityIds = (slugs: string[]): number[] =>
    slugs.flatMap((slug) => {
      const id = roomAmenityId(slug);
      return id === undefined ? [] : [id];
    });

  const planBody = (plan: RoomTypeDraft['ratePlans'][number]): RatePlanPayload | undefined => {
    const board = boardId(plan.boardBasis);
    const price = num(plan.pricePerNight);
    if (board === undefined || price === undefined) return undefined;
    const preset = plan.cancellation || (plan.refundable ? 'free24h' : 'nonRefundable');
    const rule = CANCELLATION_RULES[preset];
    return {
      boardBasis: board,
      basePrice: price,
      // A plan keeps the currency it was priced in, UNLESS the owner changed
      // the hotel currency on the Basics step — that field used to be editable
      // and have no effect at all on an existing hotel.
      currencyId: currencyChanged ? draftCurrencyId : (plan.currencyId ?? draftCurrencyId),
      cancellationPolicyType: policyId(preset),
      freeCancellationHours: rule?.freeCancellationHours,
      freeCancellationDays: rule?.freeCancellationDays,
    };
  };

  /** Runs one call, recording the outcome instead of aborting the batch. */
  const run = async (kind: EditStepKind, subject: string, call: () => Promise<void>) => {
    try {
      await call();
      steps.push({ kind, subject, ok: true });
      return true;
    } catch (error) {
      steps.push({
        kind,
        subject,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  };

  const original = detailToDraft(detail, lookups, fallbackCurrency);
  // `original.currency` is read back off the plans, so this is a real change of
  // mind rather than the account default differing from what the hotel sells in.
  currencyChanged = Boolean(draftCurrencyId) && draft.currency !== original.currency;
  const originalRooms = new Map(detail.roomTypes.map((room) => [room.id, room]));
  const originalDraftRooms = new Map(original.roomTypes.map((room) => [room.id, room]));

  /* -- 1. the hotel's own fields -------------------------------------------- */

  const photos = await diffPhotos(
    draft.photos,
    detail.photos,
    detail.coverPhoto ?? undefined,
    'hotel',
  );
  if (photos.coverUnsupported) warnings.push('coverPhotoNeedsUpload');

  await run('hotel', draft.name.trim() || detail.name, () =>
    hotelsApi.editHotel(
      detail.id,
      buildEditHotelForm({
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
        amenityIds: slugAmenityIds(draft.amenities),
        coverPhoto: photos.coverPhoto,
        newPhotos: photos.added,
        photoIdsToRemove: photos.removedIds,
      }),
    ),
  );

  /* -- 1b. house rules ------------------------------------------------------
   * Their own endpoint: `edit-hotel` has no policies field. The call replaces
   * the whole set, so it only runs when the set actually differs — otherwise
   * every save would rewrite rules nobody touched.
   * ------------------------------------------------------------------------ */

  const ruleKey = (rules: Array<{ policyTypeId: number; allowed: boolean }>) =>
    JSON.stringify([...rules].sort((a, b) => a.policyTypeId - b.policyTypeId));

  if (ruleKey(draft.houseRules) !== ruleKey(original.houseRules)) {
    await run('policies', draft.name.trim() || detail.name, () =>
      hotelsApi.assignPolicies(detail.id, draft.houseRules),
    );
  }

  /* -- 1c. paid services ----------------------------------------------------
   * Same shape as house rules: their own endpoint, replaces the whole set, so
   * it only runs when the set differs.
   * ------------------------------------------------------------------------ */

  const serviceKey = (services: ReadonlyArray<{ serviceId: number; price?: number }>) =>
    JSON.stringify([...services].sort((a, b) => a.serviceId - b.serviceId));

  if (serviceKey(draft.services) !== serviceKey(original.services)) {
    await run('services', draft.name.trim() || detail.name, () =>
      hotelsApi.assignServices(detail.id, serviceRows(draft.services)),
    );
  }

  /* -- 1d. children policy --------------------------------------------------
   * Its own endpoint, and the server validates it hard (overlapping bands, age
   * ranges, which modes may carry a value). Only sent when it differs.
   * ------------------------------------------------------------------------ */

  const childKey = (policy: HotelDraft['childrenPolicy']) =>
    JSON.stringify({
      allowed: policy.childrenAllowed,
      min: policy.minChildAge,
      max: policy.maxChildAge,
      // A band without an ordinal sorts first; subtracting undefined gives
      // NaN, which made the comparison meaningless and the key unstable.
      rules: [...policy.rules].sort(
        (a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0) || a.minAge - b.minAge,
      ),
    });

  if (childKey(draft.childrenPolicy) !== childKey(original.childrenPolicy)) {
    const payload = childrenPolicyPayload(draft, lookups);
    const who = draft.name.trim() || detail.name;
    if (payload) {
      await run('childrenPolicy', who, () => hotelsApi.assignChildrenPolicy(detail.id, payload));
    } else {
      // A band whose pricing mode we cannot express: sending the rest would
      // delete it server-side, so nothing is sent and the owner is told.
      steps.push({ kind: 'childrenPolicy', subject: who, ok: false, error: 'childModeUnknown' });
    }
  }

  /* -- 2. rooms the owner removed ------------------------------------------- */

  const keptRoomIds = new Set(draft.roomTypes.map((room) => room.id));
  for (const room of detail.roomTypes) {
    if (keptRoomIds.has(room.id)) continue;
    await run('roomDelete', room.name, () => hotelsApi.deleteRoomType(room.id));
  }

  /* -- 3. rooms added, changed, or left alone ------------------------------- */

  for (const room of draft.roomTypes) {
    const before = originalRooms.get(room.id);

    if (!before) {
      // A room the wizard invented: create it whole, rate plans included.
      const roomPhotos = await filesFrom(room.photos.filter(isNew), 'room');
      const [cover, ...rest] = roomPhotos;
      await run('roomCreate', room.name, () =>
        hotelsApi.createRoomType(
          detail.id,
          buildCreateRoomTypeForm({
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
            amenityIds: slugRoomAmenityIds(room.amenities),
            // Sent with the create: the assign-services call below is keyed by
            // room-type id, which this room will not have until it exists.
            services: serviceRows(room.services),
            ratePlans: room.ratePlans.flatMap((plan) => {
              const body = planBody(plan);
              if (!body) {
                incompletePlans.push(room.name);
                return [];
              }
              return [body];
            }),
            coverPhoto: cover,
            photos: rest,
          }),
        ),
      );
      continue;
    }

    const beforeDraft = originalDraftRooms.get(room.id);
    if (!beforeDraft || roomSignature(room) !== roomSignature(beforeDraft)) {
      await editExistingRoom(room, before);
    }

    // Room services are addressed by room-type id, so they can only be
    // written for a room the server already has.
    if (serviceKey(room.services) !== serviceKey(beforeDraft?.services ?? [])) {
      await run('roomServices', room.name, () =>
        hotelsApi.assignRoomServices(room.id, serviceRows(room.services)),
      );
    }

    await diffRatePlans(room, before, beforeDraft);
  }

  for (const room of new Set(incompletePlans)) {
    steps.push({ kind: 'planCreate', subject: room, ok: false, error: 'ratePlanIncomplete' });
  }

  /* -- 4. nearby places ------------------------------------------------------
   * Their own three endpoints, and the hotel record does not carry them, so the
   * caller reads them back separately and hands the list in. When it could not
   * — the read failed — nothing here runs at all: creating against an unknown
   * "before" would duplicate every place the hotel already has.
   * ------------------------------------------------------------------------ */

  if (nearby?.before) {
    const before = nearby.before;
    const after = nearbyRows(draft.nearby);
    const kept = new Set(after.map((place) => place.id).filter(Boolean));

    for (const place of before) {
      if (!place.id || kept.has(place.id)) continue;
      const placeId = place.id;
      await run('nearbyDelete', place.name, () => hotelsApi.deleteNearbyPlace(placeId));
    }

    const beforeById = new Map(
      before.flatMap((place) => (place.id ? [[place.id, place] as const] : [])),
    );
    const orders = dayPlanOrders(after);

    for (const [index, place] of after.entries()) {
      const step = orders.get(index);
      const payload = nearbyPlacePayload(place, step);
      const prior = place.id ? beforeById.get(place.id) : undefined;

      if (!prior) {
        await run('nearbyCreate', place.name, () =>
          hotelsApi.createNearbyPlace(detail.id, payload),
        );
        continue;
      }

      const placeId = place.id as string;
      // The step counts as a change: it is what the guest app's suggested day
      // is built and ordered from.
      const moved = (prior.displayOrder ?? undefined) !== step;
      if (moved || nearbyPlaceSignature(place) !== nearbyPlaceSignature(prior)) {
        await run('nearbyEdit', place.name, () => hotelsApi.editNearbyPlace(placeId, payload));
      }
    }
  }

  return { ok: steps.every((step) => step.ok), steps, warnings };

  /* -- helpers that need the closures above --------------------------------- */

  async function editExistingRoom(room: RoomTypeDraft, before: RoomTypeDetail): Promise<void> {
    // Beds are matched by type: a row whose type the room already had keeps
    // that bed's id so the count is updated rather than a duplicate added.
    const spare = new Map<number, string[]>();
    for (const bed of before.beds) {
      const type = bedIdFromName(bed.bedType);
      if (type === undefined) continue;
      spare.set(type, [...(spare.get(type) ?? []), bed.id]);
    }

    const beds: EditRoomBedPayload[] = parseBedConfig(room.bedConfig).flatMap((row) => {
      const type = bedId(row.type);
      if (type === undefined) return [];
      const reused = spare.get(type)?.shift();
      return [{ bedId: reused, bedType: type, count: row.qty }];
    });
    const bedIdsToRemove = [...spare.values()].flat();

    const roomPhotos = await diffPhotos(
      room.photos,
      before.photos,
      before.coverPhoto ?? undefined,
      'room',
    );
    if (roomPhotos.coverUnsupported) warnings.push('coverPhotoNeedsUpload');

    await run('roomEdit', room.name, () =>
      hotelsApi.editRoomType(
        room.id,
        buildEditRoomTypeForm({
          name: room.name.trim(),
          nameAr: text(room.nameAr),
          description: text(room.description),
          descriptionAr: text(room.descriptionAr),
          roomCategory: categoryId(room.category),
          viewType: viewId(room.view),
          sizeSqm: num(room.sizeM2),
          baseOccupancy: num(room.capacity),
          totalUnits: num(room.inventory) ?? 1,
          beds,
          bedIdsToRemove,
          amenityIds: slugRoomAmenityIds(room.amenities),
          coverPhoto: roomPhotos.coverPhoto,
          newPhotos: roomPhotos.added,
          photoIdsToRemove: roomPhotos.removedIds,
        }),
      ),
    );
  }

  async function diffRatePlans(
    room: RoomTypeDraft,
    before: RoomTypeDetail,
    beforeDraft: RoomTypeDraft | undefined,
  ): Promise<void> {
    const beforePlans = new Map(before.ratePlans.map((plan) => [plan.id, plan]));
    const beforeDraftPlans = new Map((beforeDraft?.ratePlans ?? []).map((p) => [p.id, p]));
    const kept = new Set(room.ratePlans.map((plan) => plan.id));

    for (const plan of before.ratePlans) {
      if (kept.has(plan.id)) continue;
      await run('planDelete', room.name, () => hotelsApi.deleteRatePlan(plan.id));
    }

    for (const plan of room.ratePlans) {
      const body = planBody(plan);
      if (!body) {
        // A plan with no price (or a board the server no longer offers) cannot
        // be sent. Recording it as a failed step is what stops the screen
        // saying "saved" for something that never left the browser.
        steps.push({
          kind: 'planEdit',
          subject: room.name,
          ok: false,
          error: 'ratePlanIncomplete',
        });
        continue;
      }
      const existing = beforePlans.get(plan.id);

      if (!existing) {
        await run('planCreate', room.name, () => hotelsApi.createRatePlan(room.id, body));
        continue;
      }

      const wasDraft = beforeDraftPlans.get(plan.id);
      if (
        wasDraft &&
        planSignature(plan, body.currencyId) ===
          planSignature(wasDraft, wasDraft.currencyId ?? draftCurrencyId)
      )
        continue;

      // The board a plan sells cannot be updated, so a board change is a
      // different plan: drop this one and create its replacement.
      if (boardIdFromName(existing.boardBasis) !== body.boardBasis) {
        const removed = await run('planDelete', room.name, () => hotelsApi.deleteRatePlan(plan.id));
        if (removed) {
          await run('planCreate', room.name, () => hotelsApi.createRatePlan(room.id, body));
        }
        continue;
      }

      const { boardBasis, ...updatable } = body;
      void boardBasis;
      await run('planEdit', room.name, () => hotelsApi.editRatePlan(plan.id, updatable));
    }
  }
}

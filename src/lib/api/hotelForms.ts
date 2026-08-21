/* ---------------------------------------------------------------------------
 * multipart/form-data builders for the HotelManagement write endpoints.
 *
 * These types mirror the OpenAPI request bodies field-for-field and in the
 * API's own vocabulary (integer IDs, `totalUnits`, `sizeSqm`, binary files).
 * Translating the dashboard's slug-based draft into this shape is a separate
 * step — keeping the two apart means a change to either side is a change in
 * exactly one place.
 * ------------------------------------------------------------------------- */

export type HotelRoomBedPayload = {
  bedType: number;
  count: number;
};

export type RatePlanPayload = {
  boardBasis: number;
  basePrice: number;
  currencyId?: number;
  cancellationPolicyType?: number;
  freeCancellationHours?: number;
  freeCancellationDays?: number;
};

export type HotelRoomTypePayload = {
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  roomCategory?: number;
  viewType?: number;
  sizeSqm?: number;
  baseOccupancy?: number;
  totalUnits: number;
  beds?: HotelRoomBedPayload[];
  amenityIds?: number[];
  ratePlans?: RatePlanPayload[];
};

export type CreateHotelPayload = {
  managerId?: string;
  name: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  starRating?: number;
  checkInTime?: string;
  checkOutTime?: string;
  streetAddress: string;
  postalCode?: string;
  cityId?: number;
  area?: string;
  villageId?: number;
  latitude?: number;
  longitude?: number;
  amenityIds?: number[];
  roomTypes?: HotelRoomTypePayload[];
  cover?: File;
  photos?: File[];
};

export type EditHotelPayload = Omit<
  CreateHotelPayload,
  'managerId' | 'name' | 'streetAddress' | 'roomTypes' | 'cover' | 'photos'
> & {
  name?: string;
  streetAddress?: string;
  coverPhoto?: File;
  newPhotos?: File[];
  /** UUIDs of existing photos to drop. */
  photoIdsToRemove?: string[];
};

/* -- form encoding --------------------------------------------------------- */

function put(form: FormData, key: string, value: unknown): void {
  if (value === undefined || value === null || value === '') return;
  if (value instanceof File) {
    form.append(key, value);
    return;
  }
  if (typeof value === 'boolean') {
    form.append(key, value ? 'true' : 'false');
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return;
    form.append(key, String(value));
    return;
  }
  form.append(key, String(value));
}

/** Scalar arrays bind by repeating the key: `amenityIds=1&amenityIds=2`. */
function putAll(form: FormData, key: string, values: readonly unknown[] | undefined): void {
  for (const value of values ?? []) put(form, key, value);
}

/**
 * Object arrays bind by index: `roomTypes[0].name`. This is ASP.NET Core's
 * model-binding convention for complex form collections — the OpenAPI document
 * only says `style: form`, so this is the first thing to check against a live
 * endpoint if a create ever comes back with an empty roomTypes collection.
 */
function putObjects<T extends object>(
  form: FormData,
  key: string,
  items: readonly T[] | undefined,
  write: (form: FormData, prefix: string, item: T) => void,
): void {
  (items ?? []).forEach((item, index) => write(form, `${key}[${index}]`, item));
}

function writeRatePlan(form: FormData, prefix: string, plan: RatePlanPayload): void {
  put(form, `${prefix}.boardBasis`, plan.boardBasis);
  put(form, `${prefix}.basePrice`, plan.basePrice);
  put(form, `${prefix}.currencyId`, plan.currencyId);
  put(form, `${prefix}.cancellationPolicyType`, plan.cancellationPolicyType);
  put(form, `${prefix}.freeCancellationHours`, plan.freeCancellationHours);
  put(form, `${prefix}.freeCancellationDays`, plan.freeCancellationDays);
}

function writeBed(form: FormData, prefix: string, bed: HotelRoomBedPayload): void {
  put(form, `${prefix}.bedType`, bed.bedType);
  put(form, `${prefix}.count`, bed.count);
}

function writeRoomType(form: FormData, prefix: string, room: HotelRoomTypePayload): void {
  put(form, `${prefix}.name`, room.name);
  put(form, `${prefix}.nameAr`, room.nameAr);
  put(form, `${prefix}.description`, room.description);
  put(form, `${prefix}.descriptionAr`, room.descriptionAr);
  put(form, `${prefix}.roomCategory`, room.roomCategory);
  put(form, `${prefix}.viewType`, room.viewType);
  put(form, `${prefix}.sizeSqm`, room.sizeSqm);
  put(form, `${prefix}.baseOccupancy`, room.baseOccupancy);
  put(form, `${prefix}.totalUnits`, room.totalUnits);
  putAll(form, `${prefix}.amenityIds`, room.amenityIds);
  putObjects(form, `${prefix}.beds`, room.beds, writeBed);
  putObjects(form, `${prefix}.ratePlans`, room.ratePlans, writeRatePlan);
}

/** Fields shared by the create and edit forms. */
function writeCommon(form: FormData, payload: CreateHotelPayload | EditHotelPayload): void {
  put(form, 'name', payload.name);
  put(form, 'nameAr', payload.nameAr);
  put(form, 'description', payload.description);
  put(form, 'descriptionAr', payload.descriptionAr);
  put(form, 'starRating', payload.starRating);
  put(form, 'checkInTime', payload.checkInTime);
  put(form, 'checkOutTime', payload.checkOutTime);
  put(form, 'streetAddress', payload.streetAddress);
  put(form, 'postalCode', payload.postalCode);
  put(form, 'cityId', payload.cityId);
  put(form, 'area', payload.area);
  put(form, 'villageId', payload.villageId);
  put(form, 'latitude', payload.latitude);
  put(form, 'longitude', payload.longitude);
  putAll(form, 'amenityIds', payload.amenityIds);
}

/** POST /api/hotels */
export function buildCreateHotelForm(payload: CreateHotelPayload): FormData {
  const form = new FormData();
  put(form, 'managerId', payload.managerId);
  writeCommon(form, payload);
  putObjects(form, 'roomTypes', payload.roomTypes, writeRoomType);
  put(form, 'cover', payload.cover);
  putAll(form, 'photos', payload.photos);
  return form;
}

/**
 * POST /api/hotels/{id}/edit-hotel
 *
 * Note the field names differ from create: the cover is `coverPhoto`, added
 * files are `newPhotos`, and room types are NOT part of this call — they have
 * their own create/edit/delete endpoints.
 */
export function buildEditHotelForm(payload: EditHotelPayload): FormData {
  const form = new FormData();
  writeCommon(form, payload);
  put(form, 'coverPhoto', payload.coverPhoto);
  putAll(form, 'newPhotos', payload.newPhotos);
  putAll(form, 'photoIdsToRemove', payload.photoIdsToRemove);
  return form;
}

/* -- room types ------------------------------------------------------------ */

export type RoomTypeFields = {
  name?: string;
  nameAr?: string;
  description?: string;
  descriptionAr?: string;
  roomCategory?: number;
  viewType?: number;
  sizeSqm?: number;
  baseOccupancy?: number;
  totalUnits?: number;
  amenityIds?: number[];
};

/** On edit a bed carries its id so the server updates rather than duplicates. */
export type EditRoomBedPayload = HotelRoomBedPayload & { bedId?: string };

/** POST /api/hotels/{hotelId}/room-types/create */
export function buildCreateRoomTypeForm(
  room: RoomTypeFields & {
    beds?: HotelRoomBedPayload[];
    ratePlans?: RatePlanPayload[];
    coverPhoto?: File;
    photos?: File[];
  },
): FormData {
  const form = new FormData();
  writeRoomTypeFields(form, room);
  putObjects(form, 'beds', room.beds, writeBed);
  putObjects(form, 'ratePlans', room.ratePlans, writeRatePlan);
  put(form, 'coverPhoto', room.coverPhoto);
  putAll(form, 'photos', room.photos);
  return form;
}

/**
 * POST /api/room-types/{roomTypeId}/edit
 *
 * Note this endpoint does NOT take rate plans — those have their own create,
 * edit and delete calls.
 */
export function buildEditRoomTypeForm(
  room: RoomTypeFields & {
    beds?: EditRoomBedPayload[];
    bedIdsToRemove?: string[];
    coverPhoto?: File;
    newPhotos?: File[];
    photoIdsToRemove?: string[];
  },
): FormData {
  const form = new FormData();
  writeRoomTypeFields(form, room);
  (room.beds ?? []).forEach((bed, index) => {
    const prefix = `beds[${index}]`;
    put(form, `${prefix}.bedId`, bed.bedId);
    put(form, `${prefix}.bedType`, bed.bedType);
    put(form, `${prefix}.count`, bed.count);
  });
  putAll(form, 'bedIdsToRemove', room.bedIdsToRemove);
  put(form, 'coverPhoto', room.coverPhoto);
  putAll(form, 'newPhotos', room.newPhotos);
  putAll(form, 'photoIdsToRemove', room.photoIdsToRemove);
  return form;
}

function writeRoomTypeFields(form: FormData, room: RoomTypeFields): void {
  put(form, 'name', room.name);
  put(form, 'nameAr', room.nameAr);
  put(form, 'description', room.description);
  put(form, 'descriptionAr', room.descriptionAr);
  put(form, 'roomCategory', room.roomCategory);
  put(form, 'viewType', room.viewType);
  put(form, 'sizeSqm', room.sizeSqm);
  put(form, 'baseOccupancy', room.baseOccupancy);
  put(form, 'totalUnits', room.totalUnits);
  putAll(form, 'amenityIds', room.amenityIds);
}

import { hotelDraftSchema, type HotelDraft } from '../schemas/draft';

/* ---------------------------------------------------------------------------
 * Wizard draft persistence.
 *
 * The API has no draft endpoint — `POST /api/hotels` takes the whole hotel in
 * one shot — so a half-filled wizard has nowhere on the server to live. Drafts
 * are therefore kept in this browser only: closing the tab loses nothing, but
 * the draft will not follow the owner to another device.
 *
 * (If a `/api/hotels/draft` endpoint ever lands, this module is the only thing
 * that needs to change.)
 * ------------------------------------------------------------------------- */

const PREFIX = 'houseiana.draft.';

/** New hotels share one slot, so a reload resumes rather than starting over. */
export const NEW_DRAFT_KEY = 'new';

function keyFor(id: string): string {
  return `${PREFIX}${id}`;
}

export function loadDraft(id: string): HotelDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(keyFor(id));
    if (!raw) return null;
    const parsed = hotelDraftSchema.safeParse(JSON.parse(raw));
    // A draft written by an older shape is not worth trying to rescue.
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveDraft(id: string, draft: HotelDraft): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(keyFor(id), JSON.stringify(draft));
    return true;
  } catch {
    // Almost always the 5 MB quota, blown by base64 photos. The wizard keeps
    // working in memory; only persistence is lost.
    return false;
  }
}

export function clearDraft(id: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(keyFor(id));
}

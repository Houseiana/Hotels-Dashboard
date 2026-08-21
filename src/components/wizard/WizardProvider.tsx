'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  draftToHotel,
  emptyDraft,
  STEP_SCHEMAS,
  WIZARD_STEPS,
  type HotelDraft,
  type RatePlanDraft,
  type RoomTypeDraft,
  type WizardStep,
} from '@/lib/schemas/draft';
import { hotelSchema, type Hotel } from '@/lib/schemas/hotel';
import { collectIssues, issueMap, validate, type FieldIssue } from '@/lib/schemas/errors';
import { useCreateHotel } from '@/lib/query/hooks';
import { useLookup, useCurrencyLookup } from '@/lib/query/lookups';
import { applyHotelEdit, type EditResult } from '@/lib/api/hotelUpdate';
import type { HotelDetail } from '@/lib/schemas/hotelApi';
import { queryKeys } from '@/lib/query/keys';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/components/providers/SessionProvider';
import { draftToCreateForm } from '@/lib/api/hotelSubmit';
import { clearDraft, loadDraft, saveDraft, NEW_DRAFT_KEY } from '@/lib/wizard/draftStore';
import { makeId } from '@/lib/utils';
import { BOARD_INCLUDES_BREAKFAST, DEFAULT_CURRENCY } from '@/lib/catalogs';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved';

type WizardContextValue = {
  draft: HotelDraft;
  isNew: boolean;
  step: WizardStep;
  stepIndex: number;
  saveState: SaveState;
  savedAt: number | null;
  /** Steps the owner has tried to leave — gates when errors become visible. */
  attempted: Record<WizardStep, boolean>;
  issuesFor: (step: WizardStep) => FieldIssue[];
  errorsFor: (step: WizardStep) => Record<string, string>;
  publishIssues: FieldIssue[];
  canPublish: boolean;

  update: (patch: Partial<HotelDraft>) => void;
  goTo: (step: WizardStep) => void;
  next: () => void;
  back: () => void;

  /** Returns the new room's id so callers can open and highlight it. */
  addRoom: () => string;
  updateRoom: (index: number, patch: Partial<RoomTypeDraft>) => void;
  removeRoom: (index: number) => void;
  addRatePlan: (roomIndex: number) => void;
  updateRatePlan: (roomIndex: number, planIndex: number, patch: Partial<RatePlanDraft>) => void;
  removeRatePlan: (roomIndex: number, planIndex: number) => void;

  toHotel: () => Hotel;
  /** Flush the draft to local storage immediately. */
  saveDraftNow: () => void;
  /** Create the hotel on the API; resolves to its new id, or null if unknown. */
  submit: () => Promise<string | null>;
  /**
   * Saves an existing hotel by diffing it against what was loaded. Null when
   * this wizard is creating rather than editing.
   */
  saveEdit: (() => Promise<EditResult>) | null;
  isSaving: boolean;
};

const WizardContext = createContext<WizardContextValue | null>(null);

const AUTOSAVE_DELAY = 800;

function newRoom(): RoomTypeDraft {
  return {
    id: makeId('rt'),
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    category: 'standard',
    view: 'city',
    capacity: 2,
    beds: 1,
    bedConfig: '1xdouble',
    bathrooms: 1,
    sizeM2: undefined,
    inventory: 1,
    pricePerNight: undefined,
    amenities: [],
    photos: [],
    ratePlans: [newRatePlan()],
  };
}

function newRatePlan(): RatePlanDraft {
  return {
    id: makeId('rp'),
    boardBasis: 'roomOnly',
    pricePerNight: undefined,
    refundable: true,
    breakfastIncluded: false,
  };
}

export function WizardProvider({
  initialDraft,
  initialDetail,
  defaultCurrency,
  initialStep,
  children,
}: {
  /** An existing hotel loaded from the API; undefined for /hotels/new. */
  initialDraft?: HotelDraft;
  /** The same hotel in the API's own shape — saving diffs against it. */
  initialDetail?: HotelDetail;
  defaultCurrency?: string;
  initialStep?: WizardStep;
  children: ReactNode;
}) {
  const createHotel = useCreateHotel();
  const { managerId } = useSession();
  const queryClient = useQueryClient();

  /* Every server vocabulary the submit mapper needs to turn slugs into ids. */
  const amenities = useLookup('amenities');
  const roomCategory = useLookup('roomCategory');
  const viewType = useLookup('viewType');
  const bedType = useLookup('bedType');
  const boardBasis = useLookup('boardBasis');
  const cancellationPolicyType = useLookup('cancellationPolicyType');
  const currencies = useCurrencyLookup();

  const lookups = useMemo(
    () => ({
      amenities: amenities.data,
      roomCategory: roomCategory.data,
      viewType: viewType.data,
      bedType: bedType.data,
      boardBasis: boardBasis.data,
      cancellationPolicyType: cancellationPolicyType.data,
      currencies: currencies.data,
    }),
    [
      amenities.data,
      roomCategory.data,
      viewType.data,
      bedType.data,
      boardBasis.data,
      cancellationPolicyType.data,
      currencies.data,
    ],
  );

  /** Which local-storage slot this wizard owns. */
  const draftKey = initialDraft?.id ?? NEW_DRAFT_KEY;

  const [draft, setDraft] = useState<HotelDraft>(() => {
    // A draft in progress wins over the server copy — it is strictly newer.
    const stored = loadDraft(draftKey);
    if (stored) return stored;
    return initialDraft ?? emptyDraft(makeId('htl'), defaultCurrency ?? DEFAULT_CURRENCY);
  });

  const [step, setStep] = useState<WizardStep>(initialStep ?? 'basics');
  const [attempted, setAttempted] = useState<Record<WizardStep, boolean>>(
    () => Object.fromEntries(WIZARD_STEPS.map((s) => [s, false])) as Record<WizardStep, boolean>,
  );
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // Stays null until this session actually writes something — claiming "saved
  // just now" for a hotel loaded from the server would be a lie.
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const isNew = !initialDraft;
  const stepIndex = WIZARD_STEPS.indexOf(step);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The autosave timer fires outside render, so it needs the newest draft
  // without re-arming on every keystroke.
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  /* Debounced autosave to LOCAL STORAGE. The API takes a whole hotel in one
   * request and has no draft endpoint, so a half-filled wizard has nowhere on
   * the server to live — see src/lib/wizard/draftStore.ts. */
  useEffect(() => {
    if (saveState !== 'dirty') return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const ok = saveDraft(draftKey, latest.current);
      setSaveState(ok ? 'saved' : 'dirty');
      if (ok) setSavedAt(Date.now());
    }, AUTOSAVE_DELAY);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, saveState, draftKey]);

  const update = useCallback((patch: Partial<HotelDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setSaveState('dirty');
  }, []);

  const mutateRooms = useCallback(
    (fn: (rooms: RoomTypeDraft[]) => RoomTypeDraft[]) => {
      setDraft((current) => ({ ...current, roomTypes: fn(current.roomTypes) }));
      setSaveState('dirty');
    },
    [],
  );

  const addRoom = useCallback(() => {
    const room = newRoom();
    mutateRooms((rooms) => [...rooms, room]);
    return room.id;
  }, [mutateRooms]);

  const updateRoom = useCallback(
    (index: number, patch: Partial<RoomTypeDraft>) =>
      mutateRooms((rooms) => rooms.map((r, i) => (i === index ? { ...r, ...patch } : r))),
    [mutateRooms],
  );

  const removeRoom = useCallback(
    (index: number) => mutateRooms((rooms) => rooms.filter((_, i) => i !== index)),
    [mutateRooms],
  );

  const addRatePlan = useCallback(
    (roomIndex: number) =>
      mutateRooms((rooms) =>
        rooms.map((r, i) =>
          i === roomIndex ? { ...r, ratePlans: [...r.ratePlans, newRatePlan()] } : r,
        ),
      ),
    [mutateRooms],
  );

  const updateRatePlan = useCallback(
    (roomIndex: number, planIndex: number, patch: Partial<RatePlanDraft>) =>
      mutateRooms((rooms) =>
        rooms.map((room, i) => {
          if (i !== roomIndex) return room;
          return {
            ...room,
            ratePlans: room.ratePlans.map((plan, j) => {
              if (j !== planIndex) return plan;
              const next = { ...plan, ...patch };
              // Board basis is the single input; breakfastIncluded is derived
              // from it so the two can never disagree in the shared model.
              if (patch.boardBasis) {
                next.breakfastIncluded = BOARD_INCLUDES_BREAKFAST[patch.boardBasis];
              }
              return next;
            }),
          };
        }),
      ),
    [mutateRooms],
  );

  const removeRatePlan = useCallback(
    (roomIndex: number, planIndex: number) =>
      mutateRooms((rooms) =>
        rooms.map((room, i) =>
          i === roomIndex
            ? { ...room, ratePlans: room.ratePlans.filter((_, j) => j !== planIndex) }
            : room,
        ),
      ),
    [mutateRooms],
  );

  const stepIssues = useMemo(() => {
    const map = {} as Record<WizardStep, FieldIssue[]>;
    for (const s of WIZARD_STEPS) {
      if (s === 'review') continue;
      map[s] = validate(STEP_SCHEMAS[s], draft).issues;
    }
    map.review = [];
    return map;
  }, [draft]);

  // Step 6 runs the real shared-model schema — the exact gate the guest app uses.
  const publishIssues = useMemo(() => {
    const result = hotelSchema.safeParse({ ...draftToHotel(draft), status: 'active' });
    return result.success ? [] : collectIssues(result.error);
  }, [draft]);

  const issuesFor = useCallback(
    (s: WizardStep) => (s === 'review' ? publishIssues : (stepIssues[s] ?? [])),
    [stepIssues, publishIssues],
  );

  const errorsFor = useCallback(
    (s: WizardStep) => (attempted[s] ? issueMap(issuesFor(s)) : {}),
    [attempted, issuesFor],
  );

  const goTo = useCallback((next: WizardStep) => {
    setStep(next);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const next = useCallback(() => {
    setAttempted((current) => ({ ...current, [step]: true }));
    const target = WIZARD_STEPS[Math.min(WIZARD_STEPS.length - 1, stepIndex + 1)];
    goTo(target);
  }, [step, stepIndex, goTo]);

  const back = useCallback(() => {
    goTo(WIZARD_STEPS[Math.max(0, stepIndex - 1)]);
  }, [stepIndex, goTo]);

  const toHotel = useCallback(() => draftToHotel(latest.current), []);

  /** Flushes the pending debounce so nothing is lost on navigate. */
  const saveDraftNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const ok = saveDraft(draftKey, latest.current);
    setSaveState(ok ? 'saved' : 'dirty');
    if (ok) setSavedAt(Date.now());
  }, [draftKey]);

  /**
   * Sends the whole hotel to `POST /api/hotels` in one multipart request and
   * returns its new id, or null when the API accepted it but the follow-up
   * lookup could not identify which row it made.
   */
  const submit = useCallback(async (): Promise<string | null> => {
    if (timer.current) clearTimeout(timer.current);
    const form = await draftToCreateForm(latest.current, managerId, lookups);
    const id = await createHotel.mutateAsync({
      form,
      managerId,
      name: latest.current.name,
    });
    // Only drop the local draft once the server has definitely taken it.
    clearDraft(draftKey);
    return id;
  }, [createHotel, draftKey, managerId, lookups]);

  /**
   * Every vocabulary the diff resolves slugs through. Saving before these load
   * would resolve each one to `undefined` and send an edit that strips the
   * hotel's category, view and amenities — so saving waits for them.
   */
  const lookupsReady =
    Boolean(lookups.amenities?.length) &&
    Boolean(lookups.roomCategory?.length) &&
    Boolean(lookups.viewType?.length) &&
    Boolean(lookups.bedType?.length) &&
    Boolean(lookups.boardBasis?.length) &&
    Boolean(lookups.cancellationPolicyType?.length);

  const [isEditing, setIsEditing] = useState(false);

  const saveEdit = useCallback(async (): Promise<EditResult> => {
    if (!initialDetail) throw new Error('saveEdit called on a wizard that is creating');
    if (timer.current) clearTimeout(timer.current);
    setIsEditing(true);
    try {
      const result = await applyHotelEdit(
        initialDetail,
        latest.current,
        lookups,
        defaultCurrency ?? DEFAULT_CURRENCY,
      );
      // A partial failure leaves the local draft in place: it is the only copy
      // of the changes that did not reach the server.
      if (result.ok) clearDraft(draftKey);
      await queryClient.invalidateQueries({ queryKey: queryKeys.hotels.all });
      return result;
    } finally {
      setIsEditing(false);
    }
  }, [initialDetail, lookups, defaultCurrency, draftKey, queryClient]);

  const value = useMemo<WizardContextValue>(
    () => ({
      draft,
      isNew,
      step,
      stepIndex,
      saveState,
      savedAt,
      attempted,
      issuesFor,
      errorsFor,
      publishIssues,
      canPublish: publishIssues.length === 0,
      update,
      goTo,
      next,
      back,
      addRoom,
      updateRoom,
      removeRoom,
      addRatePlan,
      updateRatePlan,
      removeRatePlan,
      toHotel,
      saveDraftNow,
      submit,
      saveEdit: initialDetail && lookupsReady ? saveEdit : null,
      isSaving: createHotel.isPending || isEditing,
    }),
    [
      draft,
      isNew,
      step,
      stepIndex,
      saveState,
      savedAt,
      attempted,
      issuesFor,
      errorsFor,
      publishIssues,
      update,
      goTo,
      next,
      back,
      addRoom,
      updateRoom,
      removeRoom,
      addRatePlan,
      updateRatePlan,
      removeRatePlan,
      toHotel,
      saveDraftNow,
      submit,
      saveEdit,
      initialDetail,
      lookupsReady,
      isEditing,
      createHotel.isPending,
    ],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) throw new Error('useWizard must be used inside WizardProvider');
  return context;
}

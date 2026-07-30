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
  hotelToDraft,
  STEP_SCHEMAS,
  WIZARD_STEPS,
  type HotelDraft,
  type RatePlanDraft,
  type RoomTypeDraft,
  type WizardStep,
} from '@/lib/schemas/draft';
import { hotelSchema, type Hotel } from '@/lib/schemas/hotel';
import { collectIssues, issueMap, validate, type FieldIssue } from '@/lib/schemas/errors';
import { useSaveHotel } from '@/lib/query/hooks';
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
  saveNow: (status?: Hotel['status']) => Promise<Hotel>;
  isSaving: boolean;
};

const WizardContext = createContext<WizardContextValue | null>(null);

const NEW_DRAFT_KEY = 'houseiana.wizard.newDraftId';
const AUTOSAVE_DELAY = 1200;

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
  hotel,
  defaultCurrency,
  initialStep,
  children,
}: {
  /** Undefined for /hotels/new. */
  hotel?: Hotel;
  defaultCurrency?: string;
  initialStep?: WizardStep;
  children: ReactNode;
}) {
  const saveHotel = useSaveHotel();

  const [draft, setDraft] = useState<HotelDraft>(() => {
    if (hotel) return hotelToDraft(hotel);
    // Resuming /hotels/new after a reload must land on the same draft record,
    // not orphan the previous one.
    const stored =
      typeof window !== 'undefined' ? window.sessionStorage.getItem(NEW_DRAFT_KEY) : null;
    const id = stored ?? makeId('htl');
    if (typeof window !== 'undefined' && !stored) {
      window.sessionStorage.setItem(NEW_DRAFT_KEY, id);
    }
    return emptyDraft(id, defaultCurrency ?? DEFAULT_CURRENCY);
  });

  const [step, setStep] = useState<WizardStep>(initialStep ?? 'basics');
  const [attempted, setAttempted] = useState<Record<WizardStep, boolean>>(
    () => Object.fromEntries(WIZARD_STEPS.map((s) => [s, false])) as Record<WizardStep, boolean>,
  );
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // Stays null until this session actually writes something — claiming "saved
  // just now" for a hotel loaded from the server would be a lie.
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const isNew = !hotel;
  const stepIndex = WIZARD_STEPS.indexOf(step);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The autosave timer fires outside render, so it needs the newest draft
  // without re-arming on every keystroke.
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const persist = useCallback(
    async (value: HotelDraft, status?: Hotel['status']) => {
      const payload = { ...draftToHotel(value), status: status ?? value.status };
      setSaveState('saving');
      const saved = await saveHotel.mutateAsync(payload);
      setSaveState('saved');
      setSavedAt(Date.now());
      return saved;
    },
    [saveHotel],
  );

  /* Debounced draft autosave. A nameless draft is not worth a record yet, so
   * nothing is written until the hotel has at least a name. */
  useEffect(() => {
    if (saveState !== 'dirty') return;
    if (!draft.name.trim()) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void persist(latest.current).catch(() => setSaveState('dirty'));
    }, AUTOSAVE_DELAY);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, saveState, persist]);

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

  const saveNow = useCallback(
    async (status?: Hotel['status']) => {
      if (timer.current) clearTimeout(timer.current);
      const saved = await persist(latest.current, status);
      if (status) setDraft((current) => ({ ...current, status }));
      if (isNew && typeof window !== 'undefined') {
        window.sessionStorage.removeItem(NEW_DRAFT_KEY);
      }
      return saved;
    },
    [persist, isNew],
  );

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
      saveNow,
      isSaving: saveHotel.isPending,
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
      saveNow,
      saveHotel.isPending,
    ],
  );

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) throw new Error('useWizard must be used inside WizardProvider');
  return context;
}

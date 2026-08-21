'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useHotelList } from '@/lib/query/hooks';
import { useSession } from './SessionProvider';
import type { HotelListItem } from '@/lib/schemas/hotelApi';

const STORAGE_KEY = 'houseiana.activeHotel';

/** Enough for a switcher; the Hotels screen does the real paging. */
const SWITCHER_LIMIT = 100;

type HotelScope = {
  /** undefined = the "All hotels" scope. */
  hotelId: string | undefined;
  hotel: HotelListItem | undefined;
  hotels: HotelListItem[];
  isPending: boolean;
  /**
   * False until the persisted scope has been read back from localStorage.
   * Screens that behave differently for "one hotel" and "all hotels" must wait
   * for this, or they fire the all-hotels request before the stored hotel has
   * been restored.
   */
  isRestored: boolean;
  setHotelId: (id: string | undefined) => void;
};

const HotelScopeContext = createContext<HotelScope | null>(null);

/** The hotel switcher in the top bar drives every screen through this scope. */
export function HotelScopeProvider({ children }: { children: ReactNode }) {
  const { managerId, isReady } = useSession();
  const [hotelId, setHotelIdState] = useState<string | undefined>(undefined);
  const [isRestored, setIsRestored] = useState(false);

  // This provider also wraps the sign-in page, where there is no session at
  // all — without the managerId gate it would fire an unauthenticated request
  // on every visit to the login screen.
  const { data, isPending } = useHotelList(
    { page: 1, limit: SWITCHER_LIMIT },
    { enabled: isReady && Boolean(managerId) },
  );
  const hotels = useMemo(() => data?.items ?? [], [data]);

  // localStorage cannot be read during render (it does not exist on the
  // server), so the persisted scope is restored on mount.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setHotelIdState(stored);
    setIsRestored(true);
  }, []);

  const setHotelId = useCallback((id: string | undefined) => {
    setHotelIdState(id);
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<HotelScope>(() => {
    // A hotel deleted elsewhere must not leave the app pinned to it: resolve the
    // scope against the current list rather than storing a correction.
    const hotel = hotels.find((h) => h.id === hotelId);
    return {
      hotelId: hotel ? hotelId : undefined,
      hotel,
      hotels,
      isPending,
      isRestored,
      setHotelId,
    };
  }, [hotelId, hotels, isPending, isRestored, setHotelId]);

  return <HotelScopeContext.Provider value={value}>{children}</HotelScopeContext.Provider>;
}

export function useHotelScope(): HotelScope {
  const context = useContext(HotelScopeContext);
  if (!context) throw new Error('useHotelScope must be used inside HotelScopeProvider');
  return context;
}

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
import { useHotels } from '@/lib/query/hooks';
import type { Hotel } from '@/lib/schemas/hotel';

const STORAGE_KEY = 'houseiana.activeHotel';

type HotelScope = {
  /** undefined = the "All hotels" scope. */
  hotelId: string | undefined;
  hotel: Hotel | undefined;
  hotels: Hotel[];
  isPending: boolean;
  setHotelId: (id: string | undefined) => void;
};

const HotelScopeContext = createContext<HotelScope | null>(null);

/** The hotel switcher in the top bar drives every screen through this scope. */
export function HotelScopeProvider({ children }: { children: ReactNode }) {
  const { data: hotels, isPending } = useHotels();
  const [hotelId, setHotelIdState] = useState<string | undefined>(undefined);

  // localStorage cannot be read during render (it does not exist on the server),
  // so the persisted scope is restored on mount. The one extra render this costs
  // is deliberate.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setHotelIdState(stored);
  }, []);

  const setHotelId = useCallback((id: string | undefined) => {
    setHotelIdState(id);
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<HotelScope>(() => {
    // A hotel deleted elsewhere must not leave the app pinned to it: resolve the
    // scope against the current list rather than storing a correction.
    const hotel = hotels?.find((h) => h.id === hotelId);
    return {
      hotelId: hotel ? hotelId : undefined,
      hotel,
      hotels: hotels ?? [],
      isPending,
      setHotelId,
    };
  }, [hotelId, hotels, isPending, setHotelId]);

  return <HotelScopeContext.Provider value={value}>{children}</HotelScopeContext.Provider>;
}

export function useHotelScope(): HotelScope {
  const context = useContext(HotelScopeContext);
  if (!context) throw new Error('useHotelScope must be used inside HotelScopeProvider');
  return context;
}

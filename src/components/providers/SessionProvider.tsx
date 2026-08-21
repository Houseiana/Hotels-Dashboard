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
import { authApi, type Credentials } from '@/lib/api/auth';
import {
  clearSession,
  loadSession,
  saveSession,
  type Session,
  type SessionUser,
} from '@/lib/auth/session';

/**
 * Holds the signed-in user for the UI. The API layer does NOT read the token
 * from here — it reads the cookie directly (see src/lib/api/config.ts), so a
 * request can never outrun this provider's mount effect.
 */
type SessionContextValue = {
  user: SessionUser | null;
  /** The `managerId` every HotelManagement endpoint requires. */
  managerId: string | undefined;
  /** False until the cookie has been read on mount. */
  isReady: boolean;
  signIn: (credentials: Credentials) => Promise<void>;
  signOut: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  // The cookie cannot be read during render (there is no document on the
  // server), so the session is restored on mount.
  useEffect(() => {
    const restored = loadSession();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(restored);
    setIsReady(true);
  }, []);

  const signIn = useCallback(async (credentials: Credentials) => {
    const next = await authApi.login(credentials);
    saveSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      user: session?.user ?? null,
      managerId: session?.user.id,
      isReady,
      signIn,
      signOut,
    }),
    [session, isReady, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}

/**
 * The manager id on its own — the argument almost every hotel query needs.
 * Returns undefined until the session has been restored.
 */
export function useManagerId(): string | undefined {
  return useSession().managerId;
}

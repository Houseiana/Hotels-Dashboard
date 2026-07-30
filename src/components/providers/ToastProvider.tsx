'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; tone: ToastTone };

const ToastContext = createContext<{
  toast: (message: string, tone?: ToastTone) => void;
} | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      nextId += 1;
      const id = nextId;
      setToasts((current) => [...current, { id, message, tone }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 end-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'fade-in pointer-events-auto flex items-start gap-2.5 rounded-[10px] border p-3 shadow-[var(--shadow-pop)]',
              t.tone === 'success' && 'border-ok/30 bg-ok-soft text-ok',
              t.tone === 'error' && 'border-danger/30 bg-danger-soft text-danger',
              t.tone === 'info' && 'border-info/30 bg-info-soft text-info',
            )}
          >
            {t.tone === 'success' ? (
              <CheckCircle2 className="mt-px size-4 shrink-0" />
            ) : t.tone === 'error' ? (
              <TriangleAlert className="mt-px size-4 shrink-0" />
            ) : (
              <Info className="mt-px size-4 shrink-0" />
            )}
            <span className="flex-1 text-[13px] font-medium leading-snug text-ink">
              {t.message}
            </span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-me-1 -mt-1 rounded p-1 text-faint transition hover:text-ink"
              aria-label="dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider');
  return context.toast;
}

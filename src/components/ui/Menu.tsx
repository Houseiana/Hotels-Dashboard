'use client';

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';

/**
 * Minimal popover menu: closes on outside click, Escape and item activation.
 * Anchored to the inline start/end so it mirrors correctly under RTL.
 */
export function Menu({
  trigger,
  align = 'start',
  width = 'w-56',
  children,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  align?: 'start' | 'end';
  width?: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open ? (
        <div
          role="menu"
          className={cn(
            'fade-in absolute top-[calc(100%+6px)] z-40 overflow-hidden rounded-[10px] border border-line bg-surface p-1 shadow-[var(--shadow-pop)]',
            align === 'start' ? 'start-0' : 'end-0',
            width,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      ) : null}
    </div>
  );
}

export function MenuItem({
  onClick,
  active,
  danger,
  icon,
  children,
}: {
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-start text-[13px] font-medium transition-colors',
        danger ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-surface-2',
        active && 'bg-accent-soft text-accent-ink',
      )}
    >
      {icon ? <span className="shrink-0 text-faint">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-bold uppercase tracking-[.07em] text-faint">
      {children}
    </p>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-line" />;
}

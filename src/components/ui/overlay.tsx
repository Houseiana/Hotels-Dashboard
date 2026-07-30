'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from './primitives';
import { cn } from '@/lib/utils';

function useDismissOnEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  footer,
  size = 'md',
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  children: ReactNode;
}) {
  const t = useTranslations('common');
  useDismissOnEscape(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'fade-in relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[16px] border border-line bg-surface shadow-[var(--shadow-pop)] sm:rounded-[14px]',
          size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {subtitle ? <p className="text-[12.5px] text-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="-me-1 ms-auto rounded p-1.5 text-faint transition hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  tone = 'danger',
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
}) {
  const t = useTranslations('common');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('cancel')}
          </Button>
          <Button
            variant={tone === 'danger' ? 'default' : 'primary'}
            onClick={onConfirm}
            disabled={busy}
            className={
              tone === 'danger'
                ? 'border-danger bg-danger text-white hover:border-danger hover:bg-danger/90'
                : undefined
            }
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13.5px] leading-relaxed text-muted">{body}</p>
    </Modal>
  );
}

/** Side sheet — slides in from the inline end, so it mirrors under RTL. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations('common');
  useDismissOnEscape(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fade-in relative flex h-full w-full max-w-[440px] flex-col border-s border-line bg-surface shadow-[var(--shadow-pop)]"
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="truncate text-[15px] font-semibold text-ink">{title}</h2>
            {subtitle ? <div className="text-[12.5px] text-muted">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="-me-1 ms-auto rounded p-1.5 text-faint transition hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </aside>
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { X } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { isActive, NAV_ITEMS } from './navItems';

function Brand() {
  const t = useTranslations('app');
  return (
    <div className="flex flex-col gap-1 px-3.5 py-3.5">
      {/* The wordmark is the same asset in both themes — it is a solid brand
          yellow that holds up on the light and dark sidebar alike. */}
      <Image
        src="/full_logo.png"
        alt={t('brand')}
        width={381}
        height={88}
        priority
        className="h-[26px] w-auto self-start"
      />
      <span className="text-[10.5px] uppercase tracking-[.08em] text-faint">{t('suite')}</span>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-0.5 px-2.5 pb-4">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <div key={item.href} className="contents">
            {item.sectionKey ? (
              <p className="px-2.5 pb-1 pt-4 text-[10.5px] font-bold uppercase tracking-[.08em] text-faint">
                {t(item.sectionKey)}
              </p>
            ) : null}
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-[var(--radius-ctl)] px-2.5 py-2 text-[13.5px] font-medium transition-colors',
                active
                  ? 'bg-accent-soft font-semibold text-accent-ink'
                  : 'text-muted hover:bg-surface-2 hover:text-ink',
              )}
            >
              <Icon className="size-[17px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              <span className="truncate">{t(item.labelKey)}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col border-e border-line bg-surface lg:flex">
      <Brand />
      <NavList />
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('common');
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        className="absolute inset-0 bg-black/45"
      />
      <aside className="fade-in relative flex h-full w-[264px] flex-col border-e border-line bg-surface">
        <div className="flex items-center">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="me-3 ms-auto rounded p-1.5 text-faint transition hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        <NavList onNavigate={onClose} />
      </aside>
    </div>
  );
}

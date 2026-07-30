'use client';

import { useTranslations } from 'next-intl';
import { Menu as MenuIcon } from 'lucide-react';
import { HotelSwitcher } from './HotelSwitcher';
import { LocaleSwitcher } from './LocaleSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { AccountMenu } from './AccountMenu';

export function TopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const t = useTranslations('nav');

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5 sm:px-6">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label={t('openMenu')}
        className="grid size-[34px] shrink-0 place-items-center rounded-[var(--radius-ctl)] border border-line bg-surface-2 text-muted transition hover:text-ink lg:hidden"
      >
        <MenuIcon className="size-4" />
      </button>

      <HotelSwitcher />

      <div className="ms-auto flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
        <div className="mx-1 h-6 w-px bg-line" />
        <AccountMenu />
      </div>
    </header>
  );
}

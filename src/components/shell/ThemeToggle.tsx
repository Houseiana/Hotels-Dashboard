'use client';

import { useTranslations } from 'next-intl';
import { Monitor, Moon, Sun } from 'lucide-react';
import { Menu, MenuItem, MenuLabel } from '@/components/ui/Menu';
import { useTheme, type ThemePreference } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';

const ICONS: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export function ThemeToggle() {
  const t = useTranslations('common');
  const { preference, resolved, setPreference } = useTheme();
  const Icon = resolved === 'dark' ? Moon : Sun;

  const options: Array<{ value: ThemePreference; label: string }> = [
    { value: 'light', label: t('lightTheme') },
    { value: 'dark', label: t('darkTheme') },
    { value: 'system', label: t('systemTheme') },
  ];

  return (
    <Menu
      align="end"
      width="w-40"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={t('theme')}
          className={cn(
            'grid size-[34px] place-items-center rounded-[var(--radius-ctl)] border border-line bg-surface-2 text-muted transition hover:border-line-strong hover:text-ink',
            open && 'border-accent text-ink',
          )}
        >
          <Icon className="size-4" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>{t('theme')}</MenuLabel>
          {options.map((option) => {
            const OptionIcon = ICONS[option.value];
            return (
              <MenuItem
                key={option.value}
                active={preference === option.value}
                icon={<OptionIcon className="size-4" />}
                onClick={() => {
                  setPreference(option.value);
                  close();
                }}
              >
                {option.label}
              </MenuItem>
            );
          })}
        </>
      )}
    </Menu>
  );
}

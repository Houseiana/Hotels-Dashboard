'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { Check, Languages } from 'lucide-react';
import { Menu, MenuItem, MenuLabel } from '@/components/ui/Menu';
import { usePathname, useRouter } from '@/i18n/navigation';
import { locales } from '@/i18n/routing';
import { cn } from '@/lib/utils';

const LABELS: Record<string, string> = { en: 'English', ar: 'العربية' };

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const switchTo = (next: string) => {
    if (next === locale) return;
    startTransition(() => {
      // `pathname` is already locale-stripped and fully resolved, so dynamic
      // routes such as /hotels/[id]/edit survive the swap unchanged.
      router.replace(pathname, { locale: next as (typeof locales)[number] });
    });
  };

  return (
    <Menu
      align="end"
      width="w-44"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={t('language')}
          disabled={pending}
          className={cn(
            'flex items-center gap-1.5 rounded-[var(--radius-ctl)] border border-line bg-surface-2 px-2.5 py-[7px] text-[12.5px] font-semibold text-muted transition hover:border-line-strong hover:text-ink',
            open && 'border-accent text-ink',
            pending && 'opacity-60',
          )}
        >
          <Languages className="size-4" />
          <span className="hidden sm:inline">{LABELS[locale]}</span>
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>{t('language')}</MenuLabel>
          {locales.map((code) => (
            <MenuItem
              key={code}
              active={code === locale}
              icon={code === locale ? <Check className="size-4" /> : <span className="size-4" />}
              onClick={() => {
                switchTo(code);
                close();
              }}
            >
              {LABELS[code]}
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  );
}

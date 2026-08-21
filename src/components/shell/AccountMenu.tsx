'use client';

import { useTranslations } from 'next-intl';
import { CircleUser, LogOut } from 'lucide-react';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { useSession } from '@/components/providers/SessionProvider';
import { useRouter } from '@/i18n/navigation';

export function AccountMenu() {
  const t = useTranslations('auth');
  const { user, signOut } = useSession();
  const router = useRouter();

  const initials = (user?.name ?? user?.email ?? '')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <Menu
      align="end"
      width="w-60"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={t('account')}
          className="grid size-[30px] place-items-center rounded-full border border-line-strong bg-accent-soft text-[11px] font-bold text-accent-ink"
        >
          {initials || <CircleUser className="size-4" />}
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>{t('account')}</MenuLabel>
          <div className="px-2.5 pb-2">
            <p className="truncate text-[13px] font-semibold text-ink">
              {user?.name ?? t('mockOwner')}
            </p>
            {user?.email ? (
              <p className="truncate text-[11.5px] text-faint latn">{user.email}</p>
            ) : null}
          </div>
          <MenuSeparator />
          <MenuItem
            danger
            icon={<LogOut className="size-4" />}
            onClick={() => {
              close();
              signOut();
              router.replace('/sign-in');
            }}
          >
            {t('signOut')}
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { UserButton } from '@clerk/nextjs';
import { CircleUser, ShieldCheck } from 'lucide-react';
import { Menu, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { CLERK_ENABLED } from '@/lib/auth';

/** Clerk's account menu, with a labelled stand-in when Clerk isn't configured. */
export function AccountMenu() {
  const t = useTranslations('auth');

  if (CLERK_ENABLED) {
    return (
      <UserButton
        appearance={{ elements: { avatarBox: 'size-[30px]' } }}
        afterSignOutUrl="/"
      />
    );
  }

  return (
    <Menu
      align="end"
      width="w-64"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={t('account')}
          className="grid size-[30px] place-items-center rounded-full border border-line-strong bg-accent-soft text-accent-ink"
        >
          <CircleUser className="size-4" />
        </button>
      )}
    >
      {() => (
        <>
          <MenuLabel>{t('account')}</MenuLabel>
          <div className="px-2.5 pb-2">
            <p className="text-[13px] font-semibold text-ink">{t('mockOwner')}</p>
            <p className="text-[11.5px] text-faint">{t('ownerAccess')}</p>
          </div>
          <MenuSeparator />
          <div className="flex gap-2 rounded-[7px] bg-warn-soft p-2.5">
            <ShieldCheck className="mt-px size-4 shrink-0 text-warn" />
            <div>
              <p className="text-[12px] font-semibold text-warn">{t('devModeTitle')}</p>
              <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{t('devModeBody')}</p>
            </div>
          </div>
        </>
      )}
    </Menu>
  );
}

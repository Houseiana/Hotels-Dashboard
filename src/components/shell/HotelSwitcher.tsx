'use client';

import { useTranslations } from 'next-intl';
import { Building2, Check, ChevronDown, Layers } from 'lucide-react';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui/Menu';
import { useHotelScope } from '@/components/providers/HotelScopeProvider';
import { Chip, Skeleton } from '@/components/ui/primitives';
import { statusSlug } from '@/lib/schemas/hotelApi';
import { cn, photoStyle } from '@/lib/utils';

export function HotelSwitcher() {
  const t = useTranslations('nav');
  const tHotels = useTranslations('hotels');
  const tStatus = useTranslations('catalog.hotelStatus');
  const { hotelId, hotel, hotels, isPending, setHotelId } = useHotelScope();

  if (isPending) return <Skeleton className="h-9 w-44" />;

  return (
    <Menu
      width="w-72"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={t('switchHotel')}
          className={cn(
            'flex max-w-[14rem] items-center gap-2 rounded-[var(--radius-ctl)] border border-line bg-surface-2 py-1.5 pe-2 ps-2 text-[13px] font-semibold text-ink transition hover:border-line-strong sm:max-w-[18rem]',
            open && 'border-accent',
          )}
        >
          {hotel ? (
            <span
              className="size-[22px] shrink-0 rounded-[5px]"
              style={photoStyle(hotel.coverPhoto ?? undefined)}
            />
          ) : (
            <Layers className="size-4 shrink-0 text-accent-ink" />
          )}
          <span className="truncate">{hotel ? hotel.name : t('allHotels')}</span>
          <ChevronDown className="size-3.5 shrink-0 text-faint" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>{t('switchHotel')}</MenuLabel>
          <MenuItem
            active={!hotelId}
            icon={<Layers className="size-4" />}
            onClick={() => {
              setHotelId(undefined);
              close();
            }}
          >
            {t('allHotels')}
          </MenuItem>
          <MenuSeparator />
          {hotels.length === 0 ? (
            <p className="px-2.5 py-3 text-[12.5px] text-muted">{tHotels('emptyTitle')}</p>
          ) : (
            hotels.map((h) => (
              <button
                key={h.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setHotelId(h.id);
                  close();
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-[7px] px-2.5 py-2 text-start transition-colors hover:bg-surface-2',
                  h.id === hotelId && 'bg-accent-soft',
                )}
              >
                <span
                  className="size-[26px] shrink-0 rounded-[6px]"
                  style={photoStyle(h.coverPhoto ?? undefined)}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13px] font-semibold text-ink">{h.name}</span>
                  <span className="truncate text-[11.5px] text-faint">
                    {tHotels('roomTypesCount', { count: h.roomTypesCount ?? 0 })}
                  </span>
                </span>
                {statusSlug(h.status) !== 'active' ? (
                  <Chip tone="neutral" className="shrink-0 px-2 py-0 text-[10.5px]">
                    {tStatus(statusSlug(h.status))}
                  </Chip>
                ) : null}
                {h.id === hotelId ? (
                  <Check className="size-4 shrink-0 text-accent-ink" />
                ) : null}
              </button>
            ))
          )}
          <MenuSeparator />
          <p className="flex items-center gap-2 px-2.5 py-1.5 text-[11.5px] text-faint">
            <Building2 className="size-3.5" />
            {tHotels('roomTypesCount', {
              count: hotels.reduce((sum, h) => sum + (h.roomTypesCount ?? 0), 0),
            })}
          </p>
        </>
      )}
    </Menu>
  );
}

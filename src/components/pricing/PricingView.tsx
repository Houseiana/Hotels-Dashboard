'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { BedDouble, CalendarRange, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { Button, Card, Chip, EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives';
import { Select } from '@/components/ui/form';
import { Link } from '@/i18n/navigation';
import { useHotelScope } from '@/components/providers/HotelScopeProvider';
import { useAvailability } from '@/lib/query/hooks';
import { useCatalogLabels } from '@/lib/useLabels';
import type { DayInventory } from '@/lib/schemas/booking';
import { cn, daysInMonth, formatDate, formatMoney, toISODate } from '@/lib/utils';
import { DayEditor } from './DayEditor';
import { BulkEditor } from './BulkEditor';

type CellState = 'open' | 'low' | 'sold';

function stateOf(available: number): CellState {
  if (available <= 0) return 'sold';
  if (available <= 3) return 'low';
  return 'open';
}

const CELL_STYLES: Record<CellState, { cell: string; value: string }> = {
  open: { cell: 'bg-open-bg border-open/25', value: 'text-open' },
  low: { cell: 'bg-low-bg border-low/30', value: 'text-low' },
  sold: { cell: 'bg-sold-bg border-sold/35', value: 'text-sold' },
};

export function PricingView() {
  const t = useTranslations('pricing');
  const tCommon = useTranslations('common');
  const tHotels = useTranslations('hotels');
  const locale = useLocale();
  const labels = useCatalogLabels();
  const params = useSearchParams();

  const { hotelId: scopedHotelId, hotels, isPending: hotelsPending, setHotelId } = useHotelScope();
  const requestedHotel = params.get('hotel');

  useEffect(() => {
    if (requestedHotel && requestedHotel !== scopedHotelId) setHotelId(requestedHotel);
  }, [requestedHotel, scopedHotelId, setHotelId]);

  const hotelId = scopedHotelId ?? hotels[0]?.id;
  const hotel = hotels.find((h) => h.id === hotelId);

  // Derived rather than synced: a room type belonging to a previously selected
  // hotel simply stops matching and the first room type takes over.
  const [roomTypeId, setRoomTypeId] = useState<string | undefined>();
  const roomType =
    hotel?.roomTypes.find((rt) => rt.id === roomTypeId) ?? hotel?.roomTypes[0];
  const activeRoomTypeId = roomType?.id;

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [editing, setEditing] = useState<DayInventory | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const calendar = useAvailability(hotelId, activeRoomTypeId, cursor.year, cursor.month);

  const weekdayLabels = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      weekday: 'short',
    });
    // 2026-03-01 is a Sunday, so index 0 is Sunday.
    return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2026, 2, 1 + i)));
  }, [locale]);

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(cursor.year, cursor.month, 1)),
    [locale, cursor],
  );

  const shiftMonth = (delta: number) =>
    setCursor(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  const stats = useMemo(() => {
    if (!calendar.data) return null;
    const { days, totalUnits } = calendar.data;
    const nights = days.length || 1;
    const sumAvailable = days.reduce(
      (sum, d) => sum + Math.max(0, totalUnits - d.sold - d.blocked),
      0,
    );
    return {
      nights,
      avgAvailable: sumAvailable / nights,
      occupancy: totalUnits
        ? Math.round((1 - sumAvailable / (totalUnits * nights)) * 100)
        : 0,
      soldOut: days.filter((d) => totalUnits - d.sold - d.blocked <= 0).length,
      withBlocks: days.filter((d) => d.blocked > 0).length,
      avgRate: days.reduce((sum, d) => sum + d.price, 0) / nights,
    };
  }, [calendar.data]);

  if (hotelsPending) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <Skeleton className="h-[520px]" />
      </div>
    );
  }

  if (!hotel) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <EmptyState
          icon={<CalendarRange className="size-5" />}
          title={t('selectHotelFirst')}
          body={tHotels('emptyBody')}
          action={
            <Link href="/hotels/new">
              <Button variant="primary">{tHotels('addHotel')}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (!roomType) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <EmptyState
          icon={<BedDouble className="size-5" />}
          title={t('noRoomTypes')}
          action={
            <Link href={`/hotels/${hotel.id}/edit?step=rooms`}>
              <Button variant="primary">{t('noRoomTypesAction')}</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay();
  const monthStart = new Date(cursor.year, cursor.month, 1);
  const monthEnd = new Date(cursor.year, cursor.month, daysInMonth(cursor.year, cursor.month));
  const today = toISODate(new Date());

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button onClick={() => setBulkOpen(true)}>
            <SlidersHorizontal className="size-4" />
            {t('bulkEdit')}
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {/* panel head */}
        <div className="flex flex-wrap items-end gap-x-7 gap-y-4 border-b border-line px-5 py-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[.09em] text-faint">
              {t('roomType')}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-[260px]">
                <Select
                  value={activeRoomTypeId}
                  onChange={(e) => setRoomTypeId(e.target.value)}
                  className="text-[16px] font-semibold"
                  aria-label={t('selectRoomType')}
                >
                  {hotel.roomTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name} · {labels.category(rt.category)}
                    </option>
                  ))}
                </Select>
              </div>
              <Chip tone="accent">{t('unitsTotal', { count: roomType.inventory })}</Chip>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 sm:ms-auto">
            <span className="text-[10.5px] font-semibold uppercase tracking-[.08em] text-faint">
              {t('month')}
            </span>
            <div className="flex items-stretch">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label={t('prevMonth')}
                className="grid w-8 place-items-center rounded-s-[9px] border border-line bg-surface-2 text-muted transition hover:border-line-strong hover:text-ink"
              >
                <ChevronLeft className="flip-rtl size-4" />
              </button>
              <span className="grid min-w-[132px] place-items-center border-y border-line bg-surface-2 px-3.5 text-[13.5px] font-semibold text-ink">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label={t('nextMonth')}
                className="grid w-8 place-items-center rounded-e-[9px] border border-line bg-surface-2 text-muted transition hover:border-line-strong hover:text-ink"
              >
                <ChevronRight className="flip-rtl size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* summary strip */}
        {stats ? (
          <div className="grid grid-cols-2 gap-px border-b border-line bg-line lg:grid-cols-5">
            {[
              {
                k: t('statAvgAvailable'),
                n: stats.avgAvailable.toFixed(1),
                s: t('ofTotal', { total: calendar.data?.totalUnits ?? 0 }),
              },
              { k: t('statOccupancy'), n: String(stats.occupancy), s: '%' },
              {
                k: t('statSoldOut'),
                n: String(stats.soldOut),
                s: t('ofNights', { count: stats.nights }),
                warn: stats.soldOut > 0,
              },
              {
                k: t('statBlocked'),
                n: String(stats.withBlocks),
                s: t('ofNights', { count: stats.nights }),
              },
              {
                k: t('statAvgRate'),
                n: formatMoney(stats.avgRate, calendar.data?.currency ?? hotel.currency, locale, {
                  compact: true,
                }),
                s: '',
              },
            ].map((stat) => (
              <div key={stat.k} className="bg-surface px-5 py-3.5">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[.05em] text-faint">
                  {stat.k}
                </p>
                <p
                  className={cn(
                    'flex items-baseline gap-1.5 text-[24px] font-bold tracking-[-.02em] latn',
                    stat.warn ? 'text-sold' : 'text-ink',
                  )}
                >
                  {stat.n}
                  {stat.s ? (
                    <small className="text-[13px] font-medium text-muted">{stat.s}</small>
                  ) : null}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {/* legend */}
        <div className="flex flex-wrap gap-x-[18px] gap-y-1.5 border-b border-line px-5 py-3">
          {[
            { cls: 'bg-open', label: t('legendOpen') },
            { cls: 'bg-low', label: t('legendLow') },
            { cls: 'bg-sold', label: t('legendSold') },
          ].map((item) => (
            <span key={item.label} className="inline-flex items-center gap-2 text-[12px] text-muted">
              <span className={cn('size-[11px] shrink-0 rounded-[3px]', item.cls)} />
              {item.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-2 text-[12px] text-muted">
            <span className="hatch-blocked size-[11px] shrink-0 rounded-[3px]" />
            {t('legendBlocked')}
          </span>
        </div>

        {/* calendar */}
        <div className="overflow-x-auto px-5 py-4">
          <div className="min-w-[660px]">
            <div className="mb-2 grid grid-cols-7 gap-2">
              {weekdayLabels.map((label) => (
                <span
                  key={label}
                  className="ps-1 text-[11px] font-semibold uppercase tracking-[.06em] text-faint"
                >
                  {label}
                </span>
              ))}
            </div>

            {calendar.isPending && !calendar.data ? (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }, (_, i) => (
                  <Skeleton key={i} className="h-[86px] rounded-[11px]" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: firstWeekday }, (_, i) => (
                  <div key={`pad-${i}`} />
                ))}

                {calendar.data?.days.map((day) => {
                  const total = calendar.data.totalUnits;
                  const available = Math.max(0, total - day.sold - day.blocked);
                  const state = stateOf(total - day.sold - day.blocked);
                  const styles = CELL_STYLES[state];
                  const isToday = day.date === today;
                  const discounted = Boolean(day.discountPercent && day.priceWithoutDiscount);

                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setEditing(day)}
                      className={cn(
                        'group relative flex min-h-[86px] flex-col rounded-[11px] border px-[9px] pb-[9px] pt-2 text-start transition-[transform,box-shadow,border-color] hover:z-[5] hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]',
                        styles.cell,
                        isToday && 'ring-2 ring-accent ring-offset-1 ring-offset-[var(--surface)]',
                      )}
                    >
                      <span className="flex items-center justify-between text-[12px] font-semibold text-muted">
                        <span className="latn">
                          {formatDate(day.date, locale).split(' ').slice(0, 2).join(' ')}
                        </span>
                        {available <= 0 ? (
                          <span className="rounded-[4px] bg-sold/15 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[.05em] text-sold">
                            {t('soldOut')}
                          </span>
                        ) : day.closed ? (
                          <span className="rounded-[4px] bg-blocked/20 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[.05em] text-blocked">
                            {t('closed')}
                          </span>
                        ) : day.blocked > 0 ? (
                          <span
                            className="hatch-blocked size-2 rounded-[2px]"
                            title={t('blockedManual')}
                          />
                        ) : null}
                      </span>

                      <span
                        className={cn(
                          'mt-auto text-[26px] font-bold leading-none tracking-[-.03em] latn',
                          styles.value,
                        )}
                      >
                        {available}
                        <small className="ms-0.5 text-[11px] font-semibold text-faint">
                          {t('free')}
                        </small>
                      </span>

                      <span className="mt-1 flex items-center gap-1.5 text-[10.5px] font-medium text-faint latn">
                        {formatMoney(day.price, calendar.data.currency, locale, { compact: true })}
                        {discounted ? (
                          <span className="rounded-[3px] bg-accent/15 px-1 font-bold text-accent-ink">
                            {t('savingsBadge', { percent: day.discountPercent ?? 0 })}
                          </span>
                        ) : null}
                      </span>

                      {/* hover detail, mirroring the reference tooltip */}
                      <span className="pointer-events-none absolute bottom-[calc(100%+8px)] start-1/2 z-20 w-[184px] -translate-x-1/2 translate-y-1 rounded-[9px] bg-ink px-2.5 py-2.5 text-[11.5px] text-surface opacity-0 shadow-[var(--shadow-pop)] transition group-hover:translate-y-0 group-hover:opacity-100">
                        <span className="mb-1.5 block text-[12px] font-bold">
                          {formatDate(day.date, locale)}
                        </span>
                        {[
                          [t('capacity'), total],
                          [t('soldPlatform'), day.sold],
                          [t('blockedManual'), day.blocked],
                        ].map(([label, value]) => (
                          <span key={String(label)} className="flex justify-between gap-3 py-px opacity-80">
                            <span>{label}</span>
                            <b className="latn">{value}</b>
                          </span>
                        ))}
                        <span className="mt-1 flex justify-between gap-3 border-t border-surface/30 pt-1.5">
                          <span>{t('available')}</span>
                          <b className="latn">{available}</b>
                        </span>
                        <span className="flex justify-between gap-3 py-px opacity-80">
                          <span>{t('rate')}</span>
                          <b className="latn">
                            {formatMoney(day.price, calendar.data.currency, locale)}
                          </b>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-surface-2 px-5 py-3.5">
          <code className="rounded-[7px] border border-line bg-surface px-2.5 py-1 font-mono text-[12px] text-ink latn">
            <span className="font-bold text-open">GET</span> /api/room-types/
            {activeRoomTypeId}/availability?from={toISODate(monthStart)}&amp;to=
            {toISODate(monthEnd)}
          </code>
          <span className="text-[12px] text-muted">{t('formula')}</span>
        </div>
      </Card>

      {editing ? (
        <DayEditor
          key={editing.date}
          hotelId={hotel.id}
          roomTypeId={roomType.id}
          currency={calendar.data?.currency ?? hotel.currency}
          totalUnits={calendar.data?.totalUnits ?? roomType.inventory}
          day={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <BulkEditor
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        hotelId={hotel.id}
        roomTypeId={roomType.id}
        monthStart={monthStart}
        monthEnd={monthEnd}
        weekdayLabels={weekdayLabels}
      />

      <p className="text-[11.5px] text-faint">
        {tCommon('from')} {formatDate(toISODate(monthStart), locale)} — {tCommon('to')}{' '}
        {formatDate(toISODate(monthEnd), locale)}
      </p>
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  BedDouble,
  CalendarRange,
  Check,
  Mail,
  MapPin,
  Search,
  Users,
  X,
} from 'lucide-react';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import { Select, TextInput } from '@/components/ui/form';
import { ConfirmDialog, Drawer } from '@/components/ui/overlay';
import { useHotelScope } from '@/components/providers/HotelScopeProvider';
import { useBookings, useSetBookingStatus } from '@/lib/query/hooks';
import { useToast } from '@/components/providers/ToastProvider';
import { useCatalogLabels } from '@/lib/useLabels';
import { BOOKING_STATUSES } from '@/lib/catalogs';
import type { Booking, BookingStatus } from '@/lib/schemas/booking';
import { cn, formatDate, formatDateShort, formatMoney } from '@/lib/utils';

const STATUS_TONE: Record<BookingStatus, 'active' | 'draft' | 'danger' | 'info' | 'neutral'> = {
  pending: 'draft',
  confirmed: 'active',
  checkedIn: 'info',
  checkedOut: 'neutral',
  cancelled: 'danger',
};

export function BookingsView() {
  const t = useTranslations('bookings');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const labels = useCatalogLabels();
  const toast = useToast();

  const { hotelId, hotels } = useHotelScope();
  const { data: bookings, isPending, isError } = useBookings();
  const setBookingStatus = useSetBookingStatus();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | BookingStatus>('all');
  const [hotelFilter, setHotelFilter] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Booking | null>(null);
  const [toCancel, setToCancel] = useState<Booking | null>(null);

  const effectiveHotel = hotelId ?? (hotelFilter === 'all' ? undefined : hotelFilter);

  const filtered = useMemo(() => {
    if (!bookings) return [];
    const needle = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (effectiveHotel && b.hotelId !== effectiveHotel) return false;
      if (status !== 'all' && b.status !== status) return false;
      if (from && b.checkOut < from) return false;
      if (to && b.checkIn > to) return false;
      if (!needle) return true;
      return [b.guestName, b.reference, b.roomTypeName, b.hotelName]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [bookings, search, status, effectiveHotel, from, to]);

  const isFiltered =
    search.trim() !== '' || status !== 'all' || hotelFilter !== 'all' || Boolean(from || to);

  const changeStatus = (booking: Booking, next: BookingStatus) => {
    setBookingStatus.mutate(
      { id: booking.id, status: next },
      {
        onSuccess: () => {
          toast(
            next === 'cancelled'
              ? t('cancelledToast', { reference: booking.reference })
              : t('confirmedToast', { reference: booking.reference }),
            next === 'cancelled' ? 'info' : 'success',
          );
          setSelected((current) =>
            current?.id === booking.id ? { ...current, status: next } : current,
          );
        },
        onError: () => toast(tCommon('somethingWentWrong'), 'error'),
      },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          bookings ? (
            <Chip tone="neutral">{t('countLabel', { count: filtered.length })}</Chip>
          ) : null
        }
      />

      {/* Sized wrappers, not width classes on the controls themselves — the
          controls are `w-full` by design and a competing `w-auto` on the same
          element is not reliably resolvable. */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-[var(--radius-card)] border border-line bg-surface p-2.5 shadow-[var(--shadow-card)]">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-faint start-3" />
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="ps-9"
            aria-label={tCommon('search')}
          />
        </div>

        <div className="w-[160px] shrink-0">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'all' | BookingStatus)}
            aria-label={t('filterStatus')}
          >
            <option value="all">{t('filterStatus')} · {tCommon('all')}</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {labels.bookingStatus(s)}
              </option>
            ))}
          </Select>
        </div>

        {!hotelId ? (
          <div className="w-[190px] shrink-0">
            <Select
              value={hotelFilter}
              onChange={(e) => setHotelFilter(e.target.value)}
              aria-label={t('filterHotel')}
            >
              <option value="all">{t('filterHotel')} · {tCommon('all')}</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="w-[150px]">
            <TextInput
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="tnum latn"
              aria-label={tCommon('from')}
            />
          </div>
          <span className="text-faint">—</span>
          <div className="w-[150px]">
            <TextInput
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="tnum latn"
              aria-label={tCommon('to')}
            />
          </div>
        </div>

        {isFiltered ? (
          <Button
            variant="ghost"
            className="shrink-0"
            onClick={() => {
              setSearch('');
              setStatus('all');
              setHotelFilter('all');
              setFrom('');
              setTo('');
            }}
          >
            {tCommon('clearAll')}
          </Button>
        ) : null}
      </div>

      {isPending ? (
        <Skeleton className="h-[420px]" />
      ) : isError ? (
        <EmptyState
          icon={<CalendarRange className="size-5" />}
          title={tCommon('somethingWentWrong')}
          body={tCommon('retry')}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="size-5" />}
          title={isFiltered ? t('emptyFilteredTitle') : t('emptyTitle')}
          body={isFiltered ? t('emptyFilteredBody') : t('emptyBody')}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[10.5px] uppercase tracking-[.05em] text-faint">
                  <th className="px-4 py-2.5 text-start font-bold">{t('colReference')}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{t('colGuest')}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{t('colHotel')}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{t('colRoom')}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{t('colDates')}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{t('colStatus')}</th>
                  <th className="px-4 py-2.5 text-end font-bold">{t('colTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((booking) => (
                  <tr
                    key={booking.id}
                    onClick={() => setSelected(booking)}
                    className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
                  >
                    <td className="px-4 py-3 font-semibold text-ink latn">{booking.reference}</td>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-ink">{booking.guestName}</span>
                      <span className="block text-[11.5px] text-faint">
                        {tCommon('guests', { count: booking.guests })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">{booking.hotelName}</td>
                    <td className="px-4 py-3 text-muted">{booking.roomTypeName}</td>
                    <td className="px-4 py-3 text-muted latn">
                      {formatDateShort(booking.checkIn, locale)} →{' '}
                      {formatDateShort(booking.checkOut, locale)}
                      <span className="ms-1.5 text-[11.5px] text-faint">
                        ({tCommon('nights', { count: booking.nights })})
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Chip tone={STATUS_TONE[booking.status]}>
                        {labels.bookingStatus(booking.status)}
                      </Chip>
                    </td>
                    <td className="px-4 py-3 text-end font-semibold text-ink latn">
                      {formatMoney(booking.total, booking.currency, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? t('detailTitle', { reference: selected.reference }) : ''}
        subtitle={
          selected ? (
            <span className="flex items-center gap-2">
              <Chip tone={STATUS_TONE[selected.status]}>
                {labels.bookingStatus(selected.status)}
              </Chip>
              <span className="latn">{t('bookedOn', { date: formatDate(selected.createdAt, locale) })}</span>
            </span>
          ) : null
        }
        footer={
          selected && selected.status !== 'cancelled' && selected.status !== 'checkedOut' ? (
            <>
              <Button variant="danger" onClick={() => setToCancel(selected)}>
                <X className="size-4" />
                {t('cancel')}
              </Button>
              {selected.status === 'pending' ? (
                <Button variant="primary" onClick={() => changeStatus(selected, 'confirmed')}>
                  <Check className="size-4" />
                  {t('confirm')}
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[.06em] text-faint">
                {t('detailGuest')}
              </h3>
              <p className="text-[15px] font-semibold text-ink">{selected.guestName}</p>
              {selected.guestEmail ? (
                <p className="flex items-center gap-2 text-[13px] text-muted latn">
                  <Mail className="size-3.5" />
                  {selected.guestEmail}
                </p>
              ) : null}
              <p className="flex items-center gap-2 text-[13px] text-muted">
                <Users className="size-3.5" />
                {tCommon('guests', { count: selected.guests })}
                {selected.guestCountry ? ` · ${selected.guestCountry}` : ''}
              </p>
            </section>

            <div className="h-px bg-line" />

            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[.06em] text-faint">
                {t('detailStay')}
              </h3>
              <p className="flex items-center gap-2 text-[13.5px] text-ink latn">
                <CalendarRange className="size-4 text-faint" />
                {formatDate(selected.checkIn, locale)} → {formatDate(selected.checkOut, locale)}
              </p>
              <p className="text-[12.5px] text-muted">
                {tCommon('nights', { count: selected.nights })}
              </p>
              <p className="flex items-center gap-2 text-[13px] text-muted">
                <MapPin className="size-3.5" />
                {selected.hotelName}
              </p>
            </section>

            <div className="h-px bg-line" />

            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[.06em] text-faint">
                {t('detailRoom')}
              </h3>
              <p className="flex items-center gap-2 text-[13.5px] text-ink">
                <BedDouble className="size-4 text-faint" />
                {selected.roomTypeName}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selected.boardBasis ? (
                  <Chip tone="neutral">{labels.boardBasis(selected.boardBasis)}</Chip>
                ) : null}
                <Chip tone={selected.refundable ? 'active' : 'neutral'} dot={selected.refundable}>
                  {selected.refundable ? t('refundable') : t('nonRefundable')}
                </Chip>
              </div>
            </section>

            <div className="h-px bg-line" />

            <section className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-[.06em] text-faint">
                {t('detailPayment')}
              </h3>
              <p className={cn('text-[19px] font-bold tracking-[-.02em] text-ink latn')}>
                {formatMoney(selected.total, selected.currency, locale)}
              </p>
            </section>

            {selected.note ? (
              <>
                <div className="h-px bg-line" />
                <section className="flex flex-col gap-1.5">
                  <h3 className="text-[11px] font-bold uppercase tracking-[.06em] text-faint">
                    {t('detailNote')}
                  </h3>
                  <p className="rounded-[var(--radius-ctl)] bg-surface-2 p-3 text-[13px] text-muted">
                    {selected.note}
                  </p>
                </section>
              </>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <ConfirmDialog
        open={Boolean(toCancel)}
        onClose={() => setToCancel(null)}
        onConfirm={() => {
          if (toCancel) changeStatus(toCancel, 'cancelled');
          setToCancel(null);
        }}
        title={toCancel ? t('cancelConfirmTitle', { reference: toCancel.reference }) : ''}
        body={t('cancelConfirmBody')}
        confirmLabel={t('cancel')}
        busy={setBookingStatus.isPending}
      />
    </div>
  );
}

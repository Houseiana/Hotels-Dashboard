'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  BedDouble,
  CalendarRange,
  Info,
  Mail,
  MapPin,
  Search,
  Users,
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
import { Drawer } from '@/components/ui/overlay';
import { useHotelScope } from '@/components/providers/HotelScopeProvider';
import { useBookingsScreen, type BookingRow } from '@/lib/query/hooks';
import { useLookup } from '@/lib/query/lookups';
import { useCatalogLabels } from '@/lib/useLabels';
import { bookingStatusSlug } from '@/lib/schemas/hotelApi';
import { cn, formatDate, formatDateShort, formatMoney } from '@/lib/utils';

/** Renders a row's status in our words, or the server's when we lack a label. */
function StatusChip({
  booking,
  label,
}: {
  booking: BookingRow;
  label: (id: string) => string;
}) {
  return (
    <Chip tone={booking.tone}>
      {booking.status ? label(booking.status) : booking.statusLabel || '—'}
    </Chip>
  );
}

export function BookingsView() {
  const t = useTranslations('bookings');
  const tCommon = useTranslations('common');
  const tHotels = useTranslations('hotels');
  const locale = useLocale();
  const labels = useCatalogLabels();

  const { hotelId, hotels, isRestored } = useHotelScope();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusId, setStatusId] = useState<number | undefined>();
  const [hotelFilter, setHotelFilter] = useState<string>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<BookingRow | null>(null);

  // Search is a server parameter now, so it is debounced rather than applied on
  // every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const effectiveHotel = hotelId ?? (hotelFilter === 'all' ? undefined : hotelFilter);

  const statuses = useLookup('bookingStatus');

  const { data, isPending, isError } = useBookingsScreen(
    effectiveHotel,
    { search: debouncedSearch, statusId, fromDate: from, toDate: to },
    page,
    isRestored,
  );

  const isFiltered =
    debouncedSearch !== '' || statusId !== undefined || hotelFilter !== 'all' || Boolean(from || to);

  const resetPage = () => setPage(1);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          data ? <Chip tone="neutral">{t('countLabel', { count: data.total })}</Chip> : null
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
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder={t('searchPlaceholder')}
            className="ps-9"
            aria-label={tCommon('search')}
          />
        </div>

        <div className="w-[190px] shrink-0">
          <Select
            value={statusId === undefined ? 'all' : String(statusId)}
            onChange={(e) => {
              setStatusId(e.target.value === 'all' ? undefined : Number(e.target.value));
              resetPage();
            }}
            aria-label={t('filterStatus')}
            disabled={statuses.isPending}
          >
            <option value="all">
              {t('filterStatus')} · {tCommon('all')}
            </option>
            {/* The server owns this list — it has eleven states, not our five. */}
            {(statuses.data ?? []).map((status) => {
              const slug = bookingStatusSlug(status.name);
              return (
                <option key={status.id} value={status.id}>
                  {slug ? labels.bookingStatus(slug) : status.name}
                </option>
              );
            })}
          </Select>
        </div>

        {!hotelId ? (
          <div className="w-[190px] shrink-0">
            <Select
              value={hotelFilter}
              onChange={(e) => {
                setHotelFilter(e.target.value);
                resetPage();
              }}
              aria-label={t('filterHotel')}
            >
              <option value="all">
                {t('filterHotel')} · {tCommon('all')}
              </option>
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
              onChange={(e) => {
                setFrom(e.target.value);
                resetPage();
              }}
              className="tnum latn"
              aria-label={tCommon('from')}
            />
          </div>
          <span className="text-faint">—</span>
          <div className="w-[150px]">
            <TextInput
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                resetPage();
              }}
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
              setStatusId(undefined);
              setHotelFilter('all');
              setFrom('');
              setTo('');
              resetPage();
            }}
          >
            {tCommon('clearAll')}
          </Button>
        ) : null}
      </div>

      {/* The API has no "all my bookings" endpoint, so this view is stitched
          together client-side. Better to say that than to imply the ordering
          and counts are the server's. */}
      {data?.merged ? (
        <p className="flex items-start gap-2.5 rounded-[var(--radius-ctl)] border border-info/35 bg-info-soft px-3.5 py-2.5 text-[12.5px] text-ink">
          <Info className="mt-px size-4 shrink-0 text-info" />
          <span>
            {t('mergedNote', { perHotel: 50 })}
            {data.truncated ? ` ${t('truncatedNote')}` : ''}
            {data.failedHotels > 0 ? ` ${t('failedHotelsNote', { count: data.failedHotels })}` : ''}
          </span>
        </p>
      ) : null}

      {isPending ? (
        <Skeleton className="h-[420px]" />
      ) : isError || !data ? (
        <EmptyState
          icon={<CalendarRange className="size-5" />}
          title={tCommon('somethingWentWrong')}
          body={tCommon('retry')}
        />
      ) : data.rows.length === 0 ? (
        <EmptyState
          icon={<CalendarRange className="size-5" />}
          title={isFiltered ? t('emptyFilteredTitle') : t('emptyTitle')}
          body={isFiltered ? t('emptyFilteredBody') : t('emptyBody')}
        />
      ) : (
        <>
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
                  {data.rows.map((booking) => (
                    <tr
                      key={booking.id}
                      onClick={() => setSelected(booking)}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-surface-2"
                    >
                      <td className="px-4 py-3 font-semibold text-ink latn">
                        {booking.reference || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-medium text-ink">{booking.guestName}</span>
                        {booking.guests !== undefined ? (
                          <span className="block text-[11.5px] text-faint">
                            {tCommon('guests', { count: booking.guests })}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">{booking.hotelName}</td>
                      <td className="px-4 py-3 text-muted">{booking.roomTypeName}</td>
                      <td className="px-4 py-3 text-muted latn">
                        {booking.checkIn ? formatDateShort(booking.checkIn, locale) : '—'} →{' '}
                        {booking.checkOut ? formatDateShort(booking.checkOut, locale) : '—'}
                        {booking.nights !== undefined ? (
                          <span className="ms-1.5 text-[11.5px] text-faint">
                            ({tCommon('nights', { count: booking.nights })})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip booking={booking} label={labels.bookingStatus} />
                      </td>
                      <td className="px-4 py-3 text-end font-semibold text-ink latn">
                        {formatMoney(booking.total ?? undefined, booking.currency, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {data.totalPages > 1 ? (
            <div className="flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {tHotels('prevPage')}
              </Button>
              <span className="text-[12.5px] text-muted latn">
                {page} / {data.totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {tHotels('nextPage')}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? t('detailTitle', { reference: selected.reference || '—' }) : ''}
        subtitle={
          selected ? (
            <span className="flex items-center gap-2">
              <StatusChip booking={selected} label={labels.bookingStatus} />
              {selected.createdAt ? (
                <span className="latn">
                  {t('bookedOn', { date: formatDate(selected.createdAt, locale) })}
                </span>
              ) : null}
            </span>
          ) : null
        }
        /* HotelManagement has no endpoint for confirming or cancelling a
           booking, so there are no actions to offer here. */
        footer={
          data && !data.canChangeStatus ? (
            <p className="flex items-start gap-2 text-[12px] text-muted">
              <Info className="mt-px size-3.5 shrink-0 text-info" />
              {t('readOnlyNote')}
            </p>
          ) : null
        }
      >
        {selected ? (
          <div className="flex flex-col gap-4">
            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[.06em] text-faint">
                {t('detailGuest')}
              </h3>
              <p className="text-[15px] font-semibold text-ink">{selected.guestName || '—'}</p>
              {selected.guestEmail ? (
                <p className="flex items-center gap-2 text-[13px] text-muted latn">
                  <Mail className="size-3.5" />
                  {selected.guestEmail}
                </p>
              ) : null}
              {selected.guests !== undefined || selected.guestCountry ? (
                <p className="flex items-center gap-2 text-[13px] text-muted">
                  <Users className="size-3.5" />
                  {selected.guests !== undefined
                    ? tCommon('guests', { count: selected.guests })
                    : ''}
                  {selected.guestCountry ? ` · ${selected.guestCountry}` : ''}
                </p>
              ) : null}
            </section>

            <div className="h-px bg-line" />

            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[.06em] text-faint">
                {t('detailStay')}
              </h3>
              <p className="flex items-center gap-2 text-[13.5px] text-ink latn">
                <CalendarRange className="size-4 text-faint" />
                {selected.checkIn ? formatDate(selected.checkIn, locale) : '—'} →{' '}
                {selected.checkOut ? formatDate(selected.checkOut, locale) : '—'}
              </p>
              {selected.nights !== undefined ? (
                <p className="text-[12.5px] text-muted">
                  {tCommon('nights', { count: selected.nights })}
                </p>
              ) : null}
              {selected.hotelName ? (
                <p className="flex items-center gap-2 text-[13px] text-muted">
                  <MapPin className="size-3.5" />
                  {selected.hotelName}
                </p>
              ) : null}
            </section>

            <div className="h-px bg-line" />

            <section className="flex flex-col gap-2">
              <h3 className="text-[11px] font-bold uppercase tracking-[.06em] text-faint">
                {t('detailRoom')}
              </h3>
              <p className="flex items-center gap-2 text-[13.5px] text-ink">
                <BedDouble className="size-4 text-faint" />
                {selected.roomTypeName || '—'}
              </p>
              {selected.boardBasis ? (
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone="neutral">{labels.boardBasis(selected.boardBasis)}</Chip>
                </div>
              ) : null}
            </section>

            <div className="h-px bg-line" />

            <section className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-[.06em] text-faint">
                {t('detailPayment')}
              </h3>
              <p className={cn('text-[19px] font-bold tracking-[-.02em] text-ink latn')}>
                {formatMoney(selected.total ?? undefined, selected.currency, locale)}
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
    </div>
  );
}

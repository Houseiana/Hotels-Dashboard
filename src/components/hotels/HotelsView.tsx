'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  BedDouble,
  Building2,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Eye,
  LayoutGrid,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Rows3,
  Search,
  Trash2,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  PageHeader,
  Skeleton,
  Stars,
} from '@/components/ui/primitives';
import { Select, TextInput } from '@/components/ui/form';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu';
import { ConfirmDialog } from '@/components/ui/overlay';
import {
  useActivateHotel,
  useDeleteHotelById,
  useHotelList,
} from '@/lib/query/hooks';
import { useLookup } from '@/lib/query/lookups';
import { useSession } from '@/components/providers/SessionProvider';
import { useToast } from '@/components/providers/ToastProvider';
import {
  HOTEL_STATUSES,
  statusSlug,
  type HotelListItem,
  type HotelStatusSlug,
} from '@/lib/schemas/hotelApi';
import { cn, formatMoney, photoStyle } from '@/lib/utils';

type ViewMode = 'grid' | 'table';

const PAGE_SIZE = 12;

/** Chip colours for the API's eight states. */
const STATUS_TONE: Record<HotelStatusSlug, 'active' | 'draft' | 'danger' | 'info' | 'neutral'> = {
  active: 'active',
  pending: 'info',
  inactive: 'neutral',
  actionRequired: 'draft',
  draft: 'draft',
  suspended: 'danger',
  rejected: 'danger',
  deleted: 'neutral',
};

/** Search hits the server, so it waits for a pause in typing. */
function useDebounced<T>(value: T, delay = 400): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return settled;
}

export function HotelsView() {
  const t = useTranslations('hotels');
  const tCommon = useTranslations('common');
  const tStatus = useTranslations('catalog.hotelStatus');
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const { isReady } = useSession();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<HotelStatusSlug | 'all'>('all');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>('grid');
  const [toDelete, setToDelete] = useState<HotelListItem | null>(null);

  const debouncedSearch = useDebounced(search);

  // Changing what we filter by invalidates the page we are on. Adjusting during
  // render (rather than in an effect) means the request never goes out for the
  // stale page in the first place.
  const filterKey = `${debouncedSearch}|${status}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  // The API filters by numeric id, so the chosen slug is resolved through the
  // server's own HotelStatus lookup rather than a hard-coded number.
  const statusLookup = useLookup('hotelStatus');
  const statusId = useMemo(() => {
    if (status === 'all') return undefined;
    return statusLookup.data?.find((item) => statusSlug(item.name) === status)?.id;
  }, [status, statusLookup.data]);

  const query = useHotelList(
    { search: debouncedSearch, statusId, page, limit: PAGE_SIZE },
    // The list is scoped by the bearer token, so it only needs the session to
    // have been restored — not a manager id in the query.
    { enabled: isReady },
  );

  const removeHotel = useDeleteHotelById();
  const activateHotel = useActivateHotel();

  const items = query.data?.items ?? [];
  const pagination = query.data?.pagination;
  const isFiltered = debouncedSearch.trim() !== '' || status !== 'all';
  const totalPages = pagination?.totalPages ?? 1;

  const rowActions = (hotel: HotelListItem, close: () => void) => {
    const slug = statusSlug(hotel.status);
    return (
      <>
        <MenuItem
          icon={<Eye className="size-4" />}
          onClick={() => {
            close();
            router.push(`/hotels/${hotel.id}`);
          }}
        >
          {t('actionDetails')}
        </MenuItem>
        <MenuItem
          icon={<Pencil className="size-4" />}
          onClick={() => {
            close();
            router.push(`/hotels/${hotel.id}/edit`);
          }}
        >
          {t('actionEdit')}
        </MenuItem>
        {slug !== 'active' && slug !== 'deleted' ? (
          <MenuItem
            icon={<Power className="size-4" />}
            onClick={() => {
              close();
              activateHotel.mutate(hotel.id, {
                onSuccess: () => toast(t('activatedToast', { name: hotel.name })),
                onError: () => toast(tCommon('somethingWentWrong'), 'error'),
              });
            }}
          >
            {t('activate')}
          </MenuItem>
        ) : null}
        <MenuItem
          icon={<CalendarRange className="size-4" />}
          onClick={() => {
            close();
            router.push(`/pricing?hotel=${hotel.id}`);
          }}
        >
          {t('actionPricing')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          danger
          icon={<Trash2 className="size-4" />}
          onClick={() => {
            close();
            setToDelete(hotel);
          }}
        >
          {t('actionDelete')}
        </MenuItem>
      </>
    );
  };

  const statusChip = (hotel: HotelListItem) => {
    const slug = statusSlug(hotel.status);
    return (
      <Chip tone={STATUS_TONE[slug]} dot>
        {tStatus(slug)}
      </Chip>
    );
  };

  const location = (hotel: HotelListItem) =>
    [hotel.cityName, hotel.countryName].filter(Boolean).join(', ') || '—';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button variant="primary" onClick={() => router.push('/hotels/new')}>
            <Plus className="size-4" />
            {t('addHotel')}
          </Button>
        }
      />

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
        <div className="w-[190px] shrink-0">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as HotelStatusSlug | 'all')}
            aria-label={tCommon('status')}
          >
            <option value="all">{t('statusAll')}</option>
            {HOTEL_STATUSES.map((slug) => (
              <option key={slug} value={slug}>
                {tStatus(slug)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex shrink-0 overflow-hidden rounded-[var(--radius-ctl)] border border-line-strong">
          {(['grid', 'table'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              aria-pressed={view === mode}
              aria-label={mode === 'grid' ? t('viewGrid') : t('viewTable')}
              className={cn(
                'grid size-[34px] place-items-center transition-colors',
                view === mode
                  ? 'bg-accent-soft text-accent-ink'
                  : 'bg-surface-2 text-faint hover:text-ink',
              )}
            >
              {mode === 'grid' ? <LayoutGrid className="size-4" /> : <Rows3 className="size-4" />}
            </button>
          ))}
        </div>
      </div>

      {query.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-[132px] rounded-none" />
              <div className="flex flex-col gap-2.5 p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </Card>
          ))}
        </div>
      ) : query.isError ? (
        <EmptyState
          icon={<Building2 className="size-5" />}
          title={tCommon('somethingWentWrong')}
          body={query.error instanceof Error ? query.error.message : tCommon('retry')}
          action={<Button onClick={() => query.refetch()}>{tCommon('retry')}</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-5" />}
          title={isFiltered ? t('emptyFilteredTitle') : t('emptyTitle')}
          body={isFiltered ? t('emptyFilteredBody') : t('emptyBody')}
          action={
            isFiltered ? (
              <Button
                onClick={() => {
                  setSearch('');
                  setStatus('all');
                }}
              >
                {tCommon('clearAll')}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => router.push('/hotels/new')}>
                <Plus className="size-4" />
                {t('emptyAction')}
              </Button>
            )
          }
        />
      ) : view === 'grid' ? (
        <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', query.isFetching && 'opacity-60')}>
          {items.map((hotel) => (
            <Card key={hotel.id} className="flex flex-col overflow-hidden">
              <div className="relative h-60" style={photoStyle(hotel.coverPhoto ?? undefined)}>
                <div className="absolute top-2.5 start-2.5">{statusChip(hotel)}</div>
                <div className="absolute top-2 end-2">
                  <Menu
                    align="end"
                    trigger={({ toggle }) => (
                      <button
                        type="button"
                        onClick={toggle}
                        aria-label={tCommon('actions')}
                        className="grid size-7 place-items-center rounded-full bg-black/55 text-white transition hover:bg-black/70"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    )}
                  >
                    {(close) => rowActions(hotel, close)}
                  </Menu>
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start gap-2">
                  <Link
                    href={`/hotels/${hotel.id}`}
                    className="min-w-0 flex-1 font-serif text-[17px] font-semibold leading-tight tracking-[-.01em] text-ink hover:text-accent-ink"
                  >
                    {hotel.name}
                  </Link>
                  <Stars value={hotel.starRating ?? undefined} size={13} className="mt-1 shrink-0" />
                </div>

                <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
                  <MapPin className="size-3.5 shrink-0" />
                  {location(hotel)}
                </p>

                <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-3">
                  <span className="flex flex-col">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
                      <BedDouble className="size-3.5" />
                      {t('roomTypesCount', { count: hotel.roomTypesCount ?? 0 })}
                    </span>
                    <span className="text-[11.5px] text-faint">
                      {t('unitsCount', { count: hotel.totalUnits ?? 0 })}
                    </span>
                  </span>
                  <span className="text-end">
                    <span className="block text-[10.5px] uppercase tracking-[.06em] text-faint">
                      {t('colFrom')}
                    </span>
                    <span className="block text-[15px] font-bold tracking-[-.01em] text-ink latn">
                      {hotel.fromPrice
                        ? formatMoney(hotel.fromPrice, hotel.currencyCode ?? 'EGP', locale)
                        : '—'}
                    </span>
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className={cn('overflow-hidden', query.isFetching && 'opacity-60')}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[10.5px] uppercase tracking-[.05em] text-faint">
                  <th className="px-4 py-2.5 text-start font-bold">{t('colHotel')}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{t('colStatus')}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{t('colCity')}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{t('colStars')}</th>
                  <th className="px-4 py-2.5 text-start font-bold">{t('colRoomTypes')}</th>
                  <th className="px-4 py-2.5 text-end font-bold">{t('colFrom')}</th>
                  <th className="w-12 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {items.map((hotel) => (
                  <tr key={hotel.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="size-[34px] shrink-0 rounded-[7px]"
                          style={photoStyle(hotel.coverPhoto ?? undefined)}
                        />
                        <Link
                          href={`/hotels/${hotel.id}`}
                          className="font-semibold text-ink hover:text-accent-ink"
                        >
                          {hotel.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusChip(hotel)}</td>
                    <td className="px-4 py-3 text-muted">{location(hotel)}</td>
                    <td className="px-4 py-3">
                      <Stars value={hotel.starRating ?? undefined} size={12} />
                    </td>
                    <td className="px-4 py-3 text-muted latn">{hotel.roomTypesCount ?? 0}</td>
                    <td className="px-4 py-3 text-end font-semibold text-ink latn">
                      {hotel.fromPrice
                        ? formatMoney(hotel.fromPrice, hotel.currencyCode ?? 'EGP', locale)
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Menu
                        align="end"
                        trigger={({ toggle }) => (
                          <button
                            type="button"
                            onClick={toggle}
                            aria-label={tCommon('actions')}
                            className="grid size-7 place-items-center rounded-[6px] text-faint transition hover:bg-surface-2 hover:text-ink"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        )}
                      >
                        {(close) => rowActions(hotel, close)}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pagination && pagination.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[12.5px] text-muted latn">
            {t('showingRange', {
              from: (pagination.page - 1) * pagination.limit + 1,
              to: Math.min(pagination.page * pagination.limit, pagination.total),
              total: pagination.total,
            })}
          </span>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                disabled={page <= 1 || query.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label={t('prevPage')}
              >
                <ChevronLeft className="flip-rtl size-4" />
              </Button>
              <span className="text-[12.5px] font-medium text-muted">
                {t('pageOf', { page: pagination.page, pages: totalPages })}
              </span>
              <Button
                size="sm"
                disabled={page >= totalPages || query.isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label={t('nextPage')}
              >
                <ChevronRight className="flip-rtl size-4" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (!toDelete) return;
          const { id, name } = toDelete;
          removeHotel.mutate(id, {
            onSuccess: () => toast(t('deletedToast', { name })),
            onError: () => toast(tCommon('somethingWentWrong'), 'error'),
          });
          setToDelete(null);
        }}
        title={toDelete ? t('deleteConfirmTitle', { name: toDelete.name }) : ''}
        body={t('deleteConfirmBody')}
        confirmLabel={tCommon('delete')}
        busy={removeHotel.isPending}
      />
    </div>
  );
}

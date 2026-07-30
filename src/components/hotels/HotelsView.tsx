'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  BedDouble,
  Building2,
  CalendarRange,
  Eye,
  LayoutGrid,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Rows3,
  Search,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button, Card, Chip, EmptyState, PageHeader, Skeleton, Stars } from '@/components/ui/primitives';
import { Select, TextInput } from '@/components/ui/form';
import { Menu, MenuItem, MenuSeparator } from '@/components/ui/Menu';
import { ConfirmDialog, Modal } from '@/components/ui/overlay';
import { GuestPreviewCard } from './GuestPreviewCard';
import { useDeleteHotel, useHotels, useSetHotelStatus } from '@/lib/query/hooks';
import { useToast } from '@/components/providers/ToastProvider';
import { useCatalogLabels } from '@/lib/useLabels';
import { hotelSchema, type Hotel } from '@/lib/schemas/hotel';
import { collectIssues } from '@/lib/schemas/errors';
import { cn, formatMoney, photoStyle } from '@/lib/utils';

type StatusFilter = 'all' | Hotel['status'];
type ViewMode = 'grid' | 'table';

function cheapestRate(hotel: Hotel): number | undefined {
  const prices = hotel.roomTypes.flatMap((rt) => rt.ratePlans.map((rp) => rp.pricePerNight));
  return prices.length ? Math.min(...prices) : undefined;
}

export function HotelsView() {
  const t = useTranslations('hotels');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const labels = useCatalogLabels();
  const toast = useToast();
  const router = useRouter();

  const { data: hotels, isPending, isError } = useHotels();
  const setStatus = useSetHotelStatus();
  const removeHotel = useDeleteHotel();

  const [search, setSearch] = useState('');
  const [status, setStatus_] = useState<StatusFilter>('all');
  const [view, setView] = useState<ViewMode>('grid');
  const [preview, setPreview] = useState<Hotel | null>(null);
  const [toDelete, setToDelete] = useState<Hotel | null>(null);
  const [blocked, setBlocked] = useState<{ hotel: Hotel; issues: string[] } | null>(null);

  const filtered = useMemo(() => {
    if (!hotels) return [];
    const needle = search.trim().toLowerCase();
    return hotels.filter((h) => {
      if (status !== 'all' && h.status !== status) return false;
      if (!needle) return true;
      return [h.name, h.nameAr ?? '', labels.city(h.city), labels.country(h.country)]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
  }, [hotels, search, status, labels]);

  const isFiltered = search.trim() !== '' || status !== 'all';

  /** Publishing runs the shared schema — the same gate the guest app applies. */
  const publish = (hotel: Hotel) => {
    const result = hotelSchema.safeParse(hotel);
    if (!result.success) {
      const issues = Array.from(
        new Set(
          collectIssues(result.error)
            .map((issue) => labels.validation(issue.key))
            .filter((m): m is string => Boolean(m)),
        ),
      );
      setBlocked({ hotel, issues });
      return;
    }
    setStatus.mutate(
      { id: hotel.id, status: 'active' },
      { onSuccess: () => toast(t('publishedToast', { name: hotel.name })) },
    );
  };

  const unpublish = (hotel: Hotel) => {
    setStatus.mutate(
      { id: hotel.id, status: 'draft' },
      { onSuccess: () => toast(t('unpublishedToast', { name: hotel.name }), 'info') },
    );
  };

  const rowActions = (hotel: Hotel, close: () => void) => (
    <>
      <MenuItem
        icon={<Pencil className="size-4" />}
        onClick={() => {
          close();
          router.push(`/hotels/${hotel.id}/edit`);
        }}
      >
        {t('actionEdit')}
      </MenuItem>
      {hotel.status === 'draft' ? (
        <MenuItem
          icon={<Send className="size-4" />}
          onClick={() => {
            close();
            publish(hotel);
          }}
        >
          {t('actionPublish')}
        </MenuItem>
      ) : (
        <MenuItem
          icon={<Undo2 className="size-4" />}
          onClick={() => {
            close();
            unpublish(hotel);
          }}
        >
          {t('actionUnpublish')}
        </MenuItem>
      )}
      <MenuItem
        icon={<Eye className="size-4" />}
        onClick={() => {
          close();
          setPreview(hotel);
        }}
      >
        {t('actionViewAsGuest')}
      </MenuItem>
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

      {/* Controls are wrapped in explicitly sized boxes rather than given width
          classes of their own: the form controls are `w-full` by design, and a
          competing `w-auto` on the same element is not reliably resolvable. */}
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
        <div className="w-[170px] shrink-0">
          <Select
            value={status}
            onChange={(e) => setStatus_(e.target.value as StatusFilter)}
            aria-label={tCommon('status')}
          >
            <option value="all">{t('statusAll')}</option>
            <option value="active">{t('statusActive')}</option>
            <option value="draft">{t('statusDraft')}</option>
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
              {mode === 'grid' ? (
                <LayoutGrid className="size-4" />
              ) : (
                <Rows3 className="size-4" />
              )}
            </button>
          ))}
        </div>
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
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
      ) : isError ? (
        <EmptyState
          icon={<Building2 className="size-5" />}
          title={tCommon('somethingWentWrong')}
          body={tCommon('retry')}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-5" />}
          title={isFiltered ? t('emptyFilteredTitle') : t('emptyTitle')}
          body={isFiltered ? t('emptyFilteredBody') : t('emptyBody')}
          action={
            isFiltered ? (
              <Button
                onClick={() => {
                  setSearch('');
                  setStatus_('all');
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((hotel) => (
            <Card key={hotel.id} className="flex flex-col overflow-hidden">
              <div className="relative h-[132px]" style={photoStyle(hotel.coverPhoto)}>
                <div className="absolute top-2.5 start-2.5">
                  <Chip tone={hotel.status === 'active' ? 'active' : 'draft'} dot>
                    {hotel.status === 'active' ? t('statusActive') : t('statusDraft')}
                  </Chip>
                </div>
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
                    href={`/hotels/${hotel.id}/edit`}
                    className="min-w-0 flex-1 font-serif text-[17px] font-semibold leading-tight tracking-[-.01em] text-ink hover:text-accent-ink"
                  >
                    {hotel.name}
                  </Link>
                  <Stars value={hotel.starRating} size={13} className="mt-1 shrink-0" />
                </div>

                <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
                  <MapPin className="size-3.5 shrink-0" />
                  {labels.city(hotel.city)}, {labels.country(hotel.country)}
                </p>

                <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-3">
                  <span className="flex flex-col">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
                      <BedDouble className="size-3.5" />
                      {t('roomTypesCount', { count: hotel.roomTypes.length })}
                    </span>
                    <span className="text-[11.5px] text-faint">
                      {t('unitsCount', {
                        count: hotel.roomTypes.reduce((s, rt) => s + rt.inventory, 0),
                      })}
                    </span>
                  </span>
                  <span className="text-end">
                    <span className="block text-[10.5px] uppercase tracking-[.06em] text-faint">
                      {t('colFrom')}
                    </span>
                    <span className="block text-[15px] font-bold tracking-[-.01em] text-ink latn">
                      {formatMoney(cheapestRate(hotel), hotel.currency, locale)}
                    </span>
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="overflow-hidden">
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
                {filtered.map((hotel) => (
                  <tr key={hotel.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="size-[34px] shrink-0 rounded-[7px]"
                          style={photoStyle(hotel.coverPhoto)}
                        />
                        <Link
                          href={`/hotels/${hotel.id}/edit`}
                          className="font-semibold text-ink hover:text-accent-ink"
                        >
                          {hotel.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Chip tone={hotel.status === 'active' ? 'active' : 'draft'} dot>
                        {hotel.status === 'active' ? t('statusActive') : t('statusDraft')}
                      </Chip>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {labels.city(hotel.city)}, {labels.country(hotel.country)}
                    </td>
                    <td className="px-4 py-3">
                      <Stars value={hotel.starRating} size={12} />
                    </td>
                    <td className="px-4 py-3 text-muted latn">{hotel.roomTypes.length}</td>
                    <td className="px-4 py-3 text-end font-semibold text-ink latn">
                      {formatMoney(cheapestRate(hotel), hotel.currency, locale)}
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

      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={t('actionViewAsGuest')}
        subtitle={preview?.name}
      >
        {preview ? <GuestPreviewCard hotel={preview} /> : null}
      </Modal>

      <Modal
        open={Boolean(blocked)}
        onClose={() => setBlocked(null)}
        title={blocked ? t('publishBlockedTitle', { name: blocked.hotel.name }) : ''}
        subtitle={t('publishBlockedBody')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBlocked(null)}>
              {tCommon('close')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const id = blocked?.hotel.id;
                setBlocked(null);
                if (id) router.push(`/hotels/${id}/edit`);
              }}
            >
              {t('actionEdit')}
            </Button>
          </>
        }
      >
        <ul className="flex flex-col gap-2">
          {blocked?.issues.map((issue) => (
            <li key={issue} className="flex gap-2 text-[13px] text-muted">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger" />
              {issue}
            </li>
          ))}
        </ul>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (!toDelete) return;
          removeHotel.mutate(toDelete.id);
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

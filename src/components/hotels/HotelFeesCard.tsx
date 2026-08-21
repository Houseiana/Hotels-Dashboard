'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, Chip, Skeleton } from '@/components/ui/primitives';
import { ArabicInput, Field, Grid2, NumberInput, Select, TextInput } from '@/components/ui/form';
import { ConfirmDialog } from '@/components/ui/overlay';
import {
  useDeleteHotelFee,
  useHotelFees,
  useSaveHotelFee,
} from '@/lib/query/hooks';
import { useLookup } from '@/lib/query/lookups';
import { useToast } from '@/components/providers/ToastProvider';
import { useCatalogLabels } from '@/lib/useLabels';
import { FEE_TYPE_NAMES } from '@/lib/api/catalogMap';
import type { HotelFeeInput } from '@/lib/api/fees';
import { formatMoney } from '@/lib/utils';

/** Server display name → our slug, so the Arabic UI can label a fee type. */
function slugForName(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const needle = name.trim().toLowerCase();
  return Object.keys(FEE_TYPE_NAMES).find(
    (slug) => FEE_TYPE_NAMES[slug].trim().toLowerCase() === needle,
  );
}

/**
 * Optional extras a hotel charges for, on top of the room rate.
 *
 * Each fee is saved on its own — the API gives them their own create, edit and
 * delete endpoints rather than folding them into the hotel record, so there is
 * no page-level save to wait for.
 *
 * A fee either belongs to the whole hotel or to one room type. Only the "Other"
 * type carries a name; the rest are named by the lookup entry itself.
 */
export function HotelFeesCard({
  hotelId,
  currency,
  roomTypes,
}: {
  hotelId: string;
  currency: string;
  roomTypes: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations('hotels');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const labels = useCatalogLabels();
  const toast = useToast();

  const types = useLookup('hotelFeeType');
  const fees = useHotelFees(hotelId);
  const save = useSaveHotelFee();
  const remove = useDeleteHotelFee();

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<HotelFeeInput>({ type: 0, price: 0 });
  const [scope, setScope] = useState<string>('hotel');
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const options = types.data ?? [];
  const chosen = options.find((option) => option.id === draft.type);
  const needsName = /other/i.test(chosen?.name ?? '');

  const startAdd = () => {
    setDraft({ type: options[0]?.id ?? 0, price: 0 });
    setScope('hotel');
    setEditing('new');
  };

  const submit = () => {
    const input: HotelFeeInput = {
      type: draft.type,
      price: draft.price,
      roomTypeId: scope === 'hotel' ? undefined : scope,
      customName: needsName ? draft.customName?.trim() || undefined : undefined,
      customNameAr: needsName ? draft.customNameAr?.trim() || undefined : undefined,
    };
    save.mutate(
      { hotelId, feeId: editing === 'new' ? undefined : (editing ?? undefined), input },
      {
        onSuccess: () => {
          toast(t('feeSavedToast'));
          setEditing(null);
        },
        onError: (error) => toast(error?.message || tCommon('somethingWentWrong'), 'error'),
      },
    );
  };

  const valid = draft.type > 0 && draft.price > 0 && (!needsName || Boolean(draft.customName?.trim()));

  return (
    <Card>
      <CardHeader
        title={t('feesTitle')}
        hint={t('feesSubtitle')}
        action={
          editing === null ? (
            <Button size="sm" variant="ghost" className="text-accent-ink" onClick={startAdd}>
              <Plus className="size-3.5" />
              {t('feeAdd')}
            </Button>
          ) : null
        }
      />
      <CardBody>
        {fees.isPending ? (
          <Skeleton className="h-20" />
        ) : (fees.data ?? []).length === 0 && editing === null ? (
          <p className="text-[13px] text-muted">{t('feesEmpty')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(fees.data ?? []).map((fee) => {
              const slug = slugForName(fee.typeName);
              const isOther = /other/i.test(fee.typeName ?? '');
              // "Other" is named by the owner; everything else by the lookup.
              const name = isOther
                ? (locale === 'ar' ? fee.customNameAr || fee.customName : fee.customName) ||
                  fee.customName ||
                  ''
                : slug
                  ? labels.feeType(slug)
                  : (fee.typeName ?? '');
              return (
                <div
                  key={fee.feeId}
                  className="flex flex-wrap items-center gap-3 rounded-[var(--radius-ctl)] border border-line p-3"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[13.5px] font-semibold text-ink">{name || '—'}</span>
                    <span className="text-[11.5px] text-faint">
                      {fee.roomTypeName ?? t('feeScopeHotel')}
                    </span>
                  </span>
                  <span className="ms-auto flex items-center gap-2.5">
                    <Chip tone="neutral">
                      <span className="latn">
                        {formatMoney(fee.price ?? undefined, currency, locale)}
                      </span>
                    </Chip>
                    <button
                      type="button"
                      onClick={() => setPendingRemoval(fee.feeId)}
                      aria-label={t('feeDelete')}
                      className="grid size-[28px] place-items-center rounded-[6px] text-faint transition hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {editing !== null ? (
          <div className="flex flex-col gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface-2 p-3">
            <Grid2>
              <Field label={t('feeType')} required>
                <Select
                  value={String(draft.type)}
                  onChange={(e) => setDraft({ ...draft, type: Number(e.target.value) })}
                  disabled={types.isPending}
                  aria-label={t('feeType')}
                >
                  {options.map((option) => {
                    const slug = slugForName(option.name);
                    return (
                      <option key={option.id} value={option.id}>
                        {slug ? labels.feeType(slug) : option.name}
                      </option>
                    );
                  })}
                </Select>
              </Field>

              <Field label={t('feeScope')}>
                <Select value={scope} onChange={(e) => setScope(e.target.value)}>
                  <option value="hotel">{t('feeScopeHotel')}</option>
                  {roomTypes.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('feePrice')} required>
                <NumberInput
                  value={draft.price}
                  onValueChange={(v) => setDraft({ ...draft, price: v ?? 0 })}
                  min={0}
                  step={25}
                  aria-label={t('feePrice')}
                  className="text-end font-bold"
                />
              </Field>
            </Grid2>

            {needsName ? (
              <Grid2>
                <Field label={t('feeCustomName')} required help={t('feeCustomHint')}>
                  <TextInput
                    value={draft.customName ?? ''}
                    onChange={(e) => setDraft({ ...draft, customName: e.target.value })}
                  />
                </Field>
                <Field label={t('feeCustomNameAr')}>
                  <ArabicInput
                    value={draft.customNameAr ?? ''}
                    onChange={(e) => setDraft({ ...draft, customNameAr: e.target.value })}
                  />
                </Field>
              </Grid2>
            ) : null}

            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={submit} disabled={!valid || save.isPending}>
                {save.isPending ? tCommon('saving') : tCommon('save')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                {tCommon('cancel')}
              </Button>
            </div>
          </div>
        ) : null}
      </CardBody>

      <ConfirmDialog
        open={pendingRemoval !== null}
        onClose={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval) {
            remove.mutate(pendingRemoval, {
              onSuccess: () => toast(t('feeDeletedToast')),
              onError: (error) => toast(error?.message || tCommon('somethingWentWrong'), 'error'),
            });
          }
          setPendingRemoval(null);
        }}
        title={t('feeDelete')}
        body={t('feeDeleteConfirm')}
        confirmLabel={tCommon('delete')}
      />
    </Card>
  );
}

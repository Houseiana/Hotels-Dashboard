'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/primitives';
import { Field, Grid2, NumberInput, Toggle } from '@/components/ui/form';
import { Modal } from '@/components/ui/overlay';
import { useUpdateDay } from '@/lib/query/hooks';
import { useToast } from '@/components/providers/ToastProvider';
import { useCatalogLabels } from '@/lib/useLabels';
import { dayInventorySchema, type DayInventory } from '@/lib/schemas/booking';
import { validate, issueMap } from '@/lib/schemas/errors';
import { formatDate, formatMoney } from '@/lib/utils';

/**
 * Single-night editor: price, seasonal discount, manual block and stop-sell.
 *
 * The caller keys this on the date, so opening a different night remounts it
 * with fresh state rather than syncing props into state through an effect.
 */
export function DayEditor({
  hotelId,
  roomTypeId,
  currency,
  totalUnits,
  day,
  onClose,
}: {
  hotelId: string;
  roomTypeId: string;
  currency: string;
  totalUnits: number;
  day: DayInventory;
  onClose: () => void;
}) {
  const t = useTranslations('pricing');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const labels = useCatalogLabels();
  const toast = useToast();
  const updateDay = useUpdateDay();

  const [value, setValue] = useState<DayInventory>(day);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const available = Math.max(0, totalUnits - value.sold - value.blocked);
  const effective =
    value.discountPercent && value.priceWithoutDiscount
      ? Math.round(value.priceWithoutDiscount * (1 - value.discountPercent / 100))
      : value.price;

  const submit = () => {
    const result = validate(dayInventorySchema, value);
    if (!result.ok) {
      setErrors(issueMap(result.issues));
      return;
    }
    updateDay.mutate(
      { hotelId, roomTypeId, day: result.data },
      {
        onSuccess: () => {
          toast(tCommon('saved'));
          onClose();
        },
        onError: () => toast(tCommon('somethingWentWrong'), 'error'),
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('editDay', { date: formatDate(value.date, locale) })}
      subtitle={`${t('capacity')}: ${totalUnits} · ${t('available')}: ${available}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={updateDay.isPending}>
            {updateDay.isPending ? tCommon('saving') : tCommon('save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Grid2>
          <Field label={t('price')} required error={labels.validation(errors['price'])}>
            <NumberInput
              value={value.price}
              onValueChange={(v) => setValue({ ...value, price: v ?? Number.NaN })}
              min={0}
              step={5}
              invalid={Boolean(errors['price'])}
            />
          </Field>
          <Field
            label={t('priceWithoutDiscount')}
            help={t('priceWithoutDiscountHint')}
            error={labels.validation(errors['priceWithoutDiscount'])}
          >
            <NumberInput
              value={value.priceWithoutDiscount}
              onValueChange={(v) => setValue({ ...value, priceWithoutDiscount: v })}
              min={0}
              step={5}
            />
          </Field>
        </Grid2>

        <Grid2>
          <Field
            label={t('discountPercent')}
            help={t('discountHint')}
            error={labels.validation(errors['discountPercent'])}
          >
            <NumberInput
              value={value.discountPercent}
              onValueChange={(v) => setValue({ ...value, discountPercent: v })}
              min={0}
              max={100}
              invalid={Boolean(errors['discountPercent'])}
            />
          </Field>
          <Field label={t('minStay')} error={labels.validation(errors['minStay'])}>
            <NumberInput
              value={value.minStay}
              onValueChange={(v) => setValue({ ...value, minStay: v })}
              min={1}
            />
          </Field>
        </Grid2>

        <Field
          label={t('blockUnits')}
          help={t('blockUnitsHint')}
          error={labels.validation(errors['blocked'])}
        >
          <NumberInput
            value={value.blocked}
            onValueChange={(v) => setValue({ ...value, blocked: v ?? 0 })}
            min={0}
            max={Math.max(0, totalUnits - value.sold)}
            invalid={Boolean(errors['blocked'])}
          />
        </Field>

        <Toggle
          checked={value.closed ?? false}
          onChange={(v) => setValue({ ...value, closed: v })}
          label={t('closedForArrival')}
        />

        <div className="flex flex-col gap-1.5 rounded-[var(--radius-ctl)] border border-line bg-surface-2 p-3 text-[12.5px]">
          <span className="flex justify-between">
            <span className="text-muted">{t('soldPlatform')}</span>
            <b className="text-ink latn">{value.sold}</b>
          </span>
          <span className="flex justify-between">
            <span className="text-muted">{t('blockedManual')}</span>
            <b className="text-ink latn">{value.blocked}</b>
          </span>
          <span className="flex justify-between border-t border-line pt-1.5">
            <span className="text-muted">{t('effectivePrice', { price: '' }).trim()}</span>
            <b className="text-accent-ink latn">{formatMoney(effective, currency, locale)}</b>
          </span>
        </div>
      </div>
    </Modal>
  );
}

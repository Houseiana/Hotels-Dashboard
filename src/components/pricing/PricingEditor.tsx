'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/primitives';
import { Field, Grid2, NumberInput, Select, TextInput } from '@/components/ui/form';
import { Modal } from '@/components/ui/overlay';
import {
  useBlockInventory,
  useClearSpecialPrice,
  useSetSpecialPrice,
} from '@/lib/query/hooks';
import { useToast } from '@/components/providers/ToastProvider';
import { formatMoney } from '@/lib/utils';

/**
 * The API's pricing model, expressed directly.
 *
 * Two operations, not one save: a price override belongs to the RATE PLAN and
 * applies to a date range, while blocking units belongs to the ROOM TYPE. They
 * are separate endpoints, so this panel keeps them as separate actions rather
 * than pretending one button writes both.
 *
 * The same panel serves a single night and a whole range — a night is just a
 * range whose ends match, and the endpoints take ranges either way.
 */
type Action = 'price' | 'clearPrice' | 'block';

export function PricingEditor({
  open,
  onClose,
  roomTypeId,
  ratePlanId,
  ratePlanLabel,
  currency,
  totalUnits,
  initialFrom,
  initialTo,
  minDate,
  maxDate,
}: {
  open: boolean;
  onClose: () => void;
  roomTypeId: string;
  ratePlanId: string | undefined;
  ratePlanLabel: string;
  currency: string;
  totalUnits: number;
  initialFrom: string;
  initialTo: string;
  minDate: string;
  maxDate: string;
}) {
  const t = useTranslations('pricing');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const toast = useToast();

  const setPrice = useSetSpecialPrice();
  const clearPrice = useClearSpecialPrice();
  const block = useBlockInventory();

  const [action, setAction] = useState<Action>('price');
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [price, setPriceValue] = useState<number | undefined>(undefined);
  const [units, setUnits] = useState<number | undefined>(0);

  const busy = setPrice.isPending || clearPrice.isPending || block.isPending;
  const rangeValid = Boolean(from && to && from <= to);
  const needsPlan = action !== 'block' && !ratePlanId;

  const ready =
    rangeValid &&
    !needsPlan &&
    (action === 'price'
      ? typeof price === 'number' && price > 0
      : action === 'block'
        ? typeof units === 'number' && units >= 0 && units <= totalUnits
        : true);

  const done = (message: string) => {
    toast(message);
    onClose();
  };
  const failed = (error: Error) => toast(error?.message || tCommon('somethingWentWrong'), 'error');

  const apply = () => {
    if (action === 'price' && ratePlanId && typeof price === 'number') {
      setPrice.mutate(
        { ratePlanId, fromDate: from, toDate: to, price },
        { onSuccess: () => done(t('priceApplied')), onError: failed },
      );
      return;
    }
    if (action === 'clearPrice' && ratePlanId) {
      clearPrice.mutate(
        { ratePlanId, fromDate: from, toDate: to },
        { onSuccess: () => done(t('priceCleared')), onError: failed },
      );
      return;
    }
    if (action === 'block' && typeof units === 'number') {
      block.mutate(
        { roomTypeId, from, to, units },
        {
          onSuccess: () => done(units === 0 ? t('unblocked') : t('blocked')),
          onError: failed,
        },
      );
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('editRange')}>
      <div className="flex flex-col gap-4">
        <Field label={t('action')}>
          <Select
            value={action}
            onChange={(e) => setAction(e.target.value as Action)}
            aria-label={t('action')}
          >
            <option value="price">{t('actionSetPrice')}</option>
            <option value="clearPrice">{t('actionClearPrice')}</option>
            <option value="block">{t('actionBlock')}</option>
          </Select>
        </Field>

        <Grid2>
          <Field label={t('dateFrom')}>
            <TextInput
              type="date"
              value={from}
              min={minDate}
              max={maxDate}
              onChange={(e) => setFrom(e.target.value)}
              className="latn"
            />
          </Field>
          <Field label={t('dateTo')}>
            <TextInput
              type="date"
              value={to}
              min={minDate}
              max={maxDate}
              onChange={(e) => setTo(e.target.value)}
              className="latn"
            />
          </Field>
        </Grid2>

        {action === 'price' ? (
          <Field label={t('price')} help={t('priceAppliesTo', { plan: ratePlanLabel })}>
            <NumberInput
              value={price}
              onValueChange={setPriceValue}
              min={0}
              step={50}
              aria-label={t('price')}
              className="text-end font-bold"
            />
          </Field>
        ) : null}

        {action === 'clearPrice' ? (
          <p className="rounded-[var(--radius-ctl)] bg-surface-2 p-3 text-[12.5px] text-muted">
            {t('clearPriceHint', { plan: ratePlanLabel })}
          </p>
        ) : null}

        {action === 'block' ? (
          <Field
            label={t('blockUnits')}
            help={t('blockUnitsApiHint', { total: totalUnits })}
          >
            <NumberInput
              value={units}
              onValueChange={setUnits}
              min={0}
              max={totalUnits}
              aria-label={t('blockUnits')}
              className="text-end font-bold"
            />
          </Field>
        ) : null}

        {needsPlan ? (
          <p className="rounded-[var(--radius-ctl)] border border-warn/35 bg-warn-soft p-3 text-[12.5px] text-ink">
            {t('needsRatePlan')}
          </p>
        ) : null}

        {action === 'price' && typeof price === 'number' && price > 0 ? (
          <p className="text-[12px] text-faint">
            {t('effectivePrice')}{' '}
            <b className="latn">{formatMoney(price, currency, locale)}</b>
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button variant="primary" onClick={apply} disabled={!ready || busy}>
            {busy ? tCommon('saving') : t('applyToRange')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

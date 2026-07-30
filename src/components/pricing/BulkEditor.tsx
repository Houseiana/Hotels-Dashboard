'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/primitives';
import { Checkbox, Field, Grid2, NumberInput, TextInput, Toggle } from '@/components/ui/form';
import { Modal } from '@/components/ui/overlay';
import { useBulkRateUpdate } from '@/lib/query/hooks';
import { useToast } from '@/components/providers/ToastProvider';
import { useCatalogLabels } from '@/lib/useLabels';
import { bulkRateUpdateSchema } from '@/lib/schemas/booking';
import { issueMap, validate } from '@/lib/schemas/errors';
import { toISODate } from '@/lib/utils';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export function BulkEditor({
  open,
  onClose,
  hotelId,
  roomTypeId,
  monthStart,
  monthEnd,
  weekdayLabels,
}: {
  open: boolean;
  onClose: () => void;
  hotelId: string;
  roomTypeId: string;
  monthStart: Date;
  monthEnd: Date;
  weekdayLabels: string[];
}) {
  const t = useTranslations('pricing');
  const tCommon = useTranslations('common');
  const labels = useCatalogLabels();
  const toast = useToast();
  const bulk = useBulkRateUpdate();

  const [from, setFrom] = useState(toISODate(monthStart));
  const [to, setTo] = useState(toISODate(monthEnd));
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [price, setPrice] = useState<number | undefined>();
  const [wasPrice, setWasPrice] = useState<number | undefined>();
  const [discount, setDiscount] = useState<number | undefined>();
  const [blocked, setBlocked] = useState<number | undefined>();
  const [minStay, setMinStay] = useState<number | undefined>();
  const [closed, setClosed] = useState(false);
  const [closedTouched, setClosedTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const result = validate(bulkRateUpdateSchema, {
      hotelId,
      roomTypeId,
      from,
      to,
      weekdays: weekdays.length ? weekdays : undefined,
      price,
      priceWithoutDiscount: wasPrice,
      discountPercent: discount,
      blocked,
      minStay,
      // Only send `closed` if the owner actually touched it, so a bulk price
      // change doesn't silently re-open stop-sold nights.
      closed: closedTouched ? closed : undefined,
    });

    if (!result.ok) {
      setErrors(issueMap(result.issues));
      return;
    }

    bulk.mutate(result.data, {
      onSuccess: (count) => {
        toast(t('applied', { count }));
        onClose();
      },
      onError: () => toast(tCommon('somethingWentWrong'), 'error'),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('bulkTitle')}
      subtitle={t('bulkSubtitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={bulk.isPending}>
            {bulk.isPending ? tCommon('saving') : t('applyToRange')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Grid2>
          <Field label={t('dateFrom')} required error={labels.validation(errors['from'])}>
            <TextInput
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="tnum latn"
              invalid={Boolean(errors['from'])}
            />
          </Field>
          <Field label={t('dateTo')} required error={labels.validation(errors['to'])}>
            <TextInput
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="tnum latn"
              invalid={Boolean(errors['to'])}
            />
          </Field>
        </Grid2>

        <Field label={t('weekdays')} help={weekdays.length === 0 ? t('everyDay') : undefined}>
          <div className="flex flex-wrap gap-3">
            {WEEKDAY_KEYS.map((key, index) => (
              <Checkbox
                key={key}
                checked={weekdays.includes(index)}
                onChange={(on) =>
                  setWeekdays((current) =>
                    on ? [...current, index] : current.filter((d) => d !== index),
                  )
                }
                label={weekdayLabels[index]}
              />
            ))}
          </div>
        </Field>

        <div className="h-px bg-line" />

        <Grid2>
          <Field label={t('price')} error={labels.validation(errors['price'])}>
            <NumberInput
              value={price}
              onValueChange={setPrice}
              min={0}
              step={5}
              invalid={Boolean(errors['price'])}
            />
          </Field>
          <Field label={t('priceWithoutDiscount')} help={t('priceWithoutDiscountHint')}>
            <NumberInput value={wasPrice} onValueChange={setWasPrice} min={0} step={5} />
          </Field>
        </Grid2>

        <Grid2>
          <Field
            label={t('discountPercent')}
            help={t('discountHint')}
            error={labels.validation(errors['discountPercent'])}
          >
            <NumberInput
              value={discount}
              onValueChange={setDiscount}
              min={0}
              max={100}
              invalid={Boolean(errors['discountPercent'])}
            />
          </Field>
          <Field label={t('minStay')}>
            <NumberInput value={minStay} onValueChange={setMinStay} min={1} />
          </Field>
        </Grid2>

        <Field label={t('blockUnits')} help={t('blockUnitsHint')}>
          <NumberInput value={blocked} onValueChange={setBlocked} min={0} />
        </Field>

        <Toggle
          checked={closed}
          onChange={(v) => {
            setClosed(v);
            setClosedTouched(true);
          }}
          label={t('closedForArrival')}
        />
      </div>
    </Modal>
  );
}

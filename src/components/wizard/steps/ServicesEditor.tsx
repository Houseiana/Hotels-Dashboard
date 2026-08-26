'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, Skeleton } from '@/components/ui/primitives';
import { Field, Grid2, NumberInput, Select } from '@/components/ui/form';
import { useLookup } from '@/lib/query/lookups';
import type { LookupName } from '@/lib/api/lookups';
import { formatMoney } from '@/lib/utils';

export type ServiceRow = { serviceId: number; price?: number };

/**
 * Priced extras, hotel-wide or per room type.
 *
 * One component for both because the interaction is identical and the only real
 * difference is which lookup the list comes from — keeping them together is
 * what stops the two screens drifting apart.
 *
 * A service is ADDED rather than shown as a row of empty price boxes: the API
 * stores only what the hotel actually sells. The PRICE is optional — it is
 * nullable server-side, for extras the hotel quotes on request — but an empty
 * box stays empty rather than becoming zero, which would say it is free.
 */
export function ServicesEditor({
  lookup,
  names,
  label,
  value,
  onChange,
  currency,
  title,
  hint,
  bare = false,
}: {
  lookup: LookupName;
  names: Readonly<Record<string, string>>;
  label: (slug: string) => string;
  value: ServiceRow[];
  onChange: (next: ServiceRow[]) => void;
  currency: string;
  title: string;
  hint?: string;
  /** Render without the Card chrome, for nesting inside a room-type panel. */
  bare?: boolean;
}) {
  const t = useTranslations('wizard.amenities');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const types = useLookup(lookup);
  const options = types.data ?? [];

  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState(0);
  const [price, setPrice] = useState<number | undefined>(undefined);

  const chosen = new Set(value.map((row) => row.serviceId));
  const available = options.filter((option) => !chosen.has(option.id));

  const slugForName = (name: string) =>
    Object.keys(names).find(
      (slug) => names[slug].trim().toLowerCase() === name.trim().toLowerCase(),
    );

  const nameOf = (serviceId: number) => {
    const option = options.find((o) => o.id === serviceId);
    if (!option) return `#${serviceId}`;
    const slug = slugForName(option.name);
    return slug ? label(slug) : option.name;
  };

  const startAdd = () => {
    setPick(available[0]?.id ?? 0);
    setPrice(undefined);
    setAdding(true);
  };

  const confirmAdd = () => {
    if (!pick) return;
    onChange([...value, { serviceId: pick, price }]);
    setAdding(false);
  };

  /**
   * An empty box stays empty rather than becoming a price of zero — the API
   * takes a null price, and "quoted on request" is a real thing a hotel offers.
   * Zero would tell guests the extra is free.
   */
  const setPriceFor = (serviceId: number, next: number | undefined) =>
    onChange(value.map((row) => (row.serviceId === serviceId ? { ...row, price: next } : row)));

  const hasPrice = (price: number | undefined) =>
    typeof price === 'number' && Number.isFinite(price);

  const remove = (serviceId: number) =>
    onChange(value.filter((row) => row.serviceId !== serviceId));

  const addButton =
    !adding && available.length > 0 ? (
      <Button size="sm" variant="ghost" className="text-accent-ink" onClick={startAdd}>
        <Plus className="size-3.5" />
        {t('addService')}
      </Button>
    ) : null;

  const body = (
    <>
      {types.isPending ? (
        <Skeleton className="h-16" />
      ) : options.length === 0 ? (
        // The lookup came back empty: there is no add button either, so say why
        // rather than showing "none yet" beside nothing to press.
        <p className="text-[13px] text-muted">{t('servicesEmpty')}</p>
      ) : value.length === 0 && !adding ? (
        <p className="text-[13px] text-muted">{t('servicesNoneYet')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {value.map((row) => (
            <div
              key={row.serviceId}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-ctl)] border border-line px-3.5 py-2.5"
            >
              <span className="text-[13.5px] font-medium text-ink">{nameOf(row.serviceId)}</span>
              <span className="ms-auto flex items-center gap-2.5">
                <div className="w-[120px]">
                  <NumberInput
                    value={row.price}
                    onValueChange={(v) => setPriceFor(row.serviceId, v)}
                    min={0}
                    step={25}
                    aria-label={`${nameOf(row.serviceId)} — ${t('servicePrice')}`}
                    placeholder={t('servicePriceOnRequest')}
                    className="py-1.5 text-end text-[13px] font-bold"
                  />
                </div>
                <span className="hidden text-[11.5px] text-faint sm:inline latn">
                  {hasPrice(row.price)
                    ? formatMoney(row.price, currency, locale)
                    : t('servicePriceOnRequest')}
                </span>
                <button
                  type="button"
                  onClick={() => remove(row.serviceId)}
                  aria-label={t('removeService')}
                  className="grid size-[28px] place-items-center rounded-[6px] text-faint transition hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="flex flex-col gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface-2 p-3">
          <Grid2>
            <Field label={t('serviceName')} required>
              <Select
                value={String(pick)}
                onChange={(e) => setPick(Number(e.target.value))}
                aria-label={t('serviceName')}
              >
                {available.map((option) => {
                  const slug = slugForName(option.name);
                  return (
                    <option key={option.id} value={option.id}>
                      {slug ? label(slug) : option.name}
                    </option>
                  );
                })}
              </Select>
            </Field>
            {/* Optional: `ServiceAssignmentDto.price` is nullable, so an extra
                can be listed and quoted on request. */}
            <Field label={t('servicePrice')} help={t('servicePriceHint')}>
              <NumberInput
                value={price}
                onValueChange={setPrice}
                min={0}
                step={25}
                aria-label={t('servicePrice')}
                placeholder={t('servicePriceOnRequest')}
                className="text-end font-bold"
              />
            </Field>
          </Grid2>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              onClick={confirmAdd}
              disabled={!pick}
            >
              {t('addService')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              {tCommon('cancel')}
            </Button>
          </div>
        </div>
      ) : null}

      {!adding && available.length === 0 && value.length > 0 ? (
        <p className="text-[11.5px] text-faint">{t('servicesAllAdded')}</p>
      ) : null}
    </>
  );

  if (bare) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[.06em] text-faint">
            {title}
          </span>
          {addButton}
        </div>
        {body}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader title={title} hint={hint} action={addButton} />
      <CardBody>{body}</CardBody>
    </Card>
  );
}

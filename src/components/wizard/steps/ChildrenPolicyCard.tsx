'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, Chip, Skeleton } from '@/components/ui/primitives';
import { Field, Grid2, Grid3, NumberInput, Select, Toggle } from '@/components/ui/form';
import { Modal } from '@/components/ui/overlay';
import { useLookup } from '@/lib/query/lookups';
import { PRICING_MODE_NAMES, PRICING_MODES_WITHOUT_VALUE, looseMatch } from '@/lib/api/catalogMap';
import { useCatalogLabels } from '@/lib/useLabels';
import { formatMoney, formatNumber } from '@/lib/utils';
import { useWizard } from '../WizardProvider';

type Band = {
  minAge: number;
  maxAge: number;
  ordinal: number;
  pricingMode: string;
  value?: number;
};

/** True for the two modes the API refuses a `value` for. */
const carriesValue = (slug: string) =>
  !PRICING_MODES_WITHOUT_VALUE.includes(slug as (typeof PRICING_MODES_WITHOUT_VALUE)[number]);

/**
 * Every rule the server enforces, checked here first.
 *
 * Duplicating the server's validation is deliberate: it rejects the whole
 * policy with one message, which would leave the owner hunting for which band
 * is wrong. Returning a message key per problem lets the dialog say it next to
 * the field. The server stays the authority — this only front-runs it.
 */
function bandProblem(
  band: Band,
  existing: Band[],
  minChildAge: number,
  maxChildAge: number,
): string | undefined {
  if (band.maxAge < band.minAge) return 'childAgeOrder';
  if (band.minAge < minChildAge || band.maxAge > maxChildAge) return 'childAgeOutside';
  if (band.ordinal < 1) return 'childOrdinalMin';
  if (carriesValue(band.pricingMode)) {
    if (typeof band.value !== 'number' || band.value <= 0) return 'childValueRequired';
    if (band.pricingMode === 'percentageDiscount' && band.value > 100) return 'childPercentRange';
  }
  // Bands may share an age range only when they price a DIFFERENT child.
  const clash = existing.some(
    (other) =>
      other.ordinal === band.ordinal &&
      band.minAge <= other.maxAge &&
      other.minAge <= band.maxAge,
  );
  return clash ? 'childBandOverlap' : undefined;
}

/**
 * Age-banded child pricing.
 *
 * A band says "the Nth child aged X–Y is charged this way". Bands are added one
 * at a time through a dialog because each one carries four related decisions
 * that only make sense together — a row of inline inputs invites half-filled
 * bands the server would reject as a batch.
 */
export function ChildrenPolicyCard() {
  const t = useTranslations('wizard.basics');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const labels = useCatalogLabels();
  const { draft, update } = useWizard();

  const modes = useLookup('childPricingMode');
  const policy = draft.childrenPolicy;
  const minAge = typeof policy.minChildAge === 'number' ? policy.minChildAge : 0;
  const maxAge = typeof policy.maxChildAge === 'number' ? policy.maxChildAge : 12;

  const [adding, setAdding] = useState(false);
  const [band, setBand] = useState<Band>({
    minAge: 0,
    maxAge: 5,
    ordinal: 1,
    pricingMode: 'free',
  });

  const setPolicy = (patch: Partial<typeof policy>) =>
    update({ childrenPolicy: { ...policy, ...patch } });

  const modeSlugs = (modes.data ?? [])
    .map((item) =>
      Object.keys(PRICING_MODE_NAMES).find(
        (slug) => looseMatch(PRICING_MODE_NAMES[slug]) === looseMatch(item.name),
      ),
    )
    .filter((slug): slug is string => Boolean(slug));

  const problem = bandProblem(band, policy.rules, minAge, maxAge);

  const openDialog = () => {
    setBand({ minAge, maxAge, ordinal: 1, pricingMode: modeSlugs[0] ?? 'free' });
    setAdding(true);
  };

  const confirmAdd = () => {
    if (problem) return;
    setPolicy({
      rules: [...policy.rules, { ...band, value: carriesValue(band.pricingMode) ? band.value : undefined }],
    });
    setAdding(false);
  };

  const removeBand = (index: number) =>
    setPolicy({ rules: policy.rules.filter((_, i) => i !== index) });

  const describe = (rule: Band) => {
    const label = labels.pricingMode(rule.pricingMode);
    if (rule.pricingMode === 'percentageDiscount') {
      return `${label} · ${formatNumber(rule.value ?? 0, locale)}%`;
    }
    if (rule.pricingMode === 'fixedAmount') {
      return `${label} · ${formatMoney(rule.value, draft.currency, locale)}`;
    }
    return label;
  };

  return (
    <Card>
      <CardHeader
        title={t('cardChildren')}
        hint={t('childrenHint')}
        action={
          policy.childrenAllowed ? (
            <Button size="sm" variant="ghost" className="text-accent-ink" onClick={openDialog}>
              <Plus className="size-3.5" />
              {t('addBand')}
            </Button>
          ) : null
        }
      />
      <CardBody>
        <Toggle
          checked={policy.childrenAllowed}
          onChange={(v) => setPolicy({ childrenAllowed: v })}
          label={t('childrenAllowed')}
        />

        {policy.childrenAllowed ? (
          <>
            <Grid2>
              <Field label={t('minChildAge')} help={t('childAgeHint')}>
                <NumberInput
                  value={policy.minChildAge}
                  onValueChange={(v) => setPolicy({ minChildAge: v })}
                  min={0}
                  max={17}
                  aria-label={t('minChildAge')}
                />
              </Field>
              <Field label={t('maxChildAge')}>
                <NumberInput
                  value={policy.maxChildAge}
                  onValueChange={(v) => setPolicy({ maxChildAge: v })}
                  min={0}
                  max={17}
                  aria-label={t('maxChildAge')}
                />
              </Field>
            </Grid2>

            {modes.isPending ? (
              <Skeleton className="h-16" />
            ) : policy.rules.length === 0 ? (
              <p className="text-[13px] text-muted">{t('childrenNoBands')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {policy.rules.map((rule, index) => (
                  <div
                    key={`${rule.ordinal}-${rule.minAge}-${rule.maxAge}`}
                    className="flex flex-wrap items-center gap-3 rounded-[var(--radius-ctl)] border border-line px-3.5 py-2.5"
                  >
                    <Chip tone="neutral" className="px-2 py-0 text-[11px]">
                      {t('nthChild', { n: rule.ordinal })}
                    </Chip>
                    <span className="text-[13.5px] font-medium text-ink latn">
                      {t('ageRange', { from: rule.minAge, to: rule.maxAge })}
                    </span>
                    <span className="ms-auto flex items-center gap-2.5">
                      <span className="text-[12.5px] text-muted">{describe(rule)}</span>
                      <button
                        type="button"
                        onClick={() => removeBand(index)}
                        aria-label={t('removeBand')}
                        className="grid size-[28px] place-items-center rounded-[6px] text-faint transition hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-[13px] text-muted">{t('childrenNotAllowedNote')}</p>
        )}
      </CardBody>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={t('addBand')}
        subtitle={t('bandHint')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              {tCommon('cancel')}
            </Button>
            <Button variant="primary" onClick={confirmAdd} disabled={Boolean(problem)}>
              {t('addBand')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Grid3>
            <Field label={t('bandFrom')} required>
              <NumberInput
                value={band.minAge}
                onValueChange={(v) => setBand({ ...band, minAge: v ?? 0 })}
                min={0}
                max={17}
                aria-label={t('bandFrom')}
              />
            </Field>
            <Field label={t('bandTo')} required>
              <NumberInput
                value={band.maxAge}
                onValueChange={(v) => setBand({ ...band, maxAge: v ?? 0 })}
                min={0}
                max={17}
                aria-label={t('bandTo')}
              />
            </Field>
            <Field label={t('ordinal')} help={t('ordinalHint')} required>
              <NumberInput
                value={band.ordinal}
                onValueChange={(v) => setBand({ ...band, ordinal: v ?? 1 })}
                min={1}
                max={9}
                aria-label={t('ordinal')}
              />
            </Field>
          </Grid3>

          <Field label={t('pricingMode')} required>
            <Select
              value={band.pricingMode}
              onChange={(e) => setBand({ ...band, pricingMode: e.target.value, value: undefined })}
              aria-label={t('pricingMode')}
              disabled={modes.isPending}
            >
              {modeSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {labels.pricingMode(slug)}
                </option>
              ))}
            </Select>
          </Field>

          {/* Free and As Adult carry no value — the API rejects one. */}
          {carriesValue(band.pricingMode) ? (
            <Field
              label={band.pricingMode === 'percentageDiscount' ? t('percentOff') : t('fixedAmount')}
              required
            >
              <NumberInput
                value={band.value}
                onValueChange={(v) => setBand({ ...band, value: v })}
                min={0}
                max={band.pricingMode === 'percentageDiscount' ? 100 : undefined}
                aria-label={t('bandValue')}
                className="text-end font-bold"
              />
            </Field>
          ) : null}

          {problem ? (
            <p className="rounded-[var(--radius-ctl)] border border-danger/40 bg-danger-soft px-3.5 py-2.5 text-[12.5px] font-medium text-danger">
              {t(problem)}
            </p>
          ) : null}
        </div>
      </Modal>
    </Card>
  );
}

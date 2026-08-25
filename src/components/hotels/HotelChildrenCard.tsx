'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Baby } from 'lucide-react';
import { Card, CardBody, CardHeader, Chip } from '@/components/ui/primitives';
import { PRICING_MODE_NAMES, looseMatch } from '@/lib/api/catalogMap';
import type { ChildrenPolicy } from '@/lib/schemas/hotelApi';
import { useCatalogLabels } from '@/lib/useLabels';
import { formatMoney, formatNumber } from '@/lib/utils';

/** "PercentageDiscount" and "Percentage Discount" both map to our slug. */
function slugForMode(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const needle = looseMatch(name);
  return Object.keys(PRICING_MODE_NAMES).find(
    (slug) => looseMatch(PRICING_MODE_NAMES[slug]) === needle,
  );
}

/**
 * The hotel's child pricing, read-only.
 *
 * Bands are ordered by child then by age, which is the order an owner reads
 * them in — "the first child aged 0–5, then 6–12; the second child…".
 */
export function HotelChildrenCard({
  policy,
  currency,
}: {
  policy: ChildrenPolicy | null | undefined;
  currency: string;
}) {
  const t = useTranslations('hotels');
  const tBasics = useTranslations('wizard.basics');
  const locale = useLocale();
  const labels = useCatalogLabels();

  const allowed = policy?.childrenAllowed ?? false;
  const rules = [...(policy?.rules ?? [])].sort(
    (a, b) => a.ordinal - b.ordinal || a.minAge - b.minAge,
  );

  const describe = (mode: string | null | undefined, value: number | null | undefined) => {
    const slug = slugForMode(mode);
    if (!slug) return mode ?? '';
    const label = labels.pricingMode(slug);
    if (slug === 'percentageDiscount') return `${label} · ${formatNumber(value ?? 0, locale)}%`;
    if (slug === 'fixedAmount') return `${label} · ${formatMoney(value ?? undefined, currency, locale)}`;
    return label;
  };

  return (
    <Card>
      <CardHeader title={t('children')} />
      <CardBody>
        {!allowed ? (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Baby className="size-4 shrink-0 text-faint" />
            {t('childrenNotAllowed')}
          </p>
        ) : rules.length === 0 ? (
          <p className="text-[13px] text-muted">{t('childrenNoBands')}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {typeof policy?.minChildAge === 'number' && typeof policy?.maxChildAge === 'number' ? (
              <p className="mb-1 text-[12px] text-faint latn">
                {tBasics('ageRange', { from: policy.minChildAge, to: policy.maxChildAge })}
              </p>
            ) : null}
            {rules.map((rule) => (
              <div
                key={`${rule.ordinal}-${rule.minAge}-${rule.maxAge}`}
                className="flex flex-wrap items-center gap-2.5 rounded-[var(--radius-ctl)] px-2.5 py-2 odd:bg-surface-2"
              >
                <Chip tone="neutral" className="px-2 py-0 text-[11px]">
                  {tBasics('nthChild', { n: rule.ordinal })}
                </Chip>
                <span className="text-[13px] text-ink latn">
                  {tBasics('ageRange', { from: rule.minAge, to: rule.maxAge })}
                </span>
                <span className="ms-auto text-[13px] font-semibold text-ink">
                  {describe(rule.pricingMode, rule.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

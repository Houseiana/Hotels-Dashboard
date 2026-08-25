'use client';

import { useTranslations } from 'next-intl';
import { Check, X } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { POLICY_TYPE_NAMES } from '@/lib/api/catalogMap';
import type { HotelPolicy } from '@/lib/schemas/hotelApi';
import { useCatalogLabels } from '@/lib/useLabels';
import { cn } from '@/lib/utils';

/** Display name → our slug, so an Arabic reader gets an Arabic label. */
function slugForName(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  const needle = name.trim().toLowerCase();
  return Object.keys(POLICY_TYPE_NAMES).find(
    (slug) => POLICY_TYPE_NAMES[slug].trim().toLowerCase() === needle,
  );
}

/**
 * The hotel's house rules, read-only.
 *
 * Allowed and not-allowed are given equal weight and distinct colour — "pets
 * are not allowed" is as much a fact a guest needs as the reverse, so it is not
 * hidden or greyed out. Rules the owner never answered simply are not here.
 */
export function HotelPoliciesCard({ policies }: { policies: HotelPolicy[] }) {
  const t = useTranslations('hotels');
  const labels = useCatalogLabels();

  // Allowed first, then the restrictions — the shape of the list itself tells
  // the reader roughly how permissive the hotel is.
  const sorted = [...policies].sort((a, b) => Number(b.allowed) - Number(a.allowed));

  return (
    <Card>
      <CardHeader title={t('houseRules')} />
      <CardBody>
        {sorted.length === 0 ? (
          <p className="text-[13px] text-muted">{t('houseRulesNone')}</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sorted.map((policy) => {
              const slug = slugForName(policy.name);
              return (
                <div
                  key={policy.policyTypeId}
                  className="flex items-center gap-2.5 rounded-[var(--radius-ctl)] px-2.5 py-2 odd:bg-surface-2"
                >
                  <span
                    className={cn(
                      'grid size-[22px] shrink-0 place-items-center rounded-full',
                      policy.allowed ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger',
                    )}
                  >
                    {policy.allowed ? (
                      <Check className="size-3.5" strokeWidth={2.8} />
                    ) : (
                      <X className="size-3.5" strokeWidth={2.8} />
                    )}
                  </span>
                  <span className="text-[13.5px] text-ink">
                    {slug ? labels.policyType(slug) : (policy.name ?? '')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

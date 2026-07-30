'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Chip, SubHeading } from '@/components/ui/primitives';
import { NumberInput, Select } from '@/components/ui/form';
import {
  BOARD_BASES,
  CANCELLATION_IS_REFUNDABLE,
  CANCELLATION_PRESETS,
  DEFAULT_CURRENCY,
  type CancellationPreset,
} from '@/lib/catalogs';
import { useCatalogLabels } from '@/lib/useLabels';
import type { RoomTypeDraft } from '@/lib/schemas/draft';
import { formatMoney } from '@/lib/utils';
import { useWizard } from '../WizardProvider';

/**
 * The owner picks a board basis and a cancellation preset; the shared model
 * stores the two booleans those imply (`breakfastIncluded`, `refundable`), so
 * the guest app never has to interpret a free-text policy.
 */
function presetFor(refundable: boolean): CancellationPreset {
  return refundable ? 'free24h' : 'nonRefundable';
}

export function RatePlanTable({
  room,
  roomIndex,
  errors,
}: {
  room: RoomTypeDraft;
  roomIndex: number;
  errors: Record<string, string>;
}) {
  const t = useTranslations('wizard.rooms');
  const labels = useCatalogLabels();
  const locale = useLocale();
  const { draft, addRatePlan, updateRatePlan, removeRatePlan } = useWizard();

  const planError = labels.validation(errors[`roomTypes[${roomIndex}].ratePlans`]);

  return (
    <div className="flex flex-col gap-2">
      <SubHeading hint={`· ${t('ratePlansScope')}`}>{t('ratePlans')}</SubHeading>

      <div className="overflow-hidden rounded-[var(--radius-ctl)] border border-line">
        <div className="grid grid-cols-[1.25fr_1.25fr_.85fr_34px] items-center gap-3 border-b border-line bg-surface-2 px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-[.05em] text-faint">
          <span>{t('colBoard')}</span>
          <span>{t('colCancellation')}</span>
          <span className="text-end">{t('colPrice')}</span>
          <span />
        </div>

        {room.ratePlans.length === 0 ? (
          <p className="px-3.5 py-4 text-center text-[12.5px] text-muted">{t('noRatePlans')}</p>
        ) : (
          room.ratePlans.map((plan, planIndex) => {
            const priceKey = `roomTypes[${roomIndex}].ratePlans[${planIndex}].pricePerNight`;
            return (
              <div
                key={plan.id}
                className="grid grid-cols-[1.25fr_1.25fr_.85fr_34px] items-center gap-3 border-b border-line px-3.5 py-2.5 last:border-0"
              >
                <Select
                  value={plan.boardBasis}
                  onChange={(e) =>
                    updateRatePlan(roomIndex, planIndex, {
                      boardBasis: e.target.value as (typeof BOARD_BASES)[number],
                    })
                  }
                  aria-label={t('colBoard')}
                  className="py-1.5 text-[13px] font-semibold"
                >
                  {BOARD_BASES.map((basis) => (
                    <option key={basis} value={basis}>
                      {labels.boardBasis(basis)}
                    </option>
                  ))}
                </Select>

                <Select
                  value={presetFor(plan.refundable)}
                  onChange={(e) =>
                    updateRatePlan(roomIndex, planIndex, {
                      refundable:
                        CANCELLATION_IS_REFUNDABLE[e.target.value as CancellationPreset],
                    })
                  }
                  aria-label={t('colCancellation')}
                  className="py-1.5 text-[13px]"
                >
                  {CANCELLATION_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {labels.cancellation(preset)}
                    </option>
                  ))}
                </Select>

                <NumberInput
                  value={plan.pricePerNight}
                  onValueChange={(v) => updateRatePlan(roomIndex, planIndex, { pricePerNight: v })}
                  min={0}
                  step={5}
                  aria-label={t('colPrice')}
                  invalid={Boolean(errors[priceKey])}
                  className="py-1.5 text-end text-[13px] font-bold"
                />

                <button
                  type="button"
                  onClick={() => removeRatePlan(roomIndex, planIndex)}
                  aria-label={t('removeRatePlan')}
                  className="grid size-[26px] place-items-center justify-self-end rounded-[6px] text-faint transition hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <Button size="sm" variant="ghost" className="text-accent-ink" onClick={() => addRatePlan(roomIndex)}>
          <Plus className="size-3.5" />
          {t('addRatePlan')}
        </Button>
        <span className="text-[11.5px] text-faint">{t('seasonalNote')}</span>
      </div>

      {planError ? (
        <p className="text-[11.5px] font-medium text-danger">{planError}</p>
      ) : null}

      {room.ratePlans.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {room.ratePlans.map((plan) => (
            <Chip key={`${plan.id}-summary`} tone={plan.refundable ? 'active' : 'neutral'} dot={plan.refundable}>
              {labels.boardBasis(plan.boardBasis)} ·{' '}
              <span className="latn">
                {formatMoney(
                  typeof plan.pricePerNight === 'number' ? plan.pricePerNight : undefined,
                  draft.currency || DEFAULT_CURRENCY,
                  locale,
                )}
              </span>
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

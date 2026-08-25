'use client';

import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button, SubHeading } from '@/components/ui/primitives';
import { NumberInput, Select } from '@/components/ui/form';
import {
  CANCELLATION_IS_REFUNDABLE,
  CANCELLATION_PRESETS,
  DEFAULT_CURRENCY,
  type CancellationPreset,
} from '@/lib/catalogs';
import { BOARD_NAMES } from '@/lib/api/catalogMap';
import { labelFor, useLookupOptions } from '@/lib/query/lookupOptions';
import type { BoardBasis } from '@/lib/schemas/hotel';
import { useCatalogLabels } from '@/lib/useLabels';
import type { RoomTypeDraft } from '@/lib/schemas/draft';
import { useWizard } from '../WizardProvider';

/**
 * The owner picks a board basis and a cancellation preset; the shared model
 * stores the two booleans those imply (`breakfastIncluded`, `refundable`), so
 * the guest app never has to interpret a free-text policy.
 */
function presetFor(refundable: boolean): CancellationPreset {
  return refundable ? 'free24h' : 'nonRefundable';
}

/**
 * A room's rate plans.
 *
 * Genuinely tabular — three parallel decisions repeated per plan — so it stays
 * a grid rather than becoming a stack of cards. What changed is the noise
 * around it: the plans used to be listed twice, once as editable rows and again
 * as summary chips underneath, and the price was a bare number with no currency
 * anywhere near it.
 */
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
  const { draft, addRatePlan, updateRatePlan, removeRatePlan } = useWizard();
  // The server decides which board bases exist — it has two we never listed.
  const boards = useLookupOptions('boardBasis', BOARD_NAMES, labels.boardBasis);

  const planError = labels.validation(errors[`roomTypes[${roomIndex}].ratePlans`]);
  const currency = draft.currency || DEFAULT_CURRENCY;

  /** Shared by the header and every row, so the columns cannot drift apart. */
  const columns = 'grid grid-cols-[1.2fr_1.2fr_minmax(140px,.9fr)_32px] items-center gap-3';

  return (
    <div className="flex flex-col gap-2">
      <SubHeading hint={`· ${t('ratePlansScope')}`}>{t('ratePlans')}</SubHeading>

      <div className="overflow-hidden rounded-[var(--radius-ctl)] border border-line">
        <div
          className={`${columns} border-b border-line bg-surface-2 px-3.5 py-2 text-[10.5px] font-semibold uppercase tracking-[.05em] text-muted`}
        >
          <span>{t('colBoard')}</span>
          <span>{t('colCancellation')}</span>
          <span className="text-end">{t('colPrice')}</span>
          <span />
        </div>

        {room.ratePlans.length === 0 ? (
          <p className="px-3.5 py-5 text-center text-[12.5px] text-muted">{t('noRatePlans')}</p>
        ) : (
          room.ratePlans.map((plan, planIndex) => {
            const priceKey = `roomTypes[${roomIndex}].ratePlans[${planIndex}].pricePerNight`;
            return (
              <div
                key={plan.id}
                className={`${columns} group border-b border-line px-3.5 py-2.5 transition-colors last:border-0 hover:bg-surface-2`}
              >
                <Select
                  value={plan.boardBasis}
                  onChange={(e) =>
                    updateRatePlan(roomIndex, planIndex, {
                      boardBasis: e.target.value as BoardBasis,
                    })
                  }
                  aria-label={t('colBoard')}
                  className="py-1.5 text-[13px]"
                  disabled={boards.isPending}
                >
                  {!boards.options.some((o) => o.value === plan.boardBasis) ? (
                    <option value={plan.boardBasis}>
                      {labelFor(plan.boardBasis, boards.options, labels.boardBasis)}
                    </option>
                  ) : null}
                  {boards.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>

                {/* Bound to the preset, not to `refundable`. Deriving the value
                    from the boolean collapsed four options into two, so picking
                    "48 hours" or "7 days" snapped straight back to 24. */}
                <Select
                  value={plan.cancellation || presetFor(plan.refundable)}
                  onChange={(e) => {
                    const preset = e.target.value as CancellationPreset;
                    updateRatePlan(roomIndex, planIndex, {
                      cancellation: preset,
                      // Kept in step for the shared guest model, which has no
                      // concept of the window.
                      refundable: CANCELLATION_IS_REFUNDABLE[preset],
                    });
                  }}
                  aria-label={t('colCancellation')}
                  className="py-1.5 text-[13px]"
                >
                  {CANCELLATION_PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {labels.cancellation(preset)}
                    </option>
                  ))}
                </Select>

                {/* The currency sits inside the field: a bare number box left the
                    owner guessing which currency they were typing. */}
                <div className="relative">
                  <NumberInput
                    value={plan.pricePerNight}
                    onValueChange={(v) => updateRatePlan(roomIndex, planIndex, { pricePerNight: v })}
                    min={0}
                    step={5}
                    aria-label={`${t('colPrice')} (${currency})`}
                    invalid={Boolean(errors[priceKey])}
                    className="py-1.5 text-end text-[13px] font-bold pe-11"
                  />
                  <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-[11px] font-semibold text-faint end-3 latn">
                    {currency}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => removeRatePlan(roomIndex, planIndex)}
                  aria-label={t('removeRatePlan')}
                  className="grid size-[26px] place-items-center justify-self-end rounded-[6px] text-faint opacity-60 transition hover:bg-danger-soft hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {planError ? <p className="text-[11.5px] font-medium text-danger">{planError}</p> : null}

      {/* Action first, then the aside — they used to sit on one line pulling
          against each other. */}
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="self-start text-accent-ink"
          onClick={() => addRatePlan(roomIndex)}
        >
          <Plus className="size-3.5" />
          {t('addRatePlan')}
        </Button>
        <span className="text-[11.5px] text-faint">{t('seasonalNote')}</span>
      </div>
    </div>
  );
}

'use client';

import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import type { DayInventory } from '@/lib/schemas/booking';
import { formatDate, formatMoney } from '@/lib/utils';

/** Where the hovered cell sits on screen, in viewport coordinates. */
export type CellAnchor = { top: number; bottom: number; left: number; width: number };

const WIDTH = 196;
/** Roughly the tallest the panel gets; only used to decide flip direction. */
const ESTIMATED_HEIGHT = 148;
const GAP = 8;
const EDGE = 8;

/**
 * The day detail panel, rendered into `document.body`.
 *
 * It cannot live inside the calendar: that grid scrolls horizontally, and
 * `overflow-x: auto` clips on BOTH axes — the spec turns the other axis into
 * `auto` too, so an absolutely positioned panel gets cut off at the top row
 * rather than overflowing the card. A portal plus fixed coordinates takes it
 * out of that clipping context entirely.
 */
export function DayTooltip({
  day,
  total,
  currency,
  anchor,
}: {
  day: DayInventory;
  total: number;
  currency: string;
  anchor: CellAnchor;
}) {
  const t = useTranslations('pricing');
  const locale = useLocale();

  if (typeof document === 'undefined') return null;

  const available = Math.max(0, total - day.sold - day.blocked);

  // Above the cell by default; below it when the top row would be clipped.
  const flipBelow = anchor.top < ESTIMATED_HEIGHT + GAP + EDGE;
  const top = flipBelow ? anchor.bottom + GAP : anchor.top - GAP;

  // Centre on the cell, then keep it inside the viewport on both sides.
  const centred = anchor.left + anchor.width / 2 - WIDTH / 2;
  const left = Math.min(Math.max(centred, EDGE), window.innerWidth - WIDTH - EDGE);

  const rows: Array<[string, string | number]> = [
    [t('capacity'), total],
    [t('soldPlatform'), day.sold],
    [t('blockedManual'), day.blocked],
  ];

  return createPortal(
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        top,
        left,
        width: WIDTH,
        transform: flipBelow ? undefined : 'translateY(-100%)',
      }}
      className="pointer-events-none z-[100] rounded-[9px] bg-ink px-2.5 py-2.5 text-[11.5px] text-surface shadow-[var(--shadow-pop)]"
    >
      <span className="mb-1.5 block text-[12px] font-bold">{formatDate(day.date, locale)}</span>

      {rows.map(([label, value]) => (
        <span key={label} className="flex justify-between gap-3 py-px opacity-80">
          <span>{label}</span>
          <b className="latn">{value}</b>
        </span>
      ))}

      <span className="mt-1 flex justify-between gap-3 border-t border-surface/30 pt-1.5">
        <span>{t('available')}</span>
        <b className="latn">{available}</b>
      </span>

      <span className="flex justify-between gap-3 py-px opacity-80">
        <span>{t('rate')}</span>
        <b className="latn">{formatMoney(day.price, currency, locale)}</b>
      </span>

      {day.isSpecialPrice ? (
        <span className="mt-1 block text-[10.5px] font-bold text-accent">{t('specialPrice')}</span>
      ) : null}
    </div>,
    document.body,
  );
}

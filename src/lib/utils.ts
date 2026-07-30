import type { CSSProperties } from 'react';

/** Tiny classname joiner — no runtime dependency needed for this app's size. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

let idCounter = 0;
export function makeId(prefix: string): string {
  idCounter += 1;
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}${idCounter.toString(36)}`;
}

/* -- photos ---------------------------------------------------------------- */

/**
 * A photo is either a real URL or a `gradient:N` placeholder token. Both are
 * plain strings, so `photos: string[]` in the shared model stays honest while
 * the mock data set needs no binary assets.
 */
export const GRADIENTS = [
  'linear-gradient(135deg,#2a5f75,#3a8c8c 55%,#7fb6a6)',
  'linear-gradient(135deg,#3d5a80,#5a7fa8 60%,#98c1d9)',
  'linear-gradient(135deg,#5e6472,#8a94a6)',
  'linear-gradient(135deg,#2f6d63,#57a08f 60%,#a7cbb6)',
  'linear-gradient(135deg,#7a5c58,#b08a72 60%,#d8b78f)',
  'linear-gradient(135deg,#4a4066,#7c6ba0 60%,#b9a7d6)',
];

export function isGradient(photo: string): boolean {
  return photo.startsWith('gradient:');
}

export function gradientToken(index: number): string {
  return `gradient:${index % GRADIENTS.length}`;
}

export function photoStyle(photo: string | undefined): CSSProperties {
  if (!photo) return { background: GRADIENTS[2] };
  if (isGradient(photo)) {
    const index = Number(photo.slice('gradient:'.length)) || 0;
    return { background: GRADIENTS[index % GRADIENTS.length] };
  }
  return {
    backgroundImage: `url(${photo})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

/* -- numbers & dates ------------------------------------------------------- */

export function formatMoney(
  value: number | undefined,
  currency: string,
  locale: string,
  opts: { compact?: boolean } = {},
): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
    notation: opts.compact ? 'compact' : 'standard',
  }).format(value);
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US').format(value);
}

/** Local-time ISO date (yyyy-mm-dd) — never shifts a day via UTC. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(fromISODate(iso));
}

export function formatDateShort(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(fromISODate(iso));
}

export function nightsBetween(from: string, to: string): number {
  const ms = fromISODate(to).getTime() - fromISODate(from).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function monthMatrixStart(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  return addDays(first, -first.getDay());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/* -- bed configuration ----------------------------------------------------- */

export type BedRow = { type: string; qty: number };

/**
 * `bedConfig` is a plain string in the shared model. The wizard edits it as
 * rows, so it is serialised as `qty×type` pairs that survive a round trip.
 */
export function formatBedConfig(rows: BedRow[]): string {
  return rows
    .filter((r) => r.qty > 0 && r.type)
    .map((r) => `${r.qty}x${r.type}`)
    .join(', ');
}

export function parseBedConfig(config: string | undefined): BedRow[] {
  if (!config) return [];
  return config
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = /^(\d+)\s*x\s*(.+)$/i.exec(part);
      if (match) return { qty: Number(match[1]), type: match[2].trim() };
      return { qty: 1, type: part };
    });
}

export function totalBeds(rows: BedRow[]): number {
  return rows.reduce((sum, r) => sum + (Number.isFinite(r.qty) ? r.qty : 0), 0);
}

/* -- misc ------------------------------------------------------------------ */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function toNumberOrUndefined(raw: string): number | undefined {
  if (raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

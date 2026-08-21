'use client';

import { useMemo } from 'react';
import { useLookup } from './lookups';
import type { LookupName } from '../api/lookups';
import { idSlug, parseIdSlug } from '../api/catalogMap';

/* ---------------------------------------------------------------------------
 * Server lookups → dropdown options.
 *
 * The server owns WHICH values exist; the dashboard owns what they are CALLED
 * in Arabic. So the option list is built from the server's response, in the
 * server's order, and each entry is labelled from our translations when we have
 * one and from the server's own English name when we don't.
 *
 * This is what stops the wizard offering a choice that cannot be saved: if the
 * backend drops a bed type, it disappears from the dropdown on the next load
 * with no code change.
 * ------------------------------------------------------------------------- */

export type LookupOption = {
  /** Stored in the draft: our slug, or "#<id>" for an untranslated entry. */
  value: string;
  label: string;
  id: number;
};

export function useLookupOptions(
  name: LookupName,
  names: Readonly<Record<string, string>>,
  translate: (slug: string) => string,
): { options: LookupOption[]; isPending: boolean; isError: boolean } {
  const query = useLookup(name);

  const options = useMemo(() => {
    const nameToSlug = new Map(
      Object.entries(names).map(([slug, label]) => [label.trim().toLowerCase(), slug]),
    );
    return (query.data ?? []).map((item): LookupOption => {
      const slug = nameToSlug.get(item.name.trim().toLowerCase());
      return {
        id: item.id,
        value: slug ?? idSlug(item.id),
        label: slug ? translate(slug) : item.name,
      };
    });
  }, [query.data, names, translate]);

  return { options, isPending: query.isPending, isError: query.isError };
}

/**
 * Labels a value the draft already holds, even when the server no longer offers
 * it — an existing hotel must not render a blank where its bed type used to be.
 */
export function labelFor(
  value: string | undefined,
  options: LookupOption[],
  translate: (slug: string) => string,
): string {
  if (!value) return '';
  const match = options.find((option) => option.value === value);
  if (match) return match.label;
  const id = parseIdSlug(value);
  return id === undefined ? translate(value) : String(id);
}

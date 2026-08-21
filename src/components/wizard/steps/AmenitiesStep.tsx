'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card, CardBody, CardHeader, Skeleton } from '@/components/ui/primitives';
import { SelectChip } from '@/components/ui/form';
import { AMENITY_GROUPS } from '@/lib/catalogs';
import { AMENITY_NAMES } from '@/lib/api/catalogMap';
import { useLookupOptions, type LookupOption } from '@/lib/query/lookupOptions';
import { useCatalogLabels } from '@/lib/useLabels';
import { useWizard } from '../WizardProvider';
import { PanelIntro } from './PanelIntro';

export function AmenitiesStep() {
  const t = useTranslations('wizard.amenities');
  const labels = useCatalogLabels();
  const { draft, update, errorsFor } = useWizard();
  const error = labels.validation(errorsFor('amenities')['amenities']);

  // The server owns the list; our groups are only a way to arrange it.
  const { options, isPending } = useLookupOptions('amenities', AMENITY_NAMES, labels.amenity);

  const groups = useMemo(() => {
    const byValue = new Map(options.map((option) => [option.value, option]));
    const placed = new Set<string>();

    const known = AMENITY_GROUPS.map((group) => {
      const items = group.items
        .map((slug) => byValue.get(slug))
        .filter((option): option is LookupOption => Boolean(option));
      items.forEach((option) => placed.add(option.value));
      return { id: group.id, label: labels.amenityGroup(group.id), items };
    }).filter((group) => group.items.length > 0);

    // Anything the server offers that our taxonomy has never seen still has to
    // be selectable, or the backend adding an amenity would hide it.
    const rest = options.filter((option) => !placed.has(option.value));
    return rest.length
      ? [...known, { id: 'other', label: t('groupOther'), items: rest }]
      : known;
  }, [options, labels, t]);

  const selected = new Set(draft.amenities);

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    update({ amenities: [...next] });
  };

  const setGroup = (items: LookupOption[], on: boolean) => {
    const next = new Set(selected);
    for (const item of items) {
      if (on) next.add(item.value);
      else next.delete(item.value);
    }
    update({ amenities: [...next] });
  };

  return (
    <>
      <PanelIntro title={t('title')} subtitle={t('subtitle')} />

      {error ? (
        <p className="rounded-[var(--radius-ctl)] border border-danger/40 bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}

      {isPending ? (
        <>
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </>
      ) : (
        groups.map((group) => {
          const allOn = group.items.every((item) => selected.has(item.value));
          return (
            <Card key={group.id}>
              <CardHeader
                title={group.label}
                hint={t('selectedCount', {
                  count: group.items.filter((item) => selected.has(item.value)).length,
                })}
                action={
                  <Button size="sm" variant="ghost" onClick={() => setGroup([...group.items], !allOn)}>
                    {allOn ? t('clearGroup') : t('selectAll')}
                  </Button>
                }
              />
              <CardBody>
                <div className="flex flex-wrap gap-2">
                  {group.items.map((item) => (
                    <SelectChip
                      key={item.value}
                      selected={selected.has(item.value)}
                      onToggle={() => toggle(item.value)}
                    >
                      {item.label}
                    </SelectChip>
                  ))}
                </div>
              </CardBody>
            </Card>
          );
        })
      )}

      <p className="text-[11.5px] text-faint">
        {t('scopeNote', {
          groups: groups.map((g) => g.label).join(' · '),
          count: draft.amenities.length,
        })}
      </p>
    </>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { Button, Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { SelectChip } from '@/components/ui/form';
import { HOTEL_AMENITY_GROUPS } from '@/lib/catalogs';
import { useCatalogLabels } from '@/lib/useLabels';
import { useWizard } from '../WizardProvider';
import { PanelIntro } from './PanelIntro';

export function AmenitiesStep() {
  const t = useTranslations('wizard.amenities');
  const labels = useCatalogLabels();
  const { draft, update, errorsFor } = useWizard();
  const error = labels.validation(errorsFor('amenities')['amenities']);

  const selected = new Set(draft.amenities);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update({ amenities: [...next] });
  };

  const setGroup = (items: readonly string[], on: boolean) => {
    const next = new Set(selected);
    for (const id of items) {
      if (on) next.add(id);
      else next.delete(id);
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

      {HOTEL_AMENITY_GROUPS.map((group) => {
        const allOn = group.items.every((id) => selected.has(id));
        return (
          <Card key={group.id}>
            <CardHeader
              title={labels.amenityGroup(group.id)}
              hint={t('selectedCount', {
                count: group.items.filter((id) => selected.has(id)).length,
              })}
              action={
                <Button size="sm" variant="ghost" onClick={() => setGroup(group.items, !allOn)}>
                  {allOn ? t('clearGroup') : t('selectAll')}
                </Button>
              }
            />
            <CardBody>
              <div className="flex flex-wrap gap-2">
                {group.items.map((id) => (
                  <SelectChip key={id} selected={selected.has(id)} onToggle={() => toggle(id)}>
                    {labels.amenity(id)}
                  </SelectChip>
                ))}
              </div>
            </CardBody>
          </Card>
        );
      })}

      <p className="text-[11.5px] text-faint">
        {t('scopeNote', {
          groups: HOTEL_AMENITY_GROUPS.map((g) => labels.amenityGroup(g.id)).join(' · '),
          count: draft.amenities.length,
        })}
      </p>
    </>
  );
}

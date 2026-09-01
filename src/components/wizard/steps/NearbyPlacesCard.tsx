'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapPinned, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, Chip } from '@/components/ui/primitives';
import {
  ArabicInput,
  ArabicTextArea,
  Field,
  Grid2,
  Grid3,
  NumberInput,
  Select,
  TextArea,
  TextInput,
  Toggle,
} from '@/components/ui/form';
import {
  NEARBY_CATEGORY_BY_ID,
  NEARBY_CATEGORY_EMOJI,
  NEARBY_TIME_OF_DAY,
} from '@/lib/api/catalogMap';
import { dayPlanOrders } from '@/lib/api/nearbyPlaces';
import { useHotelNearbyPlaces } from '@/lib/query/hooks';
import { useLookup } from '@/lib/query/lookups';
import { useCatalogLabels } from '@/lib/useLabels';
import type { HotelNearbyPlace } from '@/lib/schemas/hotel';
import { cn } from '@/lib/utils';
import { useWizard } from '../WizardProvider';

/* ---------------------------------------------------------------------------
 * What is around the hotel — the same thing the guest app shows for a property.
 *
 * Over there ("your day here") the seven categories are tabs, each place is a
 * card under one of them, and the places carrying a display order form the
 * suggested day. This is the other end of exactly that: one tab per category,
 * a place edited under the tab it belongs to, and a "part of the day plan"
 * toggle that decides whether a place becomes one of those steps.
 *
 * These used to be invented from the map pin and shown read-only, because the
 * API had nowhere to put them. It has `nearby-places` create / edit / delete
 * now, so they are the owner's own rows.
 * ------------------------------------------------------------------------- */

export function NearbyPlacesCard() {
  const t = useTranslations('wizard.location');
  const labels = useCatalogLabels();
  const { draft, update } = useWizard();
  const categories = useLookup('nearbyCategories');

  const places = draft.nearby ?? [];
  const [activeId, setActiveId] = useState<number | null>(null);

  /* An existing hotel's places live on the server, not in the hotel record the
     wizard was built from. Seed them once, and only into an empty list, so a
     local draft with unsaved rows is never overwritten by the older copy. */
  const seeded = useRef(false);
  const saved = useHotelNearbyPlaces(draft.id);
  useEffect(() => {
    if (seeded.current || !saved.data?.length) return;
    seeded.current = true;
    if ((draft.nearby ?? []).length > 0) return;
    update({ nearby: saved.data });
  }, [saved.data, draft.nearby, update]);

  const tabs = categories.data ?? [];
  const currentId = activeId ?? tabs[0]?.id ?? null;

  /* Rows are edited in place, so every row keeps its index in the whole list —
     the day plan is numbered across categories, not within one tab. */
  const rows = places
    .map((place, index) => ({ place, index }))
    .filter(({ place }) => place.categoryId === currentId);

  const planned = dayPlanOrders(places);

  const commit = (next: HotelNearbyPlace[]) => update({ nearby: next });

  const patch = (index: number, changes: Partial<HotelNearbyPlace>) =>
    commit(places.map((place, i) => (i === index ? { ...place, ...changes } : place)));

  const add = () => {
    if (currentId === null) return;
    commit([...places, { name: '', categoryId: currentId }]);
  };

  /** The lookup localises `name`, so the tab is labelled by its id. */
  const tabLabel = (id: number, fallback: string): string => {
    const slug = NEARBY_CATEGORY_BY_ID[id];
    return slug ? labels.nearbyCategory(slug) : fallback;
  };

  return (
    <Card>
      <CardHeader
        title={t('cardNearby')}
        hint={t('nearbyHint')}
        action={
          <Button size="sm" variant="ghost" onClick={add} disabled={currentId === null}>
            <Plus className="size-3.5" />
            {t('nearbyAdd')}
          </Button>
        }
      />
      <CardBody>
        {/* One tab per category, in the server's order — the same tabs, with the
            same emoji, that a guest sees on the property page. */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((category) => {
            const count = places.filter((p) => p.categoryId === category.id).length;
            const active = category.id === currentId;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveId(category.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors',
                  active
                    ? 'border-accent bg-accent-soft font-semibold text-accent-ink'
                    : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
                )}
              >
                <span className="text-[14px] leading-none">
                  {NEARBY_CATEGORY_EMOJI[category.id] ?? '📍'}
                </span>
                <span>{tabLabel(category.id, category.name)}</span>
                {count > 0 ? <span className="text-[11px] text-faint latn">{count}</span> : null}
              </button>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <p className="flex flex-col items-center gap-1.5 rounded-[var(--radius-ctl)] border border-dashed border-line-strong bg-surface-2 px-4 py-6 text-center text-[13px] text-muted">
            <MapPinned className="size-4 text-faint" />
            {t('nearbyEmpty')}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map(({ place, index }) => (
              <div
                key={place.id ?? `new-${index}`}
                className="flex flex-col gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface-2 p-3"
              >
                <Grid2>
                  <Field label={t('nearbyName')} required>
                    <TextInput
                      value={place.name}
                      onChange={(e) => patch(index, { name: e.target.value })}
                      placeholder={t('nearbyNamePlaceholder')}
                    />
                  </Field>
                  <Field label={t('nearbyName')} labelHint="(العربية)">
                    <ArabicInput
                      value={place.nameAr ?? ''}
                      onChange={(e) => patch(index, { nameAr: e.target.value })}
                    />
                  </Field>
                </Grid2>

                <Grid2>
                  <Field label={t('nearbyDescription')} help={t('nearbyDescriptionHint')}>
                    <TextArea
                      value={place.description ?? ''}
                      onChange={(e) => patch(index, { description: e.target.value })}
                    />
                  </Field>
                  <Field label={t('nearbyDescription')} labelHint="(العربية)">
                    <ArabicTextArea
                      value={place.descriptionAr ?? ''}
                      onChange={(e) => patch(index, { descriptionAr: e.target.value })}
                    />
                  </Field>
                </Grid2>

                <Grid3>
                  <Field label={t('nearbyDistance')} help={t('nearbyDistanceHint')}>
                    <NumberInput
                      value={place.distanceMeters}
                      onValueChange={(v) => patch(index, { distanceMeters: v })}
                      min={0}
                      step={50}
                      aria-label={t('nearbyDistance')}
                    />
                  </Field>
                  <Field label={t('nearbyWalk')}>
                    <NumberInput
                      value={place.walkMinutes}
                      onValueChange={(v) => patch(index, { walkMinutes: v })}
                      min={0}
                      aria-label={t('nearbyWalk')}
                    />
                  </Field>
                  <Field label={t('nearbyDrive')}>
                    <NumberInput
                      value={place.driveMinutes}
                      onValueChange={(v) => patch(index, { driveMinutes: v })}
                      min={0}
                      aria-label={t('nearbyDrive')}
                    />
                  </Field>
                </Grid3>

                <Grid2>
                  <Field label={t('nearbyMapsUrl')}>
                    <TextInput
                      value={place.googleMapsUrl ?? ''}
                      onChange={(e) => patch(index, { googleMapsUrl: e.target.value })}
                      placeholder="https://maps.google.com/…"
                      className="latn"
                    />
                  </Field>
                  <Field label={t('nearbyRating')} help={t('nearbyRatingHint')}>
                    <NumberInput
                      value={place.rating}
                      onValueChange={(v) => patch(index, { rating: v })}
                      min={0}
                      max={5}
                      step={0.1}
                      aria-label={t('nearbyRating')}
                    />
                  </Field>
                </Grid2>

                {/* The suggested day. A place only becomes a step when the owner
                    says so; the step number is its position among the others. */}
                <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface p-3">
                  <Toggle
                    checked={Boolean(place.inDayPlan)}
                    onChange={(checked) => patch(index, { inDayPlan: checked })}
                    label={t('nearbyInPlan')}
                  />
                  {place.inDayPlan ? (
                    <>
                      <Chip tone="accent" className="latn">
                        {t('nearbyPlanStep', { step: planned.get(index) ?? 0 })}
                      </Chip>
                      <Select
                        value={place.timeOfDay ?? ''}
                        onChange={(e) =>
                          patch(index, {
                            timeOfDay: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                        aria-label={t('nearbyTimeOfDay')}
                        className="max-w-[190px] py-1.5 text-[13px]"
                      >
                        <option value="">{t('nearbyTimeOfDayNone')}</option>
                        {NEARBY_TIME_OF_DAY.map((step) => (
                          <option key={step.id} value={step.id}>
                            {labels.itineraryStep(step.slug)}
                          </option>
                        ))}
                      </Select>
                    </>
                  ) : null}
                </div>

                <div>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => commit(places.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="size-3.5" />
                    {t('nearbyRemove')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

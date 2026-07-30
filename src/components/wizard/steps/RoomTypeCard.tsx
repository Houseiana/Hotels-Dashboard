'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, Plus, Trash2, X } from 'lucide-react';
import { Button, Chip, SubHeading } from '@/components/ui/primitives';
import {
  ArabicInput,
  ArabicTextArea,
  Field,
  Grid2,
  Grid3,
  NumberInput,
  Select,
  SelectChip,
  TextArea,
  TextInput,
} from '@/components/ui/form';
import {
  BED_TYPES,
  DEFAULT_CURRENCY,
  ROOM_AMENITIES,
  ROOM_CATEGORIES,
  ROOM_VIEWS,
} from '@/lib/catalogs';
import { useCatalogLabels } from '@/lib/useLabels';
import type { RoomTypeDraft } from '@/lib/schemas/draft';
import {
  cn,
  formatBedConfig,
  formatMoney,
  parseBedConfig,
  photoStyle,
  totalBeds,
  type BedRow,
} from '@/lib/utils';
import { useWizard } from '../WizardProvider';
import { RatePlanTable } from './RatePlanTable';

export function RoomTypeCard({
  room,
  index,
  open,
  isNew,
  onToggle,
  onRemove,
}: {
  room: RoomTypeDraft;
  index: number;
  open: boolean;
  isNew: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const t = useTranslations('wizard.rooms');
  const labels = useCatalogLabels();
  const locale = useLocale();
  const { draft, updateRoom, errorsFor } = useWizard();
  const errors = errorsFor('rooms');
  const key = (field: string) => errors[`roomTypes[${index}].${field}`];

  const bedRows = parseBedConfig(room.bedConfig);

  /** `beds` is the total count and `bedConfig` the breakdown — always in step. */
  const commitBeds = (rows: BedRow[]) =>
    updateRoom(index, { bedConfig: formatBedConfig(rows), beds: totalBeds(rows) });

  const cheapest = room.ratePlans
    .map((p) => p.pricePerNight)
    .filter((p): p is number => typeof p === 'number')
    .sort((a, b) => a - b)[0];

  const roomAmenities = new Set(room.amenities);
  const toggleAmenity = (id: string) => {
    const next = new Set(roomAmenities);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    updateRoom(index, { amenities: [...next] });
  };

  const hasIssues = Object.keys(errors).some((k) => k.startsWith(`roomTypes[${index}]`));

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--radius-card)] border bg-surface',
        isNew ? 'border-accent shadow-[0_0_0_3px_var(--accent-soft)]' : 'border-line',
        hasIssues && !isNew && 'border-danger/50',
        open && 'shadow-[var(--shadow-card)]',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-start transition-colors hover:bg-surface-2"
      >
        <span
          className="size-[46px] shrink-0 rounded-[8px]"
          style={photoStyle(room.photos[0] ?? draft.coverPhoto)}
        />

        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex items-center gap-2 text-[14.5px] font-semibold tracking-[-.01em] text-ink">
            <span className="truncate">{room.name || t('untitledRoom')}</span>
            {isNew ? (
              <Chip tone="active" dot className="shrink-0 px-2 py-0 text-[10.5px]">
                {t('newBadge')}
              </Chip>
            ) : null}
          </span>
          <span className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
            <Chip tone="neutral" className="px-2 py-0 text-[11px]">
              {labels.category(room.category)}
            </Chip>
            {room.view ? <span>{labels.view(room.view)}</span> : null}
            {room.sizeM2 ? (
              <>
                <span className="text-line-strong">·</span>
                <span className="latn">{t('sizeM2', { size: room.sizeM2 })}</span>
              </>
            ) : null}
            {room.capacity ? (
              <>
                <span className="text-line-strong">·</span>
                <span>{t('sleeps', { count: room.capacity })}</span>
              </>
            ) : null}
          </span>
        </span>

        <span className="ms-auto flex items-center gap-5">
          <span className="hidden flex-col items-end sm:flex">
            <span className="text-[15px] font-bold tracking-[-.01em] text-ink latn">
              {room.inventory ?? '—'}
            </span>
            <span className="text-[10.5px] uppercase tracking-[.06em] text-faint">
              {t('units')}
            </span>
          </span>
          <span className="hidden flex-col items-end sm:flex">
            <span className="text-[15px] font-bold tracking-[-.01em] text-ink latn">
              {room.ratePlans.length}
            </span>
            <span className="text-[10.5px] uppercase tracking-[.06em] text-faint">
              {t('ratePlansShort')}
            </span>
          </span>
          {cheapest !== undefined ? (
            <span className="hidden text-[13px] font-semibold text-muted lg:inline latn">
              {t('cheapestFrom', {
                price: formatMoney(cheapest, draft.currency || DEFAULT_CURRENCY, locale),
              })}
            </span>
          ) : null}
          <ChevronDown
            className={cn('size-4 shrink-0 text-faint transition-transform', open && 'rotate-180')}
          />
        </span>
      </button>

      {open ? (
        <div className="flex flex-col gap-4 border-t border-line px-4 pb-[18px] pt-4">
          <Grid2>
            <Field
              label={t('name')}
              required
              error={labels.validation(key('name'))}
              htmlFor={`room-${room.id}-name`}
            >
              <TextInput
                id={`room-${room.id}-name`}
                value={room.name}
                onChange={(e) => updateRoom(index, { name: e.target.value })}
                placeholder={t('namePlaceholder')}
                invalid={Boolean(key('name'))}
              />
            </Field>
            <Field label={t('nameAr')} labelHint="(العربية)" htmlFor={`room-${room.id}-name-ar`}>
              <ArabicInput
                id={`room-${room.id}-name-ar`}
                value={room.nameAr ?? ''}
                onChange={(e) => updateRoom(index, { nameAr: e.target.value })}
                placeholder={t('nameArPlaceholder')}
              />
            </Field>
          </Grid2>

          <Grid3>
            <Field label={t('category')} required error={labels.validation(key('category'))}>
              <Select
                value={room.category}
                onChange={(e) => updateRoom(index, { category: e.target.value })}
                invalid={Boolean(key('category'))}
                aria-label={t('category')}
              >
                {ROOM_CATEGORIES.map((id) => (
                  <option key={id} value={id}>
                    {labels.category(id)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('view')}>
              <Select
                value={room.view ?? ''}
                onChange={(e) => updateRoom(index, { view: e.target.value })}
                aria-label={t('view')}
              >
                {ROOM_VIEWS.map((id) => (
                  <option key={id} value={id}>
                    {labels.view(id)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('size')} error={labels.validation(key('sizeM2'))}>
              <NumberInput
                value={room.sizeM2}
                onValueChange={(v) => updateRoom(index, { sizeM2: v })}
                min={1}
                aria-label={t('size')}
                invalid={Boolean(key('sizeM2'))}
              />
            </Field>

            <Field
              label={t('capacity')}
              required
              help={t('capacityHint')}
              error={labels.validation(key('capacity'))}
            >
              <NumberInput
                value={room.capacity}
                onValueChange={(v) => updateRoom(index, { capacity: v })}
                min={1}
                aria-label={t('capacity')}
                invalid={Boolean(key('capacity'))}
              />
            </Field>

            {/* Not present in the reference artifact — added for the shared model. */}
            <Field label={t('bathrooms')} required error={labels.validation(key('bathrooms'))}>
              <NumberInput
                value={room.bathrooms}
                onValueChange={(v) => updateRoom(index, { bathrooms: v })}
                min={0}
                aria-label={t('bathrooms')}
                invalid={Boolean(key('bathrooms'))}
              />
            </Field>

            <Field
              label={t('inventory')}
              required
              help={t('inventoryHint')}
              error={labels.validation(key('inventory'))}
            >
              <NumberInput
                value={room.inventory}
                onValueChange={(v) => updateRoom(index, { inventory: v })}
                min={1}
                aria-label={t('inventory')}
                invalid={Boolean(key('inventory'))}
              />
            </Field>
          </Grid3>

          <Grid2>
            <Field label={t('description')}>
              <TextArea
                value={room.description ?? ''}
                onChange={(e) => updateRoom(index, { description: e.target.value })}
                placeholder={t('descriptionPlaceholder')}
              />
            </Field>
            <Field label={t('descriptionAr')} labelHint="(العربية)">
              <ArabicTextArea
                value={room.descriptionAr ?? ''}
                onChange={(e) => updateRoom(index, { descriptionAr: e.target.value })}
              />
            </Field>
          </Grid2>

          <div className="flex flex-col gap-2">
            <SubHeading
              hint={
                bedRows.length ? `· ${t('totalBeds', { count: totalBeds(bedRows) })}` : undefined
              }
            >
              {t('bedConfig')}
            </SubHeading>
            <div className="flex flex-col gap-2">
              {bedRows.map((bed, bedIndex) => (
                <div key={`${bed.type}-${bedIndex}`} className="flex items-center gap-2.5">
                  <Select
                    value={bed.type}
                    onChange={(e) =>
                      commitBeds(
                        bedRows.map((r, i) =>
                          i === bedIndex ? { ...r, type: e.target.value } : r,
                        ),
                      )
                    }
                    aria-label={t('bedType')}
                    className="max-w-[200px]"
                  >
                    {BED_TYPES.map((id) => (
                      <option key={id} value={id}>
                        {labels.bedType(id)}
                      </option>
                    ))}
                  </Select>
                  <NumberInput
                    value={bed.qty}
                    onValueChange={(v) =>
                      commitBeds(
                        bedRows.map((r, i) => (i === bedIndex ? { ...r, qty: v ?? 0 } : r)),
                      )
                    }
                    min={1}
                    aria-label={t('bedQty')}
                    className="w-[72px]"
                  />
                  <button
                    type="button"
                    onClick={() => commitBeds(bedRows.filter((_, i) => i !== bedIndex))}
                    aria-label={t('removeBed')}
                    className="grid size-[28px] place-items-center rounded-[6px] text-faint transition hover:bg-danger-soft hover:text-danger"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="self-start text-accent-ink"
                onClick={() => commitBeds([...bedRows, { type: 'twin', qty: 1 }])}
              >
                <Plus className="size-3.5" />
                {t('addBed')}
              </Button>
              {labels.validation(key('beds')) ? (
                <p className="text-[11.5px] font-medium text-danger">
                  {labels.validation(key('beds'))}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <SubHeading hint={`· ${t('roomAmenitiesScope')}`}>{t('roomAmenities')}</SubHeading>
            <div className="flex flex-wrap gap-2">
              {ROOM_AMENITIES.map((id) => (
                <SelectChip
                  key={id}
                  selected={roomAmenities.has(id)}
                  onToggle={() => toggleAmenity(id)}
                >
                  {labels.roomAmenity(id)}
                </SelectChip>
              ))}
            </div>
          </div>

          <RatePlanTable room={room} roomIndex={index} errors={errors} />

          <div>
            <Button variant="danger" size="sm" onClick={onRemove}>
              <Trash2 className="size-3.5" />
              {t('removeRoomType')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, ImagePlus, Plus, Star, X } from 'lucide-react';
import { Button, Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { useCatalogLabels } from '@/lib/useLabels';
import { cn, gradientToken, moveItem, photoStyle } from '@/lib/utils';
import { useWizard } from '../WizardProvider';
import { PanelIntro } from './PanelIntro';

/** Anything larger would blow the mock store's localStorage budget. */
const MAX_UPLOAD_BYTES = 1_500_000;

export function PhotosStep() {
  const t = useTranslations('wizard.photos');
  const labels = useCatalogLabels();
  const { draft, update, errorsFor } = useWizard();
  const errors = errorsFor('photos');
  const fileInput = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  /** The cover is always photos[0] — one rule, no second source of truth. */
  const commit = (photos: string[]) =>
    update({ photos, coverPhoto: photos[0] ?? '' });

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const encoded = await Promise.all(
      Array.from(files)
        .filter((file) => file.type.startsWith('image/') && file.size <= MAX_UPLOAD_BYTES)
        .map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            }),
        ),
    );
    if (encoded.length) commit([...draft.photos, ...encoded]);
    if (fileInput.current) fileInput.current.value = '';
  };

  const drop = (target: number) => {
    if (dragIndex === null) return;
    commit(moveItem(draft.photos, dragIndex, target));
    setDragIndex(null);
  };

  const error = labels.validation(errors['photos'] ?? errors['coverPhoto']);

  return (
    <>
      <PanelIntro title={t('title')} subtitle={t('subtitle')} />

      {error ? (
        <p className="rounded-[var(--radius-ctl)] border border-danger/40 bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}

      <Card>
        <CardHeader
          title={t('title')}
          hint={t('count', { count: draft.photos.length })}
          action={
            <Button
              size="sm"
              variant="ghost"
              onClick={() => commit([...draft.photos, gradientToken(draft.photos.length)])}
            >
              <ImagePlus className="size-3.5" />
              {t('addSample')}
            </Button>
          }
        />
        <CardBody>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void addFiles(e.target.files)}
          />

          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
            {draft.photos.map((photo, index) => (
              <div
                key={`${photo.slice(0, 24)}-${index}`}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => drop(index)}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  'group relative aspect-[4/3] cursor-grab overflow-hidden rounded-[var(--radius-ctl)] border border-line',
                  dragIndex === index && 'opacity-50',
                )}
                style={photoStyle(photo)}
              >
                {index === 0 ? (
                  <span className="absolute top-[7px] start-[7px] rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                    {t('cover')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => commit(moveItem(draft.photos, index, 0))}
                    aria-label={t('makeCover')}
                    title={t('makeCover')}
                    className="absolute top-1.5 start-1.5 grid size-[22px] place-items-center rounded-full bg-black/55 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Star className="size-3" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => commit(draft.photos.filter((_, i) => i !== index))}
                  aria-label={t('remove')}
                  className="absolute top-1.5 end-1.5 grid size-[22px] place-items-center rounded-full bg-black/55 text-white transition hover:bg-black/75"
                >
                  <X className="size-3" />
                </button>

                <div className="absolute inset-x-1.5 bottom-1.5 flex justify-between opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => commit(moveItem(draft.photos, index, index - 1))}
                    aria-label={t('moveStart')}
                    className="grid size-[22px] place-items-center rounded-full bg-black/55 text-white disabled:opacity-30"
                  >
                    <ChevronLeft className="flip-rtl size-3" />
                  </button>
                  <button
                    type="button"
                    disabled={index === draft.photos.length - 1}
                    onClick={() => commit(moveItem(draft.photos, index, index + 1))}
                    aria-label={t('moveEnd')}
                    className="grid size-[22px] place-items-center rounded-full bg-black/55 text-white disabled:opacity-30"
                  >
                    <ChevronRight className="flip-rtl size-3" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="grid aspect-[4/3] place-items-center rounded-[var(--radius-ctl)] border border-dashed border-line-strong bg-surface-2 text-muted transition hover:border-accent hover:text-accent-ink"
            >
              <span className="flex flex-col items-center gap-1 text-[12px] font-semibold">
                <Plus className="size-5" />
                {t('upload')}
              </span>
            </button>
          </div>

          {draft.photos.length === 0 ? (
            <p className="text-[13px] text-muted">{t('emptyBody')}</p>
          ) : (
            <p className="text-[11.5px] text-faint">{t('dropHint')}</p>
          )}
        </CardBody>
      </Card>
    </>
  );
}

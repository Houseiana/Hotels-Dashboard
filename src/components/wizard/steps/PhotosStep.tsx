'use client';

import { useTranslations } from 'next-intl';
import { ImagePlus } from 'lucide-react';
import { Button, Card, CardBody, CardHeader } from '@/components/ui/primitives';
import { useCatalogLabels } from '@/lib/useLabels';
import { gradientToken } from '@/lib/utils';
import { useWizard } from '../WizardProvider';
import { PanelIntro } from './PanelIntro';
import { PhotoGrid } from './PhotoGrid';

export function PhotosStep() {
  const t = useTranslations('wizard.photos');
  const labels = useCatalogLabels();
  const { draft, update, errorsFor } = useWizard();
  const errors = errorsFor('photos');

  /** The cover is always photos[0] — one rule, no second source of truth. */
  const commit = (photos: string[]) =>
    update({ photos, coverPhoto: photos[0] ?? '' });

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
          <PhotoGrid photos={draft.photos} onChange={commit} />

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

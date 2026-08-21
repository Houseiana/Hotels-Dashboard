'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Loader2, Send } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { Button, Chip } from '@/components/ui/primitives';
import { WIZARD_STEPS } from '@/lib/schemas/draft';
import { useWizard } from './WizardProvider';
import { WizardStepper } from './WizardStepper';
import { BasicsStep } from './steps/BasicsStep';
import { LocationStep } from './steps/LocationStep';
import { AmenitiesStep } from './steps/AmenitiesStep';
import { PhotosStep } from './steps/PhotosStep';
import { RoomsStep } from './steps/RoomsStep';
import { ReviewStep } from './steps/ReviewStep';
import { usePublish } from './usePublish';

function SaveIndicator() {
  const t = useTranslations('wizard');
  const { saveState, savedAt } = useWizard();
  // Remounted on every save (see the `key` below), so 0 always means "just now".
  const [minutesAgo, setMinutesAgo] = useState(0);

  // Kept in state rather than computed in render so "saved 2 minutes ago" ages
  // on a timer instead of on unrelated re-renders.
  useEffect(() => {
    if (!savedAt) return;
    const sync = () => setMinutesAgo(Math.floor((Date.now() - savedAt) / 60_000));
    const id = setInterval(sync, 30_000);
    return () => clearInterval(id);
  }, [savedAt]);

  if (saveState === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-faint">
        <Loader2 className="size-3 animate-spin" />
        {t('draftSaving')}
      </span>
    );
  }

  if (saveState === 'dirty') {
    return (
      <span className="flex items-center gap-1.5 text-[12px] text-faint">
        <span className="size-[7px] rounded-full bg-warn" />
        {t('draftUnsaved')}
      </span>
    );
  }

  if (!savedAt) return null;

  const when = minutesAgo < 1 ? t('justNow') : t('minutesAgo', { count: minutesAgo });

  return (
    <span className="flex items-center gap-1.5 text-[12px] text-faint">
      <span className="size-[7px] rounded-full bg-ok" />
      {t('draftSaved', { time: when })}
    </span>
  );
}

export function HotelWizard() {
  const t = useTranslations('wizard');
  const tCommon = useTranslations('common');
  const tHotels = useTranslations('hotels');
  const tReview = useTranslations('wizard.review');
  const { draft, isNew, step, stepIndex, next, back, saveDraftNow, isSaving, savedAt } =
    useWizard();
  const { publish, busy, canPublish } = usePublish();
  const router = useRouter();

  const isLast = stepIndex === WIZARD_STEPS.length - 1;

  const saveDraftAndExit = () => {
    saveDraftNow();
    router.push('/hotels');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      {/* top bar — brand, breadcrumb, live save state */}
      <div className="sticky top-0 z-30 flex items-center gap-3.5 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <Link href="/hotels" className="flex items-center gap-2.5 font-semibold text-ink">
          <Image src="/logo.png" alt="" width={27} height={48} className="h-[26px] w-auto" />
          <span className="hidden sm:inline">{tCommon('backToDashboard')}</span>
        </Link>
        <span className="flex items-center gap-1.5 text-[12.5px] text-faint">
          <span className="hidden sm:inline">{t('crumbHotels')}</span>
          <ChevronRight className="flip-rtl hidden size-3 sm:block" />
          <b className="font-medium text-muted">{isNew ? t('crumbAdd') : t('crumbEdit')}</b>
        </span>
        <span className="ms-auto flex items-center gap-3">
          <SaveIndicator key={savedAt ?? 'unsaved'} />
        </span>
      </div>

      {/* step head — title + status chip + stepper */}
      <div className="border-b border-line bg-surface px-4 pt-4 sm:px-6">
        <div className="mx-auto flex max-w-wizard items-center gap-3 pb-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[11.5px] font-semibold uppercase tracking-[.08em] text-faint">
              {isNew ? t('newHotel') : t('editHotel')}
            </span>
            <h1 className="truncate font-serif text-[22px] font-semibold tracking-[-.01em] text-ink">
              {draft.name || t('untitled')}
            </h1>
          </div>
          <Chip
            tone={draft.status === 'active' ? 'active' : 'draft'}
            dot
            className="ms-auto shrink-0"
          >
            {draft.status === 'active' ? tHotels('statusActive') : tHotels('statusDraft')}
          </Chip>
        </div>
        <WizardStepper />
      </div>

      {/* panels */}
      <div className="mx-auto w-full max-w-wizard flex-1 px-4 pb-32 pt-6 sm:px-6">
        <div className="fade-in flex flex-col gap-5" key={step}>
          {step === 'basics' ? <BasicsStep /> : null}
          {step === 'location' ? <LocationStep /> : null}
          {step === 'amenities' ? <AmenitiesStep /> : null}
          {step === 'photos' ? <PhotosStep /> : null}
          {step === 'rooms' ? <RoomsStep /> : null}
          {step === 'review' ? <ReviewStep /> : null}
        </div>
      </div>

      {/* sticky footer nav */}
      <div className="fixed bottom-0 inset-x-0 z-20 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-wizard items-center gap-3 px-4 py-3 sm:px-6">
          <Button onClick={back} disabled={stepIndex === 0}>
            <ChevronLeft className="flip-rtl size-4" />
            {tCommon('back')}
          </Button>
          <span className="hidden text-[12.5px] font-medium text-faint sm:inline">
            {t('stepOf', { current: stepIndex + 1, total: WIZARD_STEPS.length })}
          </span>
          <span className="flex-1" />
          <Button variant="ghost" onClick={saveDraftAndExit} disabled={isSaving}>
            {t('exit')}
          </Button>
          {isLast ? (
            <Button variant="primary" onClick={publish} disabled={!canPublish || busy}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {!isNew
                ? tReview('saveChanges')
                : draft.status === 'active'
                  ? tReview('republish')
                  : tReview('publish')}
            </Button>
          ) : (
            <Button variant="primary" onClick={next}>
              {tCommon('next')}
              <ChevronRight className="flip-rtl size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

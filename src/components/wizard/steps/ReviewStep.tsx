'use client';

import { useTranslations } from 'next-intl';
import {
  BedDouble,
  Check,
  Images,
  Info,
  Loader2,
  MapPin,
  Send,
  Sparkles,
  TriangleAlert,
  Type,
} from 'lucide-react';
import { Button, Chip } from '@/components/ui/primitives';
import { GuestPreviewCard } from '@/components/hotels/GuestPreviewCard';
import { WIZARD_STEPS, type WizardStep } from '@/lib/schemas/draft';
import { useCatalogLabels } from '@/lib/useLabels';
import { cn } from '@/lib/utils';
import { useWizard } from '../WizardProvider';
import { usePublish } from '../usePublish';
import { PanelIntro } from './PanelIntro';

const STEP_ICONS: Record<Exclude<WizardStep, 'review'>, typeof Type> = {
  basics: Type,
  location: MapPin,
  amenities: Sparkles,
  photos: Images,
  rooms: BedDouble,
};

export function ReviewStep() {
  const t = useTranslations('wizard.review');
  const tSteps = useTranslations('wizard.steps');
  const tCommon = useTranslations('common');
  const labels = useCatalogLabels();
  const { draft, goTo, issuesFor, publishIssues, canPublish, toHotel } = useWizard();
  const { publish, saveDraft, busy } = usePublish();

  const summaries: Record<Exclude<WizardStep, 'review'>, string> = {
    basics: t('summaryBasics', {
      name: draft.name || tCommon('notSet'),
      stars: '★'.repeat(Math.max(0, Math.min(5, draft.starRating ?? 0))) || tCommon('notSet'),
      checkIn: draft.policies?.checkInFrom ?? '—',
      checkOut: draft.policies?.checkOutUntil ?? '—',
    }),
    location:
      typeof draft.latitude === 'number'
        ? t('summaryLocation', {
            area: draft.area?.trim() || labels.city(draft.city) || tCommon('notSet'),
            city: labels.country(draft.country) || tCommon('notSet'),
          })
        : t('summaryLocationNoPin', {
            city: labels.city(draft.city) || tCommon('notSet'),
          }),
    amenities: t('summaryAmenities', { count: draft.amenities.length }),
    photos: t('summaryPhotos', { count: draft.photos.length }),
    rooms: (() => {
      const missing = draft.roomTypes.find((rt) => rt.ratePlans.length === 0);
      return missing
        ? t('summaryRoomsWarn', {
            count: draft.roomTypes.length,
            room: missing.name || tCommon('notSet'),
          })
        : t('summaryRooms', { count: draft.roomTypes.length });
    })(),
  };

  // Publish-blocking issues, de-duplicated to one line per distinct message.
  const blockingMessages = Array.from(
    new Set(
      publishIssues
        .map((issue) => labels.validation(issue.key))
        .filter((message): message is string => Boolean(message)),
    ),
  );

  return (
    <>
      <PanelIntro title={t('title')} subtitle={t('subtitle')} />

      <div
        className={cn(
          'flex items-start gap-3 rounded-[var(--radius-card)] border p-4',
          canPublish ? 'border-ok/35 bg-ok-soft' : 'border-warn/35 bg-warn-soft',
        )}
      >
        {canPublish ? (
          <Check className="mt-0.5 size-[18px] shrink-0 text-ok" strokeWidth={2.6} />
        ) : (
          <TriangleAlert className="mt-0.5 size-[18px] shrink-0 text-warn" />
        )}
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-[14px] font-semibold text-ink">
            {canPublish
              ? t('readyTitle')
              : t('blockedTitle', { count: blockingMessages.length })}
          </p>
          <p className="text-[12.5px] text-muted">
            {canPublish ? t('readyBody') : t('blockedBody')}
          </p>
          {!canPublish ? (
            <ul className="mt-1 flex flex-col gap-1">
              {blockingMessages.map((message) => (
                <li key={message} className="flex gap-2 text-[12.5px] text-muted">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-warn" />
                  {message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-2.5">
          {WIZARD_STEPS.filter((s): s is Exclude<WizardStep, 'review'> => s !== 'review').map(
            (id) => {
              const issues = issuesFor(id);
              const Icon = STEP_ICONS[id];
              const ok = issues.length === 0;
              return (
                <div
                  key={id}
                  className="flex items-center gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface px-[15px] py-3 shadow-[var(--shadow-card)]"
                >
                  <span
                    className={cn(
                      'grid size-[30px] shrink-0 place-items-center rounded-[8px]',
                      ok ? 'bg-accent-soft text-accent-ink' : 'bg-warn-soft text-warn',
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.05em] text-faint">
                      {tSteps(id)}
                      {ok ? (
                        <Check className="size-3 text-ok" strokeWidth={3} />
                      ) : (
                        <Chip tone="draft" className="px-1.5 py-0 text-[10px]">
                          {t('sectionIssues', { count: issues.length })}
                        </Chip>
                      )}
                    </span>
                    <span className="truncate text-[13.5px] font-semibold text-ink">
                      {summaries[id]}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ms-auto shrink-0"
                    onClick={() => goTo(id)}
                  >
                    {tCommon('edit')}
                  </Button>
                </div>
              );
            },
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2.5">
            <Button variant="primary" onClick={publish} disabled={!canPublish || busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              {busy ? t('publishing') : draft.status === 'active' ? t('republish') : t('publish')}
            </Button>
            <Button onClick={saveDraft} disabled={busy}>
              {t('saveDraft')}
            </Button>
            {draft.status === 'active' ? (
              <span className="flex items-center gap-1.5 text-[12px] text-faint">
                <Info className="size-3.5" />
                {t('alreadyLive')}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:sticky lg:top-5">
          <span className="text-[11.5px] font-bold uppercase tracking-[.07em] text-faint">
            {t('guestPreview')}
          </span>
          <GuestPreviewCard hotel={toHotel()} />
        </div>
      </div>
    </>
  );
}

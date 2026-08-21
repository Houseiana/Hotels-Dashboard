'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useToast } from '@/components/providers/ToastProvider';
import { useWizard } from './WizardProvider';

/** Shared by the review panel and the sticky footer so both behave identically. */
export function usePublish() {
  const t = useTranslations('hotels');
  const tCommon = useTranslations('common');
  const tWizard = useTranslations('wizard');
  const { draft, isNew, canPublish, submit, saveEdit, saveDraftNow, goTo } = useWizard();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const publish = useCallback(async () => {
    if (!canPublish) {
      goTo('review');
      return;
    }
    setBusy(true);
    try {
      if (!isNew) {
        // Editing is a batch of calls, not one. Report what actually happened:
        // "saved" over a half-failed batch would be a lie the owner acts on.
        if (!saveEdit) {
          toast(tWizard('editLoading'), 'info');
          return;
        }
        const result = await saveEdit();
        for (const warning of new Set(result.warnings)) {
          toast(tWizard(`warning.${warning}`), 'info');
        }
        if (result.ok) {
          toast(t('savedToast', { name: draft.name }));
          router.push(`/hotels/${draft.id}`);
          return;
        }
        const failed = result.steps.filter((step) => !step.ok);
        toast(
          tWizard('savePartial', {
            done: result.steps.length - failed.length,
            total: result.steps.length,
            first: failed[0]?.error ?? '',
          }),
          'error',
        );
        return;
      }

      await submit();
      toast(t('publishedToast', { name: draft.name }));
      // Always the list, never straight to /edit: the edit screen still reads
      // the mock store, so a real hotel id lands on "no longer exists".
      router.push('/hotels');
    } catch (error) {
      toast(
        error instanceof Error && error.message ? error.message : tCommon('somethingWentWrong'),
        'error',
      );
    } finally {
      setBusy(false);
    }
  }, [
    isNew,
    canPublish,
    submit,
    saveEdit,
    goTo,
    toast,
    t,
    tCommon,
    tWizard,
    draft.name,
    draft.id,
    router,
  ]);

  /** Keeps the work in this browser; there is no server-side draft. */
  const saveDraft = useCallback(() => {
    saveDraftNow();
    toast(tCommon('saved'), 'info');
  }, [saveDraftNow, toast, tCommon]);

  return { publish, saveDraft, busy, canPublish, isNew };
}

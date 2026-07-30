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
  const { draft, canPublish, saveNow, goTo } = useWizard();
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
      await saveNow('active');
      toast(t('publishedToast', { name: draft.name }));
      router.push('/hotels');
    } catch {
      toast(tCommon('somethingWentWrong'), 'error');
    } finally {
      setBusy(false);
    }
  }, [canPublish, saveNow, goTo, toast, t, tCommon, draft.name, router]);

  const saveDraft = useCallback(async () => {
    setBusy(true);
    try {
      await saveNow('draft');
      toast(tCommon('saved'), 'info');
    } catch {
      toast(tCommon('somethingWentWrong'), 'error');
    } finally {
      setBusy(false);
    }
  }, [saveNow, toast, tCommon]);

  return { publish, saveDraft, busy, canPublish };
}

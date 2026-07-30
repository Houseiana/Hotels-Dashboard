'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Lock, Save, ShieldCheck } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
} from '@/components/ui/primitives';
import {
  Field,
  Grid2,
  Select,
  TextArea,
  TextInput,
  TimeInput,
  Toggle,
} from '@/components/ui/form';
import { useSaveSettings, useSettings } from '@/lib/query/hooks';
import { useToast } from '@/components/providers/ToastProvider';
import { useCatalogLabels } from '@/lib/useLabels';
import { CURRENCIES } from '@/lib/catalogs';
import { settingsSchema, type Settings } from '@/lib/schemas/booking';
import { issueMap, validate } from '@/lib/schemas/errors';
import { CLERK_ENABLED } from '@/lib/auth';
import { cn } from '@/lib/utils';

type Tab = 'account' | 'payout' | 'policies';

export function SettingsView() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const { data, isPending, isError } = useSettings();

  if (isPending || !data) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <Skeleton className="h-[460px]" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <EmptyState title={tCommon('somethingWentWrong')} body={tCommon('retry')} />
      </div>
    );
  }

  return <SettingsForm initial={data} />;
}

/**
 * Split out so the form state is seeded from the fetched settings on mount
 * instead of being synced in from an effect.
 */
function SettingsForm({ initial }: { initial: Settings }) {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  // The policy labels are owned by the wizard's Basics step — reused verbatim
  // so the defaults screen and the per-hotel screen never drift apart.
  const tBasics = useTranslations('wizard.basics');
  const labels = useCatalogLabels();
  const toast = useToast();
  const save = useSaveSettings();

  const [tab, setTab] = useState<Tab>('account');
  const [form, setForm] = useState<Settings>(() => structuredClone(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    const result = validate(settingsSchema, form);
    if (!result.ok) {
      setErrors(issueMap(result.issues));
      // Jump to the tab that actually holds the problem.
      const first = result.issues[0]?.segments[0];
      if (first === 'account') setTab('account');
      else if (first === 'payout') setTab('payout');
      else if (first === 'defaultPolicies') setTab('policies');
      return;
    }
    setErrors({});
    save.mutate(result.data, {
      onSuccess: () => toast(t('savedToast')),
      onError: () => toast(tCommon('somethingWentWrong'), 'error'),
    });
  };

  const setAccount = (patch: Partial<Settings['account']>) =>
    setForm({ ...form, account: { ...form.account, ...patch } });
  const setPayout = (patch: Partial<Settings['payout']>) =>
    setForm({ ...form, payout: { ...form.payout, ...patch } });
  const setPolicies = (patch: Partial<Settings['defaultPolicies']>) =>
    setForm({ ...form, defaultPolicies: { ...form.defaultPolicies, ...patch } });

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'account', label: t('tabAccount') },
    { id: 'payout', label: t('tabPayout') },
    { id: 'policies', label: t('tabPolicies') },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button variant="primary" onClick={submit} disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {save.isPending ? tCommon('saving') : tCommon('save')}
          </Button>
        }
      />

      <div className="flex gap-1 border-b border-line">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-current={tab === item.id ? 'true' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors',
              tab === item.id
                ? 'border-accent text-ink'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'account' ? (
        <>
          <Card>
            <CardHeader title={t('accountTitle')} hint={t('accountSubtitle')} />
            <CardBody>
              <Grid2>
                <Field
                  label={t('companyName')}
                  required
                  error={labels.validation(errors['account.companyName'])}
                >
                  <TextInput
                    value={form.account.companyName}
                    onChange={(e) => setAccount({ companyName: e.target.value })}
                    invalid={Boolean(errors['account.companyName'])}
                  />
                </Field>
                <Field
                  label={t('contactEmail')}
                  required
                  error={labels.validation(errors['account.contactEmail'])}
                >
                  <TextInput
                    type="email"
                    value={form.account.contactEmail}
                    onChange={(e) => setAccount({ contactEmail: e.target.value })}
                    className="latn"
                    invalid={Boolean(errors['account.contactEmail'])}
                  />
                </Field>
                <Field label={t('contactPhone')}>
                  <TextInput
                    value={form.account.contactPhone ?? ''}
                    onChange={(e) => setAccount({ contactPhone: e.target.value })}
                    className="latn"
                  />
                </Field>
                <Field
                  label={t('defaultCurrency')}
                  help={t('defaultCurrencyHint')}
                  error={labels.validation(errors['account.defaultCurrency'])}
                >
                  <Select
                    value={form.account.defaultCurrency}
                    onChange={(e) => setAccount({ defaultCurrency: e.target.value })}
                  >
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code} · {labels.currency(code)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t('defaultLocale')}>
                  <Select
                    value={form.account.defaultLocale}
                    onChange={(e) =>
                      setAccount({ defaultLocale: e.target.value as 'en' | 'ar' })
                    }
                  >
                    <option value="en">{tCommon('english')}</option>
                    <option value="ar">{tCommon('arabic')}</option>
                  </Select>
                </Field>
              </Grid2>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('clerkProfileTitle')} />
            <CardBody>
              <p className="flex items-start gap-2.5 text-[13px] text-muted">
                <ShieldCheck className="mt-px size-4 shrink-0 text-accent-ink" />
                {CLERK_ENABLED ? t('clerkProfileBody') : tAuth('devModeBody')}
              </p>
            </CardBody>
          </Card>
        </>
      ) : null}

      {tab === 'payout' ? (
        <Card>
          <CardHeader title={t('payoutTitle')} hint={t('payoutSubtitle')} />
          <CardBody>
            <Grid2>
              <Field label={t('payoutMethod')}>
                <Select
                  value={form.payout.method}
                  onChange={(e) =>
                    setPayout({ method: e.target.value as Settings['payout']['method'] })
                  }
                >
                  <option value="bankTransfer">{t('methodBankTransfer')}</option>
                  <option value="wise">{t('methodWise')}</option>
                  <option value="paypal">{t('methodPaypal')}</option>
                </Select>
              </Field>
              <Field
                label={t('payoutCurrency')}
                error={labels.validation(errors['payout.payoutCurrency'])}
              >
                <Select
                  value={form.payout.payoutCurrency}
                  onChange={(e) => setPayout({ payoutCurrency: e.target.value })}
                >
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code} · {labels.currency(code)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={t('accountName')}
                required
                error={labels.validation(errors['payout.accountName'])}
              >
                <TextInput
                  value={form.payout.accountName}
                  onChange={(e) => setPayout({ accountName: e.target.value })}
                  invalid={Boolean(errors['payout.accountName'])}
                />
              </Field>
              <Field label={t('iban')} required error={labels.validation(errors['payout.iban'])}>
                <TextInput
                  value={form.payout.iban}
                  onChange={(e) => setPayout({ iban: e.target.value })}
                  className="tnum latn"
                  invalid={Boolean(errors['payout.iban'])}
                />
              </Field>
              <Field label={t('bankName')}>
                <TextInput
                  value={form.payout.bankName ?? ''}
                  onChange={(e) => setPayout({ bankName: e.target.value })}
                />
              </Field>
              <Field label={t('swift')}>
                <TextInput
                  value={form.payout.swift ?? ''}
                  onChange={(e) => setPayout({ swift: e.target.value })}
                  className="latn"
                />
              </Field>
            </Grid2>

            <p className="flex items-start gap-2 rounded-[var(--radius-ctl)] bg-surface-2 p-2.5 text-[11.5px] text-muted">
              <Lock className="mt-px size-3.5 shrink-0 text-faint" />
              {t('payoutSubtitle')}
            </p>
          </CardBody>
        </Card>
      ) : null}

      {tab === 'policies' ? (
        <Card>
          <CardHeader title={t('policiesTitle')} hint={t('policiesSubtitle')} />
          <CardBody>
            <Grid2>
              <Field
                label={tBasics('checkIn')}
                error={labels.validation(errors['defaultPolicies.checkInFrom'])}
              >
                <TimeInput
                  value={form.defaultPolicies.checkInFrom ?? ''}
                  onChange={(e) => setPolicies({ checkInFrom: e.target.value })}
                />
              </Field>
              <Field
                label={tBasics('checkOut')}
                error={labels.validation(errors['defaultPolicies.checkOutUntil'])}
              >
                <TimeInput
                  value={form.defaultPolicies.checkOutUntil ?? ''}
                  onChange={(e) => setPolicies({ checkOutUntil: e.target.value })}
                />
              </Field>
            </Grid2>

            <Field label={tBasics('cancellation')}>
              <TextInput
                value={form.defaultPolicies.cancellation ?? ''}
                onChange={(e) => setPolicies({ cancellation: e.target.value })}
              />
            </Field>

            <Grid2>
              <Field label={tBasics('childrenPolicy')}>
                <TextArea
                  value={form.defaultPolicies.childrenPolicy ?? ''}
                  onChange={(e) => setPolicies({ childrenPolicy: e.target.value })}
                  className="min-h-[64px]"
                />
              </Field>
              <Field label={tBasics('paymentNote')}>
                <TextArea
                  value={form.defaultPolicies.paymentNote ?? ''}
                  onChange={(e) => setPolicies({ paymentNote: e.target.value })}
                  className="min-h-[64px]"
                />
              </Field>
            </Grid2>

            <Grid2>
              <Toggle
                checked={form.defaultPolicies.petsAllowed ?? false}
                onChange={(v) => setPolicies({ petsAllowed: v })}
                label={tBasics('petsAllowed')}
              />
              <Toggle
                checked={form.defaultPolicies.smokingAllowed ?? false}
                onChange={(v) => setPolicies({ smokingAllowed: v })}
                label={tBasics('smokingAllowed')}
              />
            </Grid2>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

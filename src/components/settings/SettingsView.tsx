'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Lock, Plus, Save, ShieldCheck } from 'lucide-react';
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
import {
  useDeletePayoutMethod,
  usePayoutMethods,
  useSavePayoutMethod,
  useSaveSettings,
  useSettings,
} from '@/lib/query/hooks';
import { useCurrencyLookup, useLookup } from '@/lib/query/lookups';
import { ConfirmDialog } from '@/components/ui/overlay';
import type { PayoutMethodInput } from '@/lib/api/settings';
import type { PayoutMethodRecord } from '@/lib/schemas/hotelApi';
import { useToast } from '@/components/providers/ToastProvider';
import { useCatalogLabels } from '@/lib/useLabels';
import { CURRENCIES } from '@/lib/catalogs';
import { settingsSchema, type Settings } from '@/lib/schemas/booking';
import { issueMap, validate } from '@/lib/schemas/errors';
import { AUTH_IS_MOCKED } from '@/lib/auth';
import { cn } from '@/lib/utils';

type Tab = 'account' | 'payout' | 'policies';

/** The fields the page's Save button is responsible for. */
const formSchema = settingsSchema.pick({ account: true, defaultPolicies: true });

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

  const currencies = useCurrencyLookup();
  // Falls back to the built-in list only while the lookup is in flight, and
  // always keeps the value already saved so it never silently disappears.
  const currencyCodes = useMemo(() => {
    const fromServer = (currencies.data ?? []).map((currency) => currency.code);
    const base = fromServer.length ? fromServer : [...CURRENCIES];
    return base.includes(initial.account.defaultCurrency)
      ? base
      : [initial.account.defaultCurrency, ...base];
  }, [currencies.data, initial.account.defaultCurrency]);

  const [tab, setTab] = useState<Tab>('account');
  const [form, setForm] = useState<Settings>(() => structuredClone(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    // Only the two tabs this button owns. `payout` is still part of the stored
    // Settings shape for the mock store, but the payout tab manages its own
    // records through their endpoints — validating it here would block every
    // save with errors for fields the form no longer shows.
    const result = validate(formSchema, {
      account: form.account,
      defaultPolicies: form.defaultPolicies,
    });
    if (!result.ok) {
      setErrors(issueMap(result.issues));
      // Jump to the tab that actually holds the problem.
      const first = result.issues[0]?.segments[0];
      if (first === 'account') setTab('account');
      else if (first === 'defaultPolicies') setTab('policies');
      return;
    }
    setErrors({});
    save.mutate({ ...form, ...result.data }, {
      onSuccess: () => toast(t('savedToast')),
      onError: () => toast(tCommon('somethingWentWrong'), 'error'),
    });
  };

  const setAccount = (patch: Partial<Settings['account']>) =>
    setForm({ ...form, account: { ...form.account, ...patch } });
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
                  {/* The account endpoint stores a currency ID, so the list has
                      to be the server's — offering a code it does not know would
                      resolve to no ID and drop the change on save. */}
                  <Select
                    value={form.account.defaultCurrency}
                    onChange={(e) => setAccount({ defaultCurrency: e.target.value })}
                    disabled={currencies.isPending}
                  >
                    {currencyCodes.map((code) => (
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
            <CardHeader title={t('securityTitle')} />
            <CardBody>
              <p className="flex items-start gap-2.5 text-[13px] text-muted">
                <ShieldCheck className="mt-px size-4 shrink-0 text-accent-ink" />
                {AUTH_IS_MOCKED ? tAuth('mockAuthNotice') : t('securityBody')}
              </p>
            </CardBody>
          </Card>
        </>
      ) : null}

      {tab === 'payout' ? <PayoutTab /> : null}

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

/**
 * The API models payouts as a list with its own create/edit/delete endpoints,
 * so this tab saves each method on its own rather than through the page's Save
 * button. `accountId` is one field on the server holding an IBAN for a bank
 * account and an email for PayPal, so it is labelled by the chosen method.
 */
function PayoutTab() {
  const t = useTranslations('settings');
  const tCommon = useTranslations('common');
  const toast = useToast();

  const methods = useLookup('payoutMethod');
  const saved = usePayoutMethods();
  const save = useSavePayoutMethod();
  const remove = useDeletePayoutMethod();

  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<PayoutMethodInput>({
    payoutMethodId: 0,
    accountId: '',
    accountName: '',
  });
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const options = methods.data ?? [];
  const chosen = options.find((option) => option.id === draft.payoutMethodId);
  const accountIdLabel = chosen
    ? /paypal/i.test(chosen.name)
      ? t('payoutAccountIdPaypal')
      : t('payoutAccountIdBank')
    : t('payoutAccountId');

  const startAdd = () => {
    setDraft({ payoutMethodId: options[0]?.id ?? 0, accountId: '', accountName: '' });
    setEditing('new');
  };

  const startEdit = (record: PayoutMethodRecord) => {
    setDraft({
      payoutMethodId: record.payoutMethodId ?? options[0]?.id ?? 0,
      accountId: record.accountId ?? '',
      accountName: record.accountName ?? '',
    });
    setEditing(record.id);
  };

  const submit = () => {
    save.mutate(
      { id: editing === 'new' ? undefined : (editing ?? undefined), input: draft },
      {
        onSuccess: () => {
          toast(t('payoutSavedToast'));
          setEditing(null);
        },
        onError: (error) => toast(error?.message || tCommon('somethingWentWrong'), 'error'),
      },
    );
  };

  const valid =
    draft.payoutMethodId > 0 && Boolean(draft.accountId.trim()) && Boolean(draft.accountName.trim());

  return (
    <Card>
      <CardHeader
        title={t('payoutTitle')}
        hint={t('payoutSubtitle')}
        action={
          editing === null ? (
            <Button size="sm" variant="ghost" className="text-accent-ink" onClick={startAdd}>
              <Plus className="size-3.5" />
              {t('payoutAdd')}
            </Button>
          ) : null
        }
      />
      <CardBody>
        {saved.isPending ? (
          <Skeleton className="h-24" />
        ) : (saved.data ?? []).length === 0 && editing === null ? (
          <p className="text-[13px] text-muted">{t('payoutEmpty')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(saved.data ?? []).map((record) => (
              <div
                key={record.id}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-ctl)] border border-line p-3"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="text-[13.5px] font-semibold text-ink">
                    {record.accountName || '—'}
                  </span>
                  <span className="text-[11.5px] text-faint latn">
                    {record.payoutMethodName ??
                      options.find((option) => option.id === record.payoutMethodId)?.name ??
                      ''}
                    {record.accountId ? ` · ${record.accountId}` : ''}
                  </span>
                </span>
                <span className="ms-auto flex gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(record)}>
                    {tCommon('edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => setPendingRemoval(record.id)}
                  >
                    {tCommon('delete')}
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}

        {editing !== null ? (
          <div className="flex flex-col gap-3 rounded-[var(--radius-ctl)] border border-line bg-surface-2 p-3">
            <Grid2>
              <Field label={t('payoutMethod')} required>
                <Select
                  value={String(draft.payoutMethodId)}
                  onChange={(e) => setDraft({ ...draft, payoutMethodId: Number(e.target.value) })}
                  disabled={methods.isPending}
                >
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('accountName')} required>
                <TextInput
                  value={draft.accountName}
                  onChange={(e) => setDraft({ ...draft, accountName: e.target.value })}
                />
              </Field>
              <Field label={accountIdLabel} required>
                <TextInput
                  value={draft.accountId}
                  onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}
                  className="latn"
                />
              </Field>
            </Grid2>
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={submit} disabled={!valid || save.isPending}>
                {save.isPending ? tCommon('saving') : tCommon('save')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                {tCommon('cancel')}
              </Button>
            </div>
          </div>
        ) : null}

        <p className="flex items-start gap-2 rounded-[var(--radius-ctl)] bg-surface-2 p-2.5 text-[11.5px] text-muted">
          <Lock className="mt-px size-3.5 shrink-0 text-faint" />
          {t('payoutLocalNote')}
        </p>
      </CardBody>

      <ConfirmDialog
        open={pendingRemoval !== null}
        onClose={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval) {
            remove.mutate(pendingRemoval, {
              onSuccess: () => toast(t('payoutDeletedToast')),
              onError: (error) => toast(error?.message || tCommon('somethingWentWrong'), 'error'),
            });
          }
          setPendingRemoval(null);
        }}
        title={t('payoutDelete')}
        body={t('payoutDeleteConfirm')}
        confirmLabel={tCommon('delete')}
      />
    </Card>
  );
}

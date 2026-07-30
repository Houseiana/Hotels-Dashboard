'use client';

import { useTranslations } from 'next-intl';
import { Card, CardBody, CardHeader, Stars } from '@/components/ui/primitives';
import {
  ArabicInput,
  ArabicTextArea,
  Field,
  Grid2,
  Grid3,
  Select,
  TextArea,
  TextInput,
  TimeInput,
  Toggle,
} from '@/components/ui/form';
import { CURRENCIES } from '@/lib/catalogs';
import { useCatalogLabels } from '@/lib/useLabels';
import { useWizard } from '../WizardProvider';
import { PanelIntro } from './PanelIntro';

export function BasicsStep() {
  const t = useTranslations('wizard.basics');
  const tStep = useTranslations('wizard');
  const labels = useCatalogLabels();
  const { draft, update, errorsFor } = useWizard();
  const errors = errorsFor('basics');

  const policies = draft.policies ?? {};
  const setPolicy = (patch: Partial<typeof policies>) =>
    update({ policies: { ...policies, ...patch } });

  return (
    <>
      <PanelIntro title={t('title')} subtitle={t('subtitle')} />

      <Card>
        <CardHeader title={t('cardIdentity')} />
        <CardBody>
          <Grid2>
            <Field
              label={t('name')}
              required
              error={labels.validation(errors['name'])}
              htmlFor="hotel-name"
            >
              <TextInput
                id="hotel-name"
                value={draft.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder={t('namePlaceholder')}
                invalid={Boolean(errors['name'])}
              />
            </Field>
            <Field label={t('nameAr')} labelHint="(العربية)" htmlFor="hotel-name-ar">
              <ArabicInput
                id="hotel-name-ar"
                value={draft.nameAr ?? ''}
                onChange={(e) => update({ nameAr: e.target.value })}
                placeholder={t('nameArPlaceholder')}
              />
            </Field>
          </Grid2>

          <Field
            label={t('description')}
            required
            error={labels.validation(errors['description'])}
            htmlFor="hotel-desc"
          >
            <TextArea
              id="hotel-desc"
              value={draft.description}
              onChange={(e) => update({ description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
              invalid={Boolean(errors['description'])}
            />
          </Field>

          <Field label={t('descriptionAr')} labelHint="(العربية)" htmlFor="hotel-desc-ar">
            <ArabicTextArea
              id="hotel-desc-ar"
              value={draft.descriptionAr ?? ''}
              onChange={(e) => update({ descriptionAr: e.target.value })}
              placeholder={t('descriptionArPlaceholder')}
            />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t('cardStay')} />
        <CardBody>
          <Grid3>
            <Field label={t('starRating')} error={labels.validation(errors['starRating'])}>
              <div className="flex items-center gap-2">
                <Stars value={draft.starRating as number | undefined} size={17} />
                <Select
                  value={draft.starRating ?? ''}
                  onChange={(e) => update({ starRating: Number(e.target.value) })}
                  className="max-w-[86px] latn"
                  invalid={Boolean(errors['starRating'])}
                  aria-label={t('starRating')}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>

            <Field
              label={t('currency')}
              required
              help={t('currencyHint')}
              error={labels.validation(errors['currency'])}
              htmlFor="hotel-currency"
            >
              <Select
                id="hotel-currency"
                value={draft.currency}
                onChange={(e) => update({ currency: e.target.value })}
                invalid={Boolean(errors['currency'])}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code} · {labels.currency(code)}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-[15px]">
              <Field
                label={t('checkIn')}
                error={labels.validation(errors['policies.checkInFrom'])}
                htmlFor="check-in"
              >
                <TimeInput
                  id="check-in"
                  value={policies.checkInFrom ?? ''}
                  onChange={(e) => setPolicy({ checkInFrom: e.target.value })}
                />
              </Field>
              <Field
                label={t('checkOut')}
                error={labels.validation(errors['policies.checkOutUntil'])}
                htmlFor="check-out"
              >
                <TimeInput
                  id="check-out"
                  value={policies.checkOutUntil ?? ''}
                  onChange={(e) => setPolicy({ checkOutUntil: e.target.value })}
                />
              </Field>
            </div>
          </Grid3>
        </CardBody>
      </Card>

      {/* Policies live here rather than in their own step: they are short, and
          the reference wizard keeps step 1 as the "everything textual" step. */}
      <Card>
        <CardHeader title={t('cardPolicies')} hint={tStep('steps.basicsSub')} />
        <CardBody>
          <Field label={t('cancellation')} htmlFor="policy-cancel">
            <TextInput
              id="policy-cancel"
              value={policies.cancellation ?? ''}
              onChange={(e) => setPolicy({ cancellation: e.target.value })}
              placeholder={t('cancellationPlaceholder')}
            />
          </Field>

          <Grid2>
            <Field label={t('childrenPolicy')} htmlFor="policy-children">
              <TextArea
                id="policy-children"
                value={policies.childrenPolicy ?? ''}
                onChange={(e) => setPolicy({ childrenPolicy: e.target.value })}
                placeholder={t('childrenPolicyPlaceholder')}
                className="min-h-[64px]"
              />
            </Field>
            <Field label={t('paymentNote')} htmlFor="policy-payment">
              <TextArea
                id="policy-payment"
                value={policies.paymentNote ?? ''}
                onChange={(e) => setPolicy({ paymentNote: e.target.value })}
                placeholder={t('paymentNotePlaceholder')}
                className="min-h-[64px]"
              />
            </Field>
          </Grid2>

          <Grid2>
            <Toggle
              checked={policies.petsAllowed ?? false}
              onChange={(v) => setPolicy({ petsAllowed: v })}
              label={t('petsAllowed')}
              help={t('petsAllowedHint')}
            />
            <Toggle
              checked={policies.smokingAllowed ?? false}
              onChange={(v) => setPolicy({ smokingAllowed: v })}
              label={t('smokingAllowed')}
              help={t('smokingAllowedHint')}
            />
          </Grid2>
        </CardBody>
      </Card>
    </>
  );
}

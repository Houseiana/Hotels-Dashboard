'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, CardHeader, Skeleton } from '@/components/ui/primitives';
import { Field, Select, Toggle } from '@/components/ui/form';
import { Modal } from '@/components/ui/overlay';
import { useLookup } from '@/lib/query/lookups';
import { POLICY_TYPE_NAMES } from '@/lib/api/catalogMap';
import { useCatalogLabels } from '@/lib/useLabels';
import { useWizard } from '../WizardProvider';

/** Display name → our slug, so the Arabic UI can label a server rule. */
function slugForName(name: string): string | undefined {
  const needle = name.trim().toLowerCase();
  return Object.keys(POLICY_TYPE_NAMES).find(
    (slug) => POLICY_TYPE_NAMES[slug].trim().toLowerCase() === needle,
  );
}

/**
 * The hotel's house rules.
 *
 * Shows the rules this hotel has declared; adding one opens a dialog that picks
 * from the server's HotelPolicyTypes lookup. A rule nobody added is "not
 * stated", which is different from "not allowed" — so the card starts empty
 * rather than listing every type with a switch already answered for the owner.
 *
 * Nothing is written here. On create the rules ride along with the hotel; on
 * edit they go to `POST /api/hotels/{id}/policies`, which replaces the set.
 */
export function HouseRulesCard() {
  const t = useTranslations('wizard.basics');
  const tCommon = useTranslations('common');
  const labels = useCatalogLabels();
  const { draft, update } = useWizard();

  const types = useLookup('hotelPolicyTypes');
  const options = types.data ?? [];

  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState(0);
  const [allowed, setAllowed] = useState(true);

  const added = draft.houseRules;
  const addedIds = new Set(added.map((rule) => rule.policyTypeId));
  const available = options.filter((option) => !addedIds.has(option.id));

  const nameOf = (policyTypeId: number) => {
    const option = options.find((o) => o.id === policyTypeId);
    if (!option) return `#${policyTypeId}`;
    const slug = slugForName(option.name);
    return slug ? labels.policyType(slug) : option.name;
  };

  const openDialog = () => {
    setPick(available[0]?.id ?? 0);
    setAllowed(true);
    setAdding(true);
  };

  const confirmAdd = () => {
    if (!pick) return;
    update({ houseRules: [...added, { policyTypeId: pick, allowed }] });
    setAdding(false);
  };

  const setAllowedFor = (policyTypeId: number, next: boolean) =>
    update({
      houseRules: added.map((rule) =>
        rule.policyTypeId === policyTypeId ? { ...rule, allowed: next } : rule,
      ),
    });

  const removeRule = (policyTypeId: number) =>
    update({ houseRules: added.filter((rule) => rule.policyTypeId !== policyTypeId) });

  return (
    <Card>
      <CardHeader
        title={t('cardHouseRules')}
        hint={t('houseRulesHint')}
        action={
          available.length > 0 ? (
            <Button size="sm" variant="ghost" className="text-accent-ink" onClick={openDialog}>
              <Plus className="size-3.5" />
              {t('addPolicy')}
            </Button>
          ) : null
        }
      />
      <CardBody>
        {types.isPending ? (
          <Skeleton className="h-20" />
        ) : options.length === 0 ? (
          <p className="text-[13px] text-muted">{t('houseRulesEmpty')}</p>
        ) : added.length === 0 ? (
          <p className="text-[13px] text-muted">{t('houseRulesNoneYet')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {added.map((rule) => (
              <div
                key={rule.policyTypeId}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-ctl)] border border-line px-3.5 py-2.5"
              >
                <span className="text-[13.5px] font-medium text-ink">
                  {nameOf(rule.policyTypeId)}
                </span>
                <span className="ms-auto flex items-center gap-2.5">
                  <Toggle
                    checked={rule.allowed}
                    onChange={(v) => setAllowedFor(rule.policyTypeId, v)}
                    label={rule.allowed ? t('houseRuleAllowed') : t('houseRuleNotAllowed')}
                  />
                  <button
                    type="button"
                    onClick={() => removeRule(rule.policyTypeId)}
                    aria-label={t('removePolicy')}
                    className="grid size-[28px] place-items-center rounded-[6px] text-faint transition hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {added.length > 0 && available.length === 0 ? (
          <p className="text-[11.5px] text-faint">{t('houseRulesAllAdded')}</p>
        ) : null}
      </CardBody>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={t('addPolicy')}
        subtitle={t('houseRulesHint')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              {tCommon('cancel')}
            </Button>
            <Button variant="primary" onClick={confirmAdd} disabled={!pick}>
              {t('addPolicy')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t('policyType')} required>
            <Select
              value={String(pick)}
              onChange={(e) => setPick(Number(e.target.value))}
              aria-label={t('policyType')}
            >
              {available.map((option) => {
                const slug = slugForName(option.name);
                return (
                  <option key={option.id} value={option.id}>
                    {slug ? labels.policyType(slug) : option.name}
                  </option>
                );
              })}
            </Select>
          </Field>

          <Field label={t('policyAllowed')}>
            <Toggle
              checked={allowed}
              onChange={setAllowed}
              label={allowed ? t('houseRuleAllowed') : t('houseRuleNotAllowed')}
            />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

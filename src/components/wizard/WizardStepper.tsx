'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { WIZARD_STEPS, type WizardStep } from '@/lib/schemas/draft';
import { useWizard } from './WizardProvider';
import { cn } from '@/lib/utils';

/** The reference artifact's stepper: circle + label + sub, underlined when reached. */
export function WizardStepper() {
  const t = useTranslations('wizard.steps');
  const { step, stepIndex, goTo, issuesFor, attempted } = useWizard();

  return (
    <div className="mx-auto flex max-w-wizard gap-1">
      {WIZARD_STEPS.map((id, index) => {
        const isCurrent = id === step;
        const isDone = index < stepIndex;
        const issues = issuesFor(id).length;
        const showIssues = issues > 0 && (attempted[id] || index < stepIndex);

        return (
          <button
            key={id}
            type="button"
            onClick={() => goTo(id as WizardStep)}
            aria-current={isCurrent ? 'step' : undefined}
            className={cn(
              'flex flex-1 flex-col gap-2 border-b-2 pb-3.5 text-start transition-colors',
              isCurrent || isDone ? 'border-accent' : 'border-line',
            )}
          >
            <span className="flex items-center gap-2.5">
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] text-[12px] font-bold latn',
                  isCurrent && 'border-accent bg-accent-soft text-accent-ink',
                  isDone && 'border-accent bg-accent text-on-accent',
                  !isCurrent && !isDone && 'border-line-strong bg-surface-2 text-faint',
                  showIssues && !isCurrent && 'border-danger bg-danger-soft text-danger',
                )}
              >
                {isDone && !showIssues ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : showIssues ? (
                  issues
                ) : (
                  index + 1
                )}
              </span>
              <span
                className={cn(
                  'hidden truncate text-[12.5px] font-semibold md:block',
                  isCurrent ? 'text-ink' : 'text-muted',
                )}
              >
                {t(id)}
              </span>
            </span>
            <span className="hidden ps-[33px] text-[11px] text-faint md:block">
              {t(`${id}Sub`)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

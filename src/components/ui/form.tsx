'use client';

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useId } from 'react';
import { Check } from 'lucide-react';
import { cn, toNumberOrUndefined } from '@/lib/utils';

/* -- field wrapper --------------------------------------------------------- */

export function Field({
  label,
  labelHint,
  required,
  help,
  error,
  className,
  htmlFor,
  children,
}: {
  label?: ReactNode;
  labelHint?: ReactNode;
  required?: boolean;
  help?: ReactNode;
  error?: string;
  className?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-1.5 text-[12px] font-semibold text-muted"
        >
          {label}
          {required ? <span className="text-danger">*</span> : null}
          {labelHint ? <span className="font-medium text-faint">{labelHint}</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-[11.5px] font-medium text-danger">{error}</p>
      ) : help ? (
        <p className="text-[11.5px] text-faint">{help}</p>
      ) : null}
    </div>
  );
}

const CONTROL_BASE =
  'w-full rounded-[var(--radius-ctl)] border bg-surface-2 px-[11px] py-[9px] text-[14px] text-ink transition-[border-color,box-shadow] placeholder:text-faint focus:border-accent-ink focus:bg-surface focus:outline-none focus:ring-[3px] focus:ring-accent-soft disabled:opacity-60';

const controlTone = (invalid?: boolean) =>
  invalid ? 'border-danger/60 bg-danger-soft/40' : 'border-line-strong';

/* -- text inputs ----------------------------------------------------------- */

export type TextInputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean };

export function TextInput({ className, invalid, ...props }: TextInputProps) {
  return (
    <input
      className={cn(CONTROL_BASE, controlTone(invalid), className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

/** Arabic-side twin: always RTL and start-aligned within its own direction. */
export function ArabicInput({ className, ...props }: TextInputProps) {
  return <TextInput dir="rtl" className={cn('text-start', className)} {...props} />;
}

export function TextArea({
  className,
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        CONTROL_BASE,
        controlTone(invalid),
        'min-h-[72px] resize-y leading-[1.55]',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function ArabicTextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <TextArea dir="rtl" className={cn('text-start', className)} {...props} />;
}

/**
 * Numbers are held as `number | undefined` so a half-typed field is a real
 * empty value rather than NaN or a coerced 0.
 */
export function NumberInput({
  value,
  onValueChange,
  className,
  invalid,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number | undefined;
  onValueChange: (next: number | undefined) => void;
  invalid?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      value={value === undefined || Number.isNaN(value) ? '' : value}
      onChange={(event) => onValueChange(toNumberOrUndefined(event.target.value))}
      className={cn(CONTROL_BASE, controlTone(invalid), 'tnum latn', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function TimeInput({ className, invalid, ...props }: TextInputProps) {
  return (
    <input
      type="time"
      className={cn(CONTROL_BASE, controlTone(invalid), 'tnum latn', className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

/* -- select ---------------------------------------------------------------- */

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%238a99a0' stroke-width='1.4' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")";

export function Select({
  className,
  invalid,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cn(
        CONTROL_BASE,
        controlTone(invalid),
        'appearance-none bg-[position:right_11px_center] bg-no-repeat pe-[30px] rtl:bg-[position:left_11px_center] rtl:pe-[11px] rtl:ps-[30px]',
        className,
      )}
      style={{ backgroundImage: CHEVRON }}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

/* -- toggles --------------------------------------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
  help,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  help?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full border transition-colors disabled:opacity-50',
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-surface-2',
        )}
      >
        {/* Dark knob when on: a white knob on brand yellow is too low-contrast
            for the state to read at a glance. */}
        <span
          className={cn(
            'absolute top-1/2 size-[16px] -translate-y-1/2 rounded-full shadow-sm transition-[inset-inline-start]',
            checked ? 'start-[18px] bg-on-accent' : 'start-[2px] bg-white',
          )}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer select-none">
        <span className="block text-[13px] font-semibold text-ink">{label}</span>
        {help ? <span className="block text-[11.5px] text-faint">{help}</span> : null}
      </label>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        id={id}
        role="checkbox"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'grid size-[18px] place-items-center rounded-[5px] border transition-colors',
          checked ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface-2',
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </button>
      <label htmlFor={id} className="cursor-pointer select-none text-[13px] text-ink">
        {label}
      </label>
    </div>
  );
}

/** The reference artifact's selectable amenity pill. */
export function SelectChip({
  selected,
  onToggle,
  children,
}: {
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-[7px] rounded-full border px-[11px] py-1.5 text-[12.5px] transition-all duration-100',
        selected
          ? 'border-accent bg-accent-soft font-semibold text-accent-ink'
          : 'border-line-strong bg-surface-2 font-medium text-muted hover:border-accent hover:text-ink',
      )}
    >
      {selected ? <Check className="size-[13px]" strokeWidth={2.6} /> : null}
      {children}
    </button>
  );
}

/* -- layout helpers -------------------------------------------------------- */

export function Grid2({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn('grid grid-cols-1 gap-[15px] sm:grid-cols-2', className)}>{children}</div>
  );
}

export function Grid3({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn('grid grid-cols-1 gap-[15px] sm:grid-cols-2 lg:grid-cols-3', className)}
    >
      {children}
    </div>
  );
}

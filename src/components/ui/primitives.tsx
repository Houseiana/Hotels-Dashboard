'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/* -- button ---------------------------------------------------------------- */

type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger' | 'dashed';
type ButtonSize = 'sm' | 'md';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  default:
    'border-line-strong bg-surface text-ink hover:bg-surface-2 active:translate-y-px',
  primary:
    'border-accent bg-accent text-on-accent hover:border-accent-strong hover:bg-accent-strong active:translate-y-px',
  ghost: 'border-transparent bg-transparent text-muted hover:bg-surface-2 hover:text-ink',
  danger: 'border-transparent bg-transparent text-danger hover:bg-danger-soft',
  dashed:
    'border-dashed border-line-strong bg-transparent text-accent-ink hover:border-accent hover:bg-accent-soft',
};

export function Button({
  variant = 'default',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-[7px] rounded-[var(--radius-ctl)] border font-semibold transition-[background-color,border-color,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-45',
        size === 'sm' ? 'px-[11px] py-1.5 text-[12.5px]' : 'px-4 py-[9px] text-[13.5px]',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

/* -- card ------------------------------------------------------------------ */

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  hint,
  action,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-line px-[18px] py-[15px]',
        className,
      )}
    >
      <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
      {hint ? <span className="ms-auto text-[12px] text-faint">{hint}</span> : null}
      {action ? <div className={cn(hint ? 'ms-2' : 'ms-auto')}>{action}</div> : null}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn('flex flex-col gap-4 p-[18px]', className)}>{children}</div>;
}

/* -- chip ------------------------------------------------------------------ */

type ChipTone = 'neutral' | 'draft' | 'active' | 'danger' | 'info' | 'accent';

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: 'border-line bg-surface-2 text-muted',
  draft: 'border-transparent bg-warn-soft text-warn',
  active: 'border-transparent bg-ok-soft text-ok',
  danger: 'border-transparent bg-danger-soft text-danger',
  info: 'border-transparent bg-info-soft text-info',
  accent: 'border-accent bg-accent-soft text-accent-ink',
};

export function Chip({
  tone = 'neutral',
  dot = false,
  className,
  children,
}: {
  tone?: ChipTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-[12px] font-semibold',
        CHIP_TONES[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

/* -- stars ----------------------------------------------------------------- */

export function Stars({
  value,
  size = 14,
  className,
}: {
  value: number | undefined;
  size?: number;
  className?: string;
}) {
  const count = Math.max(0, Math.min(5, Math.round(value ?? 0)));
  return (
    <span
      className={cn('inline-flex items-center gap-[2px] text-warn', className)}
      aria-label={`${count}/5`}
    >
      {Array.from({ length: count }, (_, i) => (
        <Star key={i} style={{ width: size, height: size }} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
}

/* -- loading & empty ------------------------------------------------------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-[var(--radius-ctl)]', className)} />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong bg-surface-2/60 px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? (
        <div className="grid size-11 place-items-center rounded-[10px] bg-accent-soft text-accent-ink">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {body ? <p className="max-w-sm text-[13px] text-muted">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

/* -- page chrome ----------------------------------------------------------- */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-serif text-[24px] font-semibold tracking-[-.01em] text-ink">
          {title}
        </h1>
        {subtitle ? <p className="text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function SubHeading({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[.06em] text-faint">
      {children}
      {hint ? (
        <span className="font-medium normal-case tracking-normal text-faint">{hint}</span>
      ) : null}
    </span>
  );
}

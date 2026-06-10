import { AlertTriangle, Check, Clock, Link2, X } from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';

// ---------------------------------------------------------------------------
// Intake-lifecycle status union (mirrors
// packages/api/src/routers/invoice-intake.ts listStatusValues).
// ---------------------------------------------------------------------------

export const INTAKE_STATUSES = [
  'PARSED',
  'NEEDS_REVIEW',
  'MATCHED',
  'CONVERTED',
  'REJECTED',
] as const;

export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

interface StatusVisual {
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  /**
   * Token-aligned Tailwind classes using `--muted`, `--warning`, `--info`,
   * `--success`, `--destructive` CSS variables bridged by `globals.css`.
   */
  className: string;
}

// Status pill tokens. The einvoice-status-cell uses concrete tailwind color
// escapes (amber/green/blue) because the project's `--warning` / `--info` /
// `--success` palette lives behind color-utility variables that need tailwind
// 4's @theme inline bridge (already in place in globals.css). We mirror the
// same concrete-color strategy here for visual parity with the outbound
// e-invoice pills.
const STATUS_VISUALS: Record<IntakeStatus, StatusVisual> = {
  PARSED: {
    icon: Clock,
    className: 'bg-muted text-muted-foreground',
  },
  NEEDS_REVIEW: {
    icon: AlertTriangle,
    className: 'bg-amber-500/10 text-amber-800 dark:text-amber-400 dark:bg-amber-500/20',
  },
  MATCHED: {
    icon: Link2,
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 dark:bg-blue-500/20',
  },
  CONVERTED: {
    icon: Check,
    className: 'bg-green-600/10 text-green-800 dark:text-green-400 dark:bg-green-600/20',
  },
  REJECTED: {
    icon: X,
    className: 'bg-destructive/10 text-destructive',
  },
};

interface IntakeStatusPillProps {
  status: IntakeStatus;
  /** Extra classes (composition only — does not override tokens). */
  className?: string;
}

/**
 * Intake-lifecycle status pill. Color + icon + text triad (never color alone
 * for accessibility). Receives its translated label via
 * `EInvoice.intake.status.{STATUS}` and surfaces it as `aria-label` for
 * screen-reader users who see only the colour.
 */
export function IntakeStatusPill({ status, className }: IntakeStatusPillProps) {
  const t = useTranslations('EInvoice.intake.status');
  const { icon: Icon, className: tokenClasses } = STATUS_VISUALS[status];
  const label = t(status);

  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tokenClasses,
        className,
      )}
      data-status={status}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

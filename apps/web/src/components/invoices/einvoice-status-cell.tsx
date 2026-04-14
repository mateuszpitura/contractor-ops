'use client';

import { Circle, CircleCheck, CircleDashed, ShieldAlert, ShieldX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// Public compliance-status union (maps 1:1 to the einvoice.listByOrg /
// summaryForOrg router enum).
// ---------------------------------------------------------------------------

export type EInvoiceComplianceStatus =
  | 'notGenerated'
  | 'valid'
  | 'warnings'
  | 'invalid'
  | 'transmitted'
  | 'failed';

interface EInvoiceStatusCellProps {
  /** Compliance status (derived server-side from EInvoiceLifecycle row). */
  status: EInvoiceComplianceStatus;
  /** Owning invoice id — cell wraps a link to its E-invoice tab. */
  invoiceId: string;
  /** Optional extra classes for the outer link. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Semantic triad (colour + icon + text) — every status renders all three.
// ---------------------------------------------------------------------------

type StatusVisualConfig = {
  icon: ComponentType<{ className?: string }>;
  /** Tailwind classes mapping to locked phase-61 pill palette. */
  className: string;
  labelKey:
    | 'notGenerated'
    | 'valid'
    | 'warnings'
    | 'invalid'
    | 'transmitted'
    | 'failed';
};

const STATUS_VISUALS: Record<EInvoiceComplianceStatus, StatusVisualConfig> = {
  notGenerated: {
    icon: Circle,
    className: 'border-muted text-muted-foreground bg-muted/40',
    labelKey: 'notGenerated',
  },
  valid: {
    icon: CircleCheck,
    className: 'border-green-600/40 text-green-700 dark:text-green-400 bg-green-600/10',
    labelKey: 'valid',
  },
  warnings: {
    icon: ShieldAlert,
    className: 'border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10',
    labelKey: 'warnings',
  },
  invalid: {
    icon: ShieldX,
    className: 'border-destructive/40 text-destructive bg-destructive/10',
    labelKey: 'invalid',
  },
  transmitted: {
    icon: CircleDashed,
    className: 'border-blue-500/40 text-blue-700 dark:text-blue-400 bg-blue-500/10',
    labelKey: 'transmitted',
  },
  failed: {
    icon: ShieldX,
    className: 'border-destructive/40 text-destructive bg-destructive/10',
    labelKey: 'failed',
  },
};

/**
 * Stateless compliance-status cell for the invoices-list table. Wrapped in
 * an internal `<Link>` so keyboard + pointer users can navigate to the
 * invoice's E-invoice tab in one click. Uses the locked semantic triad —
 * colour + icon + text — per UI-SPEC §Semantic triad rule.
 *
 * i18n keys consumed:
 * - `EInvoice.InvoicesList.Cell.notGenerated`
 * - `EInvoice.InvoicesList.Cell.valid`
 * - `EInvoice.InvoicesList.Cell.warnings`
 * - `EInvoice.InvoicesList.Cell.invalid`
 * - `EInvoice.InvoicesList.Cell.transmitted`
 * - `EInvoice.InvoicesList.Cell.failed`
 */
export function EInvoiceStatusCell({
  status,
  invoiceId,
  className,
}: EInvoiceStatusCellProps) {
  const t = useTranslations('EInvoice.InvoicesList.Cell');

  const visual = STATUS_VISUALS[status];
  const Icon = visual.icon;

  return (
    <Link
      href={`/invoices/${invoiceId}?tab=e-invoice`}
      className={`inline-flex items-center ${className ?? ''}`}
      aria-label={t(visual.labelKey)}>
      <Badge variant="outline" className={`gap-1 ${visual.className}`}>
        <Icon className="h-3 w-3" aria-hidden="true" />
        <span>{t(visual.labelKey)}</span>
      </Badge>
    </Link>
  );
}

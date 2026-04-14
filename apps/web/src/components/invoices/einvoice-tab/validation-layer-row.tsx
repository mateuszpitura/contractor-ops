'use client';

import { CircleCheck, Circle, ShieldAlert, ShieldX } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import { Badge } from '@/components/ui/badge';

export type ValidationLayerStatus = 'pass' | 'warnings' | 'fail' | 'skipped';

interface ValidationLayerRowProps {
  /** Which of the 3 XRechnung validation layers. */
  layer: 1 | 2 | 3;
  status: ValidationLayerStatus;
  errorCount: number;
  warningCount: number;
}

const STATUS_VISUAL: Record<
  ValidationLayerStatus,
  { icon: ComponentType<{ className?: string }>; className: string }
> = {
  pass: {
    icon: CircleCheck,
    className: 'border-green-600/40 text-green-700 dark:text-green-400 bg-green-600/10',
  },
  warnings: {
    icon: ShieldAlert,
    className: 'border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10',
  },
  fail: {
    icon: ShieldX,
    className: 'border-destructive/40 text-destructive bg-destructive/10',
  },
  skipped: {
    icon: Circle,
    className: 'border-muted text-muted-foreground bg-muted/40',
  },
};

/**
 * Single validation-layer row: status pill (semantic triad) + layer name
 * + issue-count caption. Used inside the Validation section of the
 * E-invoice tab.
 */
export function ValidationLayerRow({
  layer,
  status,
  errorCount,
  warningCount,
}: ValidationLayerRowProps) {
  const t = useTranslations('EInvoice.InvoiceTab');
  const labelKey = (`layer${layer}Label` as const) as
    | 'layer1Label'
    | 'layer2Label'
    | 'layer3Label';

  const { icon: Icon, className } = STATUS_VISUAL[status];
  const resultLabel = (() => {
    if (status === 'pass') return t('layerResultPass');
    if (status === 'warnings') return t('layerResultWarningsPattern', { count: warningCount });
    if (status === 'fail') return t('layerResultFailPattern', { count: errorCount });
    return '—';
  })();

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-md border p-3"
      data-slot="validation-layer-row"
      data-layer={layer}
      data-status={status}>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className={`gap-1 ${className}`}>
          <Icon className="h-3 w-3" aria-hidden="true" />
          <span>{status.toUpperCase()}</span>
        </Badge>
        <span className="text-sm font-medium">{t(labelKey)}</span>
      </div>
      <span className="text-sm text-muted-foreground tabular-nums">{resultLabel}</span>
    </div>
  );
}

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { PeppolTransmissionBadgeData } from '../hooks/use-peppol-status-badge.js';

// ---------------------------------------------------------------------------
// Status → variant mapping
// ---------------------------------------------------------------------------

const TX_VARIANT: Record<string, { label: string; className: string }> = {
  DELIVERED: {
    label: 'Delivered',
    className: 'bg-success/10 text-success border-success/20',
  },
  TRANSMITTED: {
    label: 'Transmitted',
    className: 'bg-info/10 text-info border-info/20',
  },
  PENDING: {
    label: 'Pending',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  FAILED: {
    label: 'Failed',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
};

// ---------------------------------------------------------------------------
// Refresh cadence — poll every 30s. Storecove side updates land via QStash
// pollers within ~1m so a tighter cadence brings no extra fidelity.
// ---------------------------------------------------------------------------

interface PeppolStatusBadgeProps {
  transmission: PeppolTransmissionBadgeData | null;
}

/**
 * Compact Peppol transmission badge for the invoice header.
 *
 * Polls `peppol.getTransmissionByInvoiceId` every 15s while the transmission
 * is in-flight, slowing to 5m once a terminal status is reached. Renders
 * nothing when no transmission exists for the invoice.
 */
export function PeppolStatusBadge({ transmission }: PeppolStatusBadgeProps) {
  const t = useTranslations('Peppol.statusBadge');

  if (!transmission) return null;

  const variant = TX_VARIANT[transmission.status] ?? TX_VARIANT.PENDING;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge
              variant="outline"
              className={`${variant.className} font-mono text-[11px]`}
              data-slot="peppol-status-badge"
              aria-label={t('ariaLabel', { status: variant.label })}>
              <span className="me-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-80" />
              {t('label')} · {variant.label}
            </Badge>
          }
        />
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p>
              {t('receiver')}{' '}
              <span className="font-mono">{transmission.receiverParticipantId}</span>
            </p>
            {transmission.aspTransmissionId ? (
              <p>
                {t('aspRef')} <span className="font-mono">{transmission.aspTransmissionId}</span>
              </p>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

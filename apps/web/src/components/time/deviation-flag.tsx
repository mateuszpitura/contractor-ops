'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeviationFlagProps {
  deviationPercent: number;
  thresholdPercent: number;
  expectedAmountMinor: number;
  invoicedAmountMinor: number;
  rateValueMinor: number;
  approvedMinutes: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinorUnits(minor: number): string {
  return new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}` : hours.toFixed(1);
}

function formatRate(minor: number): string {
  return formatMinorUnits(minor);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Badge-style deviation indicator for invoice-vs-time reconciliation.
 *
 * Severity mapping per UI-SPEC:
 * - No time data: secondary, "No time data"
 * - Within threshold: success, "Within {threshold}%"
 * - Over threshold (<=2x): warning, "+{percent}% over expected"
 * - Significantly over (>2x): destructive, "+{percent}% deviation"
 *
 * Tooltip shows calculation breakdown per D-14.
 * Flags are warnings only (D-15) and do not block invoice approval.
 */
export function DeviationFlag({
  deviationPercent,
  thresholdPercent,
  expectedAmountMinor,
  invoicedAmountMinor,
  rateValueMinor,
  approvedMinutes,
}: DeviationFlagProps) {
  const hours = formatHours(approvedMinutes);
  const rate = formatRate(rateValueMinor);
  const expected = formatMinorUnits(expectedAmountMinor);
  const actual = formatMinorUnits(invoicedAmountMinor);
  const delta = formatMinorUnits(Math.abs(invoicedAmountMinor - expectedAmountMinor));

  const tooltipText = `Expected: ${rate}/h x ${hours}h = ${expected}. Invoiced: ${actual}. Difference: ${delta}.`;

  let variant: 'secondary' | 'success' | 'warning' | 'destructive';
  let label: string;

  if (deviationPercent <= thresholdPercent) {
    variant = 'success';
    label = `Within ${thresholdPercent}%`;
  } else if (deviationPercent <= 2 * thresholdPercent) {
    variant = 'warning';
    label = `+${deviationPercent.toFixed(1)}% over expected`;
  } else {
    variant = 'destructive';
    label = `+${deviationPercent.toFixed(1)}% deviation`;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Badge variant={variant} className="cursor-help">
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

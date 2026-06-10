/**
 * DeviationFlag — invoice-vs-time reconciliation severity badge.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@contractor-ops/ui/components/shadcn/tooltip';

import { formatMinorUnits as formatMinorUnitsLib } from '../../lib/money.js';

interface DeviationFlagProps {
  deviationPercent: number;
  thresholdPercent: number;
  expectedAmountMinor: number;
  invoicedAmountMinor: number;
  rateValueMinor: number;
  approvedMinutes: number;
}

function formatMinorUnits(minor: number): string {
  return formatMinorUnitsLib(minor, null, 'pl-PL');
}

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return hours % 1 === 0 ? `${hours}` : hours.toFixed(1);
}

function formatRate(minor: number): string {
  return formatMinorUnits(minor);
}

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

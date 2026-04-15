'use client';

import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';

// ---------------------------------------------------------------------------
// Modulus Check Warning List
//
// Phase 63 Plan 04 — per-item sort-code modulus check results.
// Each entry: contractor name, masked sort code, status pill, reason text.
// ---------------------------------------------------------------------------

interface ModulusWarning {
  contractorName: string;
  sortCode: string;
  warnings: string[];
}

interface ModulusCheckWarningListProps {
  warnings: ModulusWarning[];
}

/**
 * Derives a status from the warning entry.
 * Items with warnings = WARN, items with no warnings = VALID.
 */
function deriveStatus(warning: ModulusWarning): 'VALID' | 'WARN' | 'INVALID' {
  if (warning.warnings.length === 0) return 'VALID';
  // Check for explicit "invalid" keywords
  const hasInvalid = warning.warnings.some(
    (w) => w.toLowerCase().includes('invalid') || w.toLowerCase().includes('failed'),
  );
  return hasInvalid ? 'INVALID' : 'WARN';
}

/**
 * Formats a sort code for display: "XX-XX-XX" (all masked).
 */
function formatMaskedSortCode(sortCode: string): string {
  // Sort code is 6 digits; display as XX-XX-XX (masked)
  return `${sortCode.slice(0, 2)}-${sortCode.slice(2, 4)}-${sortCode.slice(4, 6)}`;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  VALID: 'default',
  WARN: 'secondary',
  INVALID: 'destructive',
};

export function ModulusCheckWarningList({ warnings }: ModulusCheckWarningListProps) {
  const t = useTranslations('Payments');

  // Only show items that have warnings
  const itemsWithWarnings = warnings.filter((w) => w.warnings.length > 0);

  if (itemsWithWarnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{t('modulusCheckTitle')}</h4>
      <ul className="space-y-2" role="list">
        {itemsWithWarnings.map((warning) => {
          const status = deriveStatus(warning);
          return (
            <li
              key={`${warning.contractorName}-${warning.sortCode}`}
              className="flex items-start gap-3 rounded-md border p-3 text-sm"
            >
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{warning.contractorName}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs tabular-nums">
                    {formatMaskedSortCode(warning.sortCode)}
                  </code>
                </div>
                {warning.warnings.map((reason, idx) => (
                  <p key={idx} className="text-muted-foreground">
                    {reason}
                  </p>
                ))}
              </div>
              <Badge
                variant={STATUS_VARIANT[status] ?? 'outline'}
                aria-label={`${t('modulusStatus')}: ${status}`}
              >
                {status}
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

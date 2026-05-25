/**
 * BACS modulus check warning list — ported from
 * apps/web/src/components/payments/bacs/modulus-check-warning-list.tsx.
 * next-intl → ../../../i18n/useTranslations.
 */

import { Badge } from '@contractor-ops/ui/components/shadcn/badge';

import { usePermissions } from '../../../hooks/use-permissions.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import { canViewSensitivePii, maskSortCode } from '../../../lib/mask-pii.js';

export interface ModulusWarning {
  contractorName: string;
  /** 6-digit sort code, hyphen-free. */
  sortCode: string;
  warnings: string[];
}

interface ModulusCheckWarningListProps {
  warnings: ModulusWarning[];
}

function formatSortCode(plain: string): string {
  if (plain.length !== 6) return plain;
  return `${plain.slice(0, 2)}-${plain.slice(2, 4)}-${plain.slice(4, 6)}`;
}

export function ModulusCheckWarningList({ warnings }: ModulusCheckWarningListProps) {
  const t = useTranslations('Payments.bacs');
  const { role } = usePermissions();
  const showPii = canViewSensitivePii(role);

  if (warnings.length === 0) return null;

  return (
    <section aria-labelledby="modulus-check-heading" className="space-y-2">
      <h3 id="modulus-check-heading" className="text-sm font-medium text-foreground/80">
        {t('modulusWarningTitle')}
      </h3>
      <ul className="divide-y divide-border rounded-md border bg-card">
        {warnings.map((w, idx) => (
          <li
            key={`${w.contractorName}-${w.sortCode}-${idx}`}
            className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="font-medium truncate">{w.contractorName}</span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {showPii ? formatSortCode(w.sortCode) : maskSortCode(w.sortCode)}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0 max-w-[60%]">
              <Badge variant="warning" aria-label={t('aria.modulusWarning')}>
                WARN
              </Badge>
              {w.warnings.length > 0 && (
                <span className="text-[11px] text-muted-foreground text-end">
                  {w.warnings.join(' · ')}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

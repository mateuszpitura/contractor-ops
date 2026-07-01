import { Badge } from '@contractor-ops/ui/components/shadcn/badge';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';

export type ErasureDispositionState = 'erased' | 'retained';

/**
 * Per-disposition class map for the erasure row badge. `erased` reads on the
 * shipped `--status-success` token, `retained` on `--status-warning` (a
 * statutory hold, not an error). Colours come only from the pre-verified status
 * tokens — no ad hoc values — matching the section-status-badge convention.
 */
const STATUS_CLASS_MAP: Record<ErasureDispositionState, string> = {
  erased: 'bg-[var(--status-success-bg)] text-[var(--status-success-fg)] border-transparent',
  retained: 'bg-[var(--status-warning-bg)] text-[var(--status-warning-fg)] border-transparent',
};

interface ErasureDispositionBadgeProps {
  disposition: ErasureDispositionState;
  className?: string;
}

/** Single source of truth for the erased/retained disposition badge palette. */
export function ErasureDispositionBadge({ disposition, className }: ErasureDispositionBadgeProps) {
  const t = useTranslations('PersonnelFile.erasure');
  const label = tDynLoose(t, 'disposition', disposition);
  return (
    <Badge
      variant="secondary"
      className={`${STATUS_CLASS_MAP[disposition]} ${className ?? ''}`.trim()}
      aria-label={label}>
      {label}
    </Badge>
  );
}

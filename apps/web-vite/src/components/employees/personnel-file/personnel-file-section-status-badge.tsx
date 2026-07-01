import { Badge } from '@contractor-ops/ui/components/shadcn/badge';

import { tDynLoose } from '../../../i18n/typed-keys.js';
import { useTranslations } from '../../../i18n/useTranslations.js';
import type { SectionState } from './hooks/use-personnel-file.js';

type BadgeState = Extract<SectionState, 'locked' | 'empty' | 'populated'>;

/**
 * Per-state class map for the personnel-file section badge. `locked` uses the
 * shipped `--status-blocked` token (a section the caller may not read is gated,
 * not in error); `empty`/`populated` stay neutral/positive. Colours come only
 * from the pre-verified status tokens — no ad hoc hex values.
 */
const STATUS_CLASS_MAP: Record<BadgeState, string> = {
  locked: 'bg-[var(--status-blocked-bg)] text-[var(--status-blocked-fg)] border-transparent',
  empty: 'bg-muted text-muted-foreground border-transparent',
  populated: 'bg-[var(--status-success-bg)] text-[var(--status-success-fg)] border-transparent',
};

interface PersonnelFileSectionStatusBadgeProps {
  state: BadgeState;
  className?: string;
}

/** Single source of truth for the personnel-file section status badge palette. */
export function PersonnelFileSectionStatusBadge({
  state,
  className,
}: PersonnelFileSectionStatusBadgeProps) {
  const t = useTranslations('PersonnelFile');
  const label = tDynLoose(t, 'sections.status', state);
  return (
    <Badge
      variant="secondary"
      className={`${STATUS_CLASS_MAP[state]} ${className ?? ''}`.trim()}
      aria-label={label}>
      {label}
    </Badge>
  );
}

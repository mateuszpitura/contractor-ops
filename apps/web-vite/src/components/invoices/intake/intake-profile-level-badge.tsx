/**
 * ZUGFeRD / Factur-X profile-level badge.
 */

import { useTranslations } from '../../../i18n/useTranslations.js';
import { cn } from '../../../lib/utils.js';

export const PROFILE_LEVELS = [
  'COMFORT',
  'XRECHNUNG',
  'EXTENDED',
  'BASIC',
  'BASICWL',
  'MINIMUM',
] as const;

export type ProfileLevel = (typeof PROFILE_LEVELS)[number];

const LEVEL_CLASSES: Record<ProfileLevel, string> = {
  COMFORT: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  XRECHNUNG: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  EXTENDED: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  BASIC: 'bg-muted text-muted-foreground',
  BASICWL: 'bg-muted text-muted-foreground',
  MINIMUM: 'bg-muted text-muted-foreground',
};

interface IntakeProfileLevelBadgeProps {
  level: ProfileLevel;
  className?: string;
}

export function IntakeProfileLevelBadge({ level, className }: IntakeProfileLevelBadgeProps) {
  const t = useTranslations('EInvoice.intake.level');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap',
        LEVEL_CLASSES[level],
        className,
      )}
      data-profile-level={level}
      aria-label={t(level)}>
      {t(level)}
    </span>
  );
}

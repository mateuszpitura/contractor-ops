'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// ZUGFeRD / Factur-X profile levels.
// COMFORT + XRECHNUNG are the two functionally-equivalent "safe to convert"
// profiles. EXTENDED carries sender-specific fields that may not round-trip
// cleanly — paired with the bannerExtendedBestEffort copy in the detail page.
// BASIC / BASICWL / MINIMUM are rejected by the intake service (line-item
// data absent) but are defined here so the badge can still render them on
// older historical rows for operator diagnostics.
// ---------------------------------------------------------------------------

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

/**
 * ZUGFeRD / Factur-X profile-level badge.
 * Uses teal for safe profiles, warm amber for EXTENDED (paired with the
 * best-effort banner), muted for the sub-COMFORT profiles rejected on
 * upload.
 */
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

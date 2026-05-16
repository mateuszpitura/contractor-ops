'use client';

// ---------------------------------------------------------------------------
// ClassificationAutosaveIndicator — live-region pill showing save state.
// ---------------------------------------------------------------------------
// See UI-SPEC §Interaction 4. Re-renders the relative-time label every 30s
// via an interval ref (not on every parent render). Uses
// `Intl.RelativeTimeFormat` with the current locale.

import { Check, CircleAlert, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import type { LooseTranslator } from '@/i18n/typed-keys';

import { cn } from '@/lib/utils';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface ClassificationAutosaveIndicatorProps {
  status: AutosaveStatus;
  /** Epoch ms of the last successful save; null when never saved. */
  lastSavedAt: number | null;
  className?: string;
}

const UPDATE_INTERVAL_MS = 30_000;

function formatRelativeTime(locale: string, deltaMs: number): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const deltaSec = Math.round(deltaMs / 1000);
  if (Math.abs(deltaSec) < 60) return rtf.format(-deltaSec, 'second');
  const deltaMin = Math.round(deltaSec / 60);
  if (Math.abs(deltaMin) < 60) return rtf.format(-deltaMin, 'minute');
  const deltaHour = Math.round(deltaMin / 60);
  return rtf.format(-deltaHour, 'hour');
}

export function ClassificationAutosaveIndicator({
  status,
  lastSavedAt,
  className,
}: ClassificationAutosaveIndicatorProps) {
  const locale = useLocale();
  const t = useTranslations('Classification.autosave');

  // Tick every 30s so `Intl.RelativeTimeFormat` output stays fresh
  // without re-rendering on every keystroke.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (status !== 'saved' || lastSavedAt === null) return;
    const interval = setInterval(() => setTick(n => n + 1), UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [status, lastSavedAt]);

  const relativeTime = useMemo(() => {
    if (lastSavedAt === null) return '';
    return formatRelativeTime(locale, Date.now() - lastSavedAt);
  }, [locale, lastSavedAt]);

  const { label, Icon, variant } = resolveVisual(status, t, relativeTime);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs',
        variant === 'idle' && 'border-input text-muted-foreground',
        variant === 'saving' && 'border-input text-muted-foreground',
        variant === 'saved' && 'border-primary/30 bg-primary/5 text-foreground',
        variant === 'error' && 'border-destructive/40 bg-destructive/5 text-destructive',
        className,
      )}>
      {Icon ? (
        <Icon
          className={cn(
            'h-3.5 w-3.5',
            variant === 'saving' && 'animate-spin motion-reduce:animate-none',
          )}
          aria-hidden="true"
        />
      ) : null}
      <span>{label}</span>
    </div>
  );
}

function resolveVisual(
  status: AutosaveStatus,
  t: LooseTranslator,
  relativeTime: string,
): { label: string; Icon: typeof Loader2 | null; variant: AutosaveStatus } {
  switch (status) {
    case 'saving':
      return { label: t('saving'), Icon: Loader2, variant: 'saving' };
    case 'saved':
      return { label: t('saved', { relativeTime }), Icon: Check, variant: 'saved' };
    case 'error':
      return { label: t('failed'), Icon: CircleAlert, variant: 'error' };
    default:
      return { label: t('notSavedYet'), Icon: null, variant: 'idle' };
  }
}

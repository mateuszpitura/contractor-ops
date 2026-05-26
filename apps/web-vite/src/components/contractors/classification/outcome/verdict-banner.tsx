// ---------------------------------------------------------------------------
// Shared verdict banner — Phase 58 Plan 05 Task 1.
// ---------------------------------------------------------------------------
// Renders the colour + icon + text "semantic triad" (WCAG 1.4.1 — never
// communicate by colour alone). Used by both IR35 and DRV outcome variants.
//
// Phase 64 · D-19 — When `onAmberVerdictMounted` is provided, the banner fires
// the callback (exactly once, via ref guard) when the tone is 'warning'. The
// outcome page uses this to trigger logEscalation for amber/indeterminate verdicts.

import type { Ir35Outcome, ScheinselbstandigkeitOutcome } from '@contractor-ops/classification';
import type { LucideIcon } from 'lucide-react';
import { CircleCheck, ShieldAlert, ShieldQuestion, ShieldX } from 'lucide-react';
import { useEffect, useRef } from 'react';

type SemanticTone = 'success' | 'warning' | 'destructive' | 'neutral';

export type VerdictBannerProps =
  | {
      kind: 'ir35';
      outcome: Ir35Outcome;
      label: string;
      /** Optional subline e.g. rule-set version + completion date. */
      subline?: string;
      /** Phase 64 D-19 — fired once on mount when verdict is amber/indeterminate */
      onAmberVerdictMounted?: () => void;
    }
  | {
      kind: 'drv';
      outcome: ScheinselbstandigkeitOutcome;
      label: string;
      subline?: string;
      onAmberVerdictMounted?: () => void;
    };

const TONE_STYLES: Record<SemanticTone, { container: string; icon: string; border: string }> = {
  success: {
    container: 'bg-success/10 text-success',
    icon: 'text-success',
    border: 'border-s-[4px] border-s-success',
  },
  warning: {
    container: 'bg-warning/10 text-warning',
    icon: 'text-warning',
    border: 'border-s-[4px] border-s-warning',
  },
  destructive: {
    container: 'bg-destructive/10 text-destructive',
    icon: 'text-destructive',
    border: 'border-s-[4px] border-s-destructive',
  },
  neutral: {
    container: 'bg-muted text-foreground',
    icon: 'text-foreground',
    border: 'border-s-[4px] border-s-border',
  },
};

function toneForIr35(outcome: Ir35Outcome): SemanticTone {
  switch (outcome.verdict) {
    case 'outside':
      return 'success';
    case 'inside':
      return 'destructive';
    case 'indeterminate':
      return 'warning';
  }
}

function toneForDrv(outcome: ScheinselbstandigkeitOutcome): SemanticTone {
  switch (outcome.verdict) {
    case 'green':
      return 'success';
    case 'amber':
      return 'warning';
    case 'red':
      return 'destructive';
  }
}

function iconForIr35(outcome: Ir35Outcome): LucideIcon {
  switch (outcome.verdict) {
    case 'outside':
      return CircleCheck;
    case 'inside':
      return ShieldX;
    case 'indeterminate':
      return ShieldQuestion;
  }
}

function iconForDrv(outcome: ScheinselbstandigkeitOutcome): LucideIcon {
  switch (outcome.verdict) {
    case 'green':
      return CircleCheck;
    case 'amber':
      return ShieldAlert;
    case 'red':
      return ShieldX;
  }
}

/**
 * Accessible banner that carries the overall verdict. role="status" signals to
 * assistive tech this is an important state announcement; aria-label mirrors
 * the visible text so screen readers receive the exact same information that
 * sighted users receive from the icon + colour combination.
 */
export function VerdictBanner(props: VerdictBannerProps) {
  const { kind, label, subline } = props;
  const tone = kind === 'ir35' ? toneForIr35(props.outcome) : toneForDrv(props.outcome);
  const Icon = kind === 'ir35' ? iconForIr35(props.outcome) : iconForDrv(props.outcome);
  const styles = TONE_STYLES[tone];

  // Phase 64 D-19 — fire logEscalation once on mount when verdict is amber/indeterminate.
  // Ref guard prevents double-fire on StrictMode double-mount in development.
  const escalationFiredRef = useRef(false);
  const onAmberVerdictMounted = props.onAmberVerdictMounted;
  useEffect(() => {
    if (tone === 'warning' && onAmberVerdictMounted && !escalationFiredRef.current) {
      escalationFiredRef.current = true;
      onAmberVerdictMounted();
    }
  }, [tone, onAmberVerdictMounted]);

  return (
    <div
      role="status"
      aria-label={label}
      data-tone={tone}
      data-kind={kind}
      data-testid="verdict-banner"
      className={[
        'relative flex min-h-[128px] items-center gap-4 rounded-lg px-5 py-4',
        'print:border print:border-foreground/30 print:bg-transparent',
        styles.container,
        styles.border,
      ].join(' ')}>
      <span
        className={[
          'flex size-12 shrink-0 items-center justify-center rounded-full bg-background/70',
          styles.icon,
        ].join(' ')}>
        <Icon aria-hidden="true" className="size-7" />
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-xl font-semibold tracking-tight text-foreground">{label}</span>
        {subline ? (
          <span className="text-sm text-muted-foreground print:text-foreground">{subline}</span>
        ) : null}
      </div>
    </div>
  );
}

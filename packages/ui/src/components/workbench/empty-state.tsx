import type { ComponentType, ReactNode } from 'react';

import { WORKBENCH_EMPTY_STATE_PAGE_CLASS } from './table-page-layout.js';

export interface AtelierEmptyStateAction {
  label: string;
  /** Renders as a Link if provided. */
  href?: string;
  /** Renders as a button onClick if provided. Ignored when href is set. */
  onClick?: () => void;
  /** Optional icon component rendered before the label. */
  icon?: ComponentType<{ className?: string }>;
}

/**
 * Layout density for the empty state.
 *
 * - `page`     — list-page empty state. Fills the flex slot below headers
 *   (`WORKBENCH_EMPTY_STATE_PAGE_CLASS`, min 60vh when the parent has no
 *   bounded height). Large illustration, dot-grid backdrop, framed border.
 * - `subview`  — inside a tab/card/section. No min-h, smaller
 *   illustration, no backdrop, no border. Use for empty tabs inside
 *   detail pages or empty sections inside settings.
 * - `inline`   — compact one-row layout for tiny empty lists. Icon +
 *   heading + action side-by-side.
 */
export type AtelierEmptyStateVariant = 'page' | 'subview' | 'inline';

export interface AtelierEmptyStateProps {
  /** Display icon — typically a lucide-react component. Falls back when `illustration` is set. */
  icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  /**
   * Contextual SVG illustration — replaces the icon-in-circle when provided.
   * Use one of the `*Illustration` components from `./empty-state-illustrations`.
   */
  illustration?: ComponentType<{ className?: string }>;
  /** Primary heading. */
  heading: string;
  /** Body copy under the heading. */
  body: string;
  /** Primary CTA. */
  primaryAction?: AtelierEmptyStateAction;
  /** Secondary CTA (rendered as outline variant). */
  secondaryAction?: AtelierEmptyStateAction;
  /**
   * When set + `prerequisiteMissing` is true, this overrides the primary
   * CTA. Used for "you need to add a contractor first" type flows.
   */
  prerequisiteAction?: AtelierEmptyStateAction;
  prerequisiteMissing?: boolean;
  /**
   * Layout density. Defaults to `'page'` so existing call sites are
   * unchanged. Use `'subview'` inside tabs/cards and `'inline'` for
   * tiny lists.
   */
  variant?: AtelierEmptyStateVariant;
  /**
   * Render the action(s). The primitive can't import the app's Link
   * component, so the consumer provides a render function.
   *
   * Receives the resolved action plus a `variant` hint ('primary' or
   * 'secondary'). The render function returns the actual button/link
   * element.
   */
  renderAction: (action: AtelierEmptyStateAction, variant: 'primary' | 'secondary') => ReactNode;
}

/**
 * Workbench-tier empty state — icon-in-circle, display-font heading,
 * optional dot-grid background. Matches V1 EmptyState API including the
 * prerequisite-aware CTA sequencing, but with calmer Workbench surfaces
 * (no glass, no shimmer).
 *
 * `renderAction` is required because @contractor-ops/ui can't import
 * the app's Link component (locale-aware, app-specific). Consumers pass
 * a small wrapper that bridges the action object to <Link>/<Button>.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: variant × CTA × illustration matrix; splitting per-variant would duplicate the action-render wiring across helpers
export function AtelierEmptyState({
  icon: Icon,
  illustration: Illustration,
  heading,
  body,
  primaryAction,
  secondaryAction,
  prerequisiteAction,
  prerequisiteMissing,
  variant = 'page',
  renderAction,
}: AtelierEmptyStateProps) {
  const effectivePrimary =
    prerequisiteMissing && prerequisiteAction ? prerequisiteAction : primaryAction;

  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-muted/20 px-4 py-3">
        {Illustration ? (
          <div className="shrink-0 text-primary/70">
            <Illustration className="h-8 w-8" />
          </div>
        ) : Icon ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8">
            <Icon className="h-4 w-4 text-primary/70" strokeWidth={1.5} />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{heading}</p>
          <p className="truncate text-xs text-muted-foreground">{body}</p>
        </div>
        {effectivePrimary || secondaryAction ? (
          <div className="flex shrink-0 items-center gap-2">
            {secondaryAction ? renderAction(secondaryAction, 'secondary') : null}
            {effectivePrimary ? renderAction(effectivePrimary, 'primary') : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (variant === 'subview') {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
        {Illustration ? (
          <div className="text-primary/70">
            <Illustration className="h-16 w-16" />
          </div>
        ) : Icon ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/8">
            <Icon className="h-6 w-6 text-primary/70" strokeWidth={1.5} />
          </div>
        ) : null}
        <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">{heading}</h3>
        <p className="mt-1.5 max-w-[380px] text-sm leading-relaxed text-muted-foreground">{body}</p>
        {effectivePrimary || secondaryAction ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {effectivePrimary ? renderAction(effectivePrimary, 'primary') : null}
            {secondaryAction ? renderAction(secondaryAction, 'secondary') : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={WORKBENCH_EMPTY_STATE_PAGE_CLASS} data-slot="workbench-empty-state-page">
      <div className="dot-grid flex min-h-[60vh] flex-1 flex-col items-center justify-center rounded-2xl border border-border/40 px-6 py-12 text-center">
        {Illustration ? (
          <div className="text-primary/70">
            <Illustration className="h-24 w-24" />
          </div>
        ) : Icon ? (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/8">
            <Icon className="h-8 w-8 text-primary/70" strokeWidth={1.5} />
          </div>
        ) : null}
        <h2 className="mt-5 font-display text-[20px] font-semibold tracking-tight">{heading}</h2>
        <p className="mt-2 max-w-[420px] text-sm text-muted-foreground">{body}</p>
        {effectivePrimary || secondaryAction ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {effectivePrimary ? renderAction(effectivePrimary, 'primary') : null}
            {secondaryAction ? renderAction(secondaryAction, 'secondary') : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

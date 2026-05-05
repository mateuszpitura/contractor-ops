import type { ComponentType, ReactNode } from 'react';

export interface AtelierEmptyStateAction {
  label: string;
  /** Renders as a Link if provided. */
  href?: string;
  /** Renders as a button onClick if provided. Ignored when href is set. */
  onClick?: () => void;
}

export interface AtelierEmptyStateProps {
  /** Display icon — typically a lucide-react component. */
  icon: ComponentType<{ className?: string }>;
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
export function AtelierEmptyState({
  icon: Icon,
  heading,
  body,
  primaryAction,
  secondaryAction,
  prerequisiteAction,
  prerequisiteMissing,
  renderAction,
}: AtelierEmptyStateProps) {
  const effectivePrimary =
    prerequisiteMissing && prerequisiteAction ? prerequisiteAction : primaryAction;

  return (
    <div className="dot-grid flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-border/40 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h2 className="mt-5 font-display text-[20px] font-semibold tracking-tight">{heading}</h2>
      <p className="mt-2 max-w-[420px] text-sm text-muted-foreground">{body}</p>
      {effectivePrimary || secondaryAction ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {effectivePrimary ? renderAction(effectivePrimary, 'primary') : null}
          {secondaryAction ? renderAction(secondaryAction, 'secondary') : null}
        </div>
      ) : null}
    </div>
  );
}

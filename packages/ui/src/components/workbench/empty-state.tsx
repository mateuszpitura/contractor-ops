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
 * Illustration-or-icon visual shared by every variant. Sizing differs per
 * variant, so the classes are passed in; renders nothing when neither an
 * illustration nor an icon is provided.
 */
function EmptyStateVisual({
  Illustration,
  Icon,
  illustrationWrapperClassName,
  illustrationClassName,
  iconWrapperClassName,
  iconClassName,
}: {
  Illustration?: ComponentType<{ className?: string }>;
  Icon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  illustrationWrapperClassName: string;
  illustrationClassName: string;
  iconWrapperClassName: string;
  iconClassName: string;
}): ReactNode {
  if (Illustration) {
    return (
      <div className={illustrationWrapperClassName}>
        <Illustration className={illustrationClassName} />
      </div>
    );
  }
  if (Icon) {
    return (
      <div className={iconWrapperClassName}>
        <Icon className={iconClassName} strokeWidth={1.5} />
      </div>
    );
  }
  return null;
}

/** Primary/secondary action pair shared by every variant. */
function EmptyStateActions({
  effectivePrimary,
  secondaryAction,
  renderAction,
  className,
  secondaryFirst = false,
}: {
  effectivePrimary?: AtelierEmptyStateAction;
  secondaryAction?: AtelierEmptyStateAction;
  renderAction: AtelierEmptyStateProps['renderAction'];
  className: string;
  secondaryFirst?: boolean;
}): ReactNode {
  if (!(effectivePrimary || secondaryAction)) return null;
  const primary = effectivePrimary ? renderAction(effectivePrimary, 'primary') : null;
  const secondary = secondaryAction ? renderAction(secondaryAction, 'secondary') : null;
  return (
    <div className={className}>
      {secondaryFirst ? (
        <>
          {secondary}
          {primary}
        </>
      ) : (
        <>
          {primary}
          {secondary}
        </>
      )}
    </div>
  );
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
        <EmptyStateVisual
          Illustration={Illustration}
          Icon={Icon}
          illustrationWrapperClassName="shrink-0 text-primary/70"
          illustrationClassName="h-8 w-8"
          iconWrapperClassName="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/8"
          iconClassName="h-4 w-4 text-primary/70"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{heading}</p>
          <p className="truncate text-xs text-muted-foreground">{body}</p>
        </div>
        <EmptyStateActions
          effectivePrimary={effectivePrimary}
          secondaryAction={secondaryAction}
          renderAction={renderAction}
          className="flex shrink-0 items-center gap-2"
          secondaryFirst
        />
      </div>
    );
  }

  if (variant === 'subview') {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
        <EmptyStateVisual
          Illustration={Illustration}
          Icon={Icon}
          illustrationWrapperClassName="text-primary/70"
          illustrationClassName="h-16 w-16"
          iconWrapperClassName="flex h-12 w-12 items-center justify-center rounded-full bg-primary/8"
          iconClassName="h-6 w-6 text-primary/70"
        />
        <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">{heading}</h3>
        <p className="mt-1.5 max-w-[380px] text-sm leading-relaxed text-muted-foreground">{body}</p>
        <EmptyStateActions
          effectivePrimary={effectivePrimary}
          secondaryAction={secondaryAction}
          renderAction={renderAction}
          className="mt-5 flex flex-wrap items-center justify-center gap-3"
        />
      </div>
    );
  }

  return (
    <div className={WORKBENCH_EMPTY_STATE_PAGE_CLASS} data-slot="workbench-empty-state-page">
      <div className="dot-grid flex min-h-[60vh] flex-1 flex-col items-center justify-center rounded-2xl border border-border/40 px-6 py-12 text-center">
        <EmptyStateVisual
          Illustration={Illustration}
          Icon={Icon}
          illustrationWrapperClassName="text-primary/70"
          illustrationClassName="h-24 w-24"
          iconWrapperClassName="flex h-16 w-16 items-center justify-center rounded-full bg-primary/8"
          iconClassName="h-8 w-8 text-primary/70"
        />
        <h2 className="mt-5 font-display text-[20px] font-semibold tracking-tight">{heading}</h2>
        <p className="mt-2 max-w-[420px] text-sm text-muted-foreground">{body}</p>
        <EmptyStateActions
          effectivePrimary={effectivePrimary}
          secondaryAction={secondaryAction}
          renderAction={renderAction}
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
        />
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';

export interface AtelierPageHeaderProps {
  /** Main title — rendered as <h1> in display font. */
  title: string;
  /** Optional secondary description below the title. */
  description?: string;
  /** Optional eyebrow label above the title (small uppercase tracked text). */
  eyebrow?: string;
  /** Right-aligned action slot — typically a primary button and a menu. */
  actions?: ReactNode;
}

/**
 * Workbench-tier page header. Matches the V1 PageHeader API so the swap
 * is mechanical, but adds an optional eyebrow label and a subtle bottom
 * accent line for editorial separation from page body.
 *
 * No glass, no tilt, no shimmer — Workbench is calm. Actions on the
 * right shrink under content; on narrow viewports the layout stacks.
 */
export function AtelierPageHeader({
  title,
  description,
  eyebrow,
  actions,
}: AtelierPageHeaderProps) {
  return (
    <div className="mb-2 flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <span className="block text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
            {eyebrow}
          </span>
        ) : null}
        <h1 className="font-display text-[24px] font-semibold leading-tight tracking-tight">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

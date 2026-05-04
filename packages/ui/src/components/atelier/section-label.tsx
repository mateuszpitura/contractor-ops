import type { ComponentType, ReactNode } from 'react';

export interface SectionLabelProps {
  children: ReactNode;
  /** Optional leading icon (e.g. a lucide-react component). */
  icon?: ComponentType<{ className?: string }>;
}

/**
 * Editorial-style section header — small uppercase tracked label,
 * optional icon chip, and a fading divider line. Designed to break
 * up dashboard sections without visual heaviness.
 *
 * Renders as <div> for visual structure; provide a true heading via
 * the parent layout if document outline matters.
 */
export function SectionLabel({ children, icon: Icon }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-2.5 ps-1">
      {Icon ? (
        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/8">
          <Icon className="h-3 w-3 text-primary" />
        </div>
      ) : null}
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60">
        {children}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-border/50 to-transparent" />
    </div>
  );
}

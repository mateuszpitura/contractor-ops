import type { ComponentType, ReactNode } from 'react';

export interface SectionLabelProps {
  children: ReactNode;
  /** Optional leading icon (e.g. a lucide-react component). Dashboard variant only. */
  icon?: ComponentType<{ className?: string }>;
  /**
   * `dashboard` (default) — icon chip + uppercase label + fading divider.
   * `portal` — uppercase label + fading divider, no icon chip (contractor-facing context).
   */
  variant?: 'dashboard' | 'portal';
}

/**
 * Editorial-style section header. Two variants:
 * - dashboard (default): icon chip + uppercase label + fading divider
 * - portal: uppercase label + fading divider, no icon chip
 */
export function SectionLabel({ children, icon: Icon, variant = 'dashboard' }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-2.5 ps-1">
      {variant === 'dashboard' && Icon ? (
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

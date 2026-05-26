import { RefreshCw } from 'lucide-react';
import type { ComponentType } from 'react';
import { Button } from '../shadcn/button.js';

export interface QueryErrorPanelProps {
  /** Human-readable error message. Caller passes the translated string. */
  message: string;
  /** Label for the retry button. Caller passes the translated string. */
  retryLabel: string;
  /** Invoked when the user clicks retry. */
  onRetry: () => void;
  /** Optional icon override; defaults to lucide's RefreshCw. */
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
}

/**
 * Standardised inline error state for a single query that failed to load.
 * Used at the section/panel level inside container components — distinct
 * from `AtelierEmptyState` (which is for empty/no-data states) and from
 * route-level error boundaries (which render a full page).
 *
 * The component carries no i18n itself; the host app passes localised
 * strings so the primitive stays framework-agnostic. Layout, spacing,
 * icon size, and button variant are locked here so every "this query
 * failed, try again" surface in the dashboard looks identical.
 */
export function QueryErrorPanel({
  message,
  retryLabel,
  onRetry,
  icon: Icon = RefreshCw,
}: QueryErrorPanelProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onRetry}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {retryLabel}
      </Button>
    </div>
  );
}

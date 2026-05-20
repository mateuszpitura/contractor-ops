'use client';

import { Pin } from 'lucide-react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import { useCallback } from 'react';
import type { SettingsTabKey } from '@/lib/settings-tabs';
import { cn } from '@/lib/utils';

export interface PinTabButtonProps {
  tabKey: SettingsTabKey;
  /** Pretty label used in the aria-label / tooltip (e.g. localised "Integrations"). */
  tabLabel: string;
  pinned: boolean;
  /** Whether the parent tab is currently active. */
  active: boolean;
  disabled?: boolean;
  pinAriaLabel: string;
  unpinAriaLabel: string;
  onToggle: () => void;
}

/**
 * Toggle surfaced next to each `<TabsTrigger>` on `/settings`. Click does NOT
 * change the active tab — it only flips the pinned state for the current user.
 *
 * Rendered as a `<span role="switch">` instead of `<button>` because the parent
 * `<TabsTrigger>` already renders a native `<button>`, and nesting buttons is
 * invalid HTML (React 19 emits a hydration warning).
 */
export function PinTabButton({
  tabKey,
  tabLabel: _tabLabel,
  pinned,
  active,
  disabled,
  pinAriaLabel,
  unpinAriaLabel,
  onToggle,
}: PinTabButtonProps) {
  // Stop pointer/click propagation so the surrounding `<TabsTrigger>` does not
  // swallow the event and activate the tab. base-ui's trigger activates on
  // pointerdown, so we intercept that phase too.
  const stopPointer = useCallback((event: PointerEvent<HTMLSpanElement>) => {
    event.stopPropagation();
  }, []);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLSpanElement>) => {
      event.stopPropagation();
      event.preventDefault();
      if (disabled) return;
      onToggle();
    },
    [disabled, onToggle],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLSpanElement>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.stopPropagation();
      event.preventDefault();
      if (disabled) return;
      onToggle();
    },
    [disabled, onToggle],
  );

  if (!(pinned || active)) return null;

  const ariaLabel = pinned ? unpinAriaLabel : pinAriaLabel;

  return (
    <span
      role="switch"
      tabIndex={disabled ? -1 : 0}
      aria-checked={pinned}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-pinned={pinned ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : undefined}
      data-tab-key={tabKey}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onPointerDown={stopPointer}
      onMouseDown={stopPointer}
      className={cn(
        'inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md transition-[color,background-color] duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        'data-[pinned=true]:text-primary',
        'data-[pinned=false]:text-muted-foreground/70 data-[pinned=false]:hover:text-primary',
        'hover:bg-muted/60',
        'data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-40 data-[disabled=true]:data-[pinned=true]:opacity-60',
      )}>
      <Pin
        className={cn(
          'h-3.5 w-3.5 transition-transform duration-150',
          pinned ? 'rotate-45 fill-current' : '',
        )}
        aria-hidden="true"
      />
    </span>
  );
}

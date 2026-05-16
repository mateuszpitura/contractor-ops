'use client';

import { Pin } from 'lucide-react';
import type { MouseEvent, PointerEvent } from 'react';
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
 * Toggle button surfaced next to each `<TabsTrigger>` on `/settings`. Click does
 * NOT change the active tab — it only flips the pinned state for the current
 * user.
 *
 * Visibility rules:
 *  - Pinned tab → always shown (filled pin, accent colour). Click unpins.
 *  - Active + unpinned tab → shown muted, click pins the current tab.
 *  - Otherwise → not rendered at all (the trigger has no reserved space).
 *
 * Returning `null` (instead of opacity-0) means non-active, non-pinned tabs
 * occupy only the width of their label — no ghost gap.
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
  // swallow the event and activate the tab. We also call preventDefault on the
  // pointer-down event because base-ui's tab trigger activates on pointerdown.
  const stopPointer = useCallback((event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  }, []);

  const handleClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
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
    <button
      type="button"
      role="switch"
      aria-checked={pinned}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-pinned={pinned ? 'true' : 'false'}
      data-tab-key={tabKey}
      disabled={disabled}
      onClick={handleClick}
      onPointerDown={stopPointer}
      onMouseDown={stopPointer}
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-[color,background-color] duration-150 ease-out',
        // Always reachable via keyboard
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        // Pinned: filled rotated pin in primary accent.
        'data-[pinned=true]:text-primary',
        // Unpinned-but-active: muted outline that lifts to primary on hover so
        // the affordance reads as "click to pin this tab".
        'data-[pinned=false]:text-muted-foreground/70 data-[pinned=false]:hover:text-primary',
        'hover:bg-muted/60',
        'disabled:cursor-not-allowed disabled:opacity-40 data-[pinned=true]:disabled:opacity-60',
      )}>
      <Pin
        className={cn(
          'h-3.5 w-3.5 transition-transform duration-150',
          // Filled + rotated 45° = "pinned" (Lucide convention).
          // Outline + upright = "click to pin".
          pinned ? 'rotate-45 fill-current' : '',
        )}
        aria-hidden="true"
      />
    </button>
  );
}

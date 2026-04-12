'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useCallback } from 'react';
import { posthog } from '@/lib/posthog';

/**
 * Wraps clickable children and fires a PostHog event on click.
 * Uses event capturing on a presentation wrapper — children handle
 * their own keyboard/focus semantics (links, buttons).
 */
export function TrackClick({
  event,
  properties,
  children,
  className,
}: {
  event: string;
  properties?: Record<string, string | number | boolean>;
  children: ReactNode;
  className?: string;
}) {
  const handleClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      posthog.capture(event, {
        element_text: target?.textContent?.slice(0, 100) ?? '',
        ...properties,
      });
    },
    [event, properties],
  );

  return (
    <div onClick={handleClick} role="none" className={className}>
      {children}
    </div>
  );
}

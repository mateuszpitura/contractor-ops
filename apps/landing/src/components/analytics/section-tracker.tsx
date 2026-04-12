'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { posthog } from '@/lib/posthog';

/**
 * Wraps a landing page section and fires a PostHog event
 * when it scrolls into view (once per page load).
 *
 * Also tracks time spent visible via `section_left` event.
 */
export function SectionTracker({
  name,
  children,
  className,
}: {
  name: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const enteredAt = useRef<number | null>(null);
  const hasFired = useRef(false);

  // Only depend on `name` — avoids observer churn from unstable object refs
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!hasFired.current) {
            hasFired.current = true;
            posthog.capture('section_viewed', { section: name });
          }
          enteredAt.current = Date.now();
        } else if (enteredAt.current) {
          const dwell = Math.round((Date.now() - enteredAt.current) / 1000);
          posthog.capture('section_left', {
            section: name,
            dwell_seconds: dwell,
          });
          enteredAt.current = null;
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      hasFired.current = false;
      enteredAt.current = null;
    };
  }, [name]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

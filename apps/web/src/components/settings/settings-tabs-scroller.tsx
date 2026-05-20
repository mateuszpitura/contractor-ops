'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface SettingsTabsScrollerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wraps an overflowing `<TabsList>` with subtle left/right chevron indicators
 * showing the user there is more content off-screen. The chevrons:
 *  - Hide automatically when the list isn't scrollable (or when at the
 *    respective edge).
 *  - Render as visual cues only (`aria-hidden`); the user still scrolls via
 *    trackpad/touch/scroll-wheel. We don't make them clickable to avoid
 *    duplicating the scrollbar affordance.
 *
 * We attach the scroll listener via a `ref` callback on the wrapper, then
 * locate the actual scrollable element (the first child with `overflow-x-auto`,
 * which is the consumer's `<TabsList>`). This avoids forcing every consumer to
 * forward a ref into base-ui's `TabsList`.
 */
export function SettingsTabsScroller({ children, className }: SettingsTabsScrollerProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const update = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const scroller = wrapper.querySelector<HTMLElement>('[data-slot="tabs-list"]');
    if (!scroller) return;
    const { scrollLeft, scrollWidth, clientWidth } = scroller;
    // A 1px buffer absorbs sub-pixel rounding from CSS scaling so the chevron
    // doesn't flicker on/off at the scroll endpoints.
    setShowStart(scrollLeft > 1);
    setShowEnd(scrollLeft + clientWidth < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const scroller = wrapper.querySelector<HTMLElement>('[data-slot="tabs-list"]');
    if (!scroller) return;

    update();

    scroller.addEventListener('scroll', update, { passive: true });

    const ro = new ResizeObserver(update);
    ro.observe(scroller);
    ro.observe(wrapper);

    return () => {
      scroller.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [update]);

  // Fade-mask style: the gradient overlays the scroll edge so the chevron sits
  // on a softly faded edge of the tab list rather than a hard cut.
  const chevronBase =
    'pointer-events-none absolute top-0 z-10 flex h-full w-6 items-center justify-center text-muted-foreground/60 opacity-0 transition-opacity duration-150';

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      {children}
      <div
        aria-hidden="true"
        data-visible={showStart}
        className={cn(chevronBase, 'start-0', 'data-[visible=true]:opacity-100')}>
        <ChevronLeft className="h-4 w-4" />
      </div>
      <div
        aria-hidden="true"
        data-visible={showEnd}
        className={cn(chevronBase, 'end-0', 'data-[visible=true]:opacity-100')}>
        <ChevronRight className="h-4 w-4" />
      </div>
    </div>
  );
}

/**
 * Inline gradient style — generated via `color-mix` against the project's
 * oklch-based `--background` token so the fade matches both light and dark
 * themes without recomputing alpha channels manually.
 */
function _chevronGradientStyle(side: 'start' | 'end'): CSSProperties {
  const direction = side === 'start' ? 'to right' : 'to left';
  return {
    backgroundImage: `linear-gradient(${direction}, var(--background) 0%, color-mix(in oklch, var(--background) 70%, transparent) 60%, transparent 100%)`,
  };
}

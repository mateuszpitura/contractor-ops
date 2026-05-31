'use client';

import * as React from 'react';

const SCROLL_EPSILON = 1;

function computeOverflowShadow(el: HTMLElement): boolean {
  const canScroll = el.scrollHeight - el.clientHeight > SCROLL_EPSILON;
  const hasMoreBelow = el.scrollTop + el.clientHeight < el.scrollHeight - SCROLL_EPSILON;
  return canScroll && hasMoreBelow;
}

/**
 * True when the element scrolls and content remains below the visible viewport
 * (e.g. sticky footer should show a top-edge fade).
 */
export function useOverflowScrollShadow<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null);
  const [showShadow, setShowShadow] = React.useState(false);

  const update = React.useCallback(() => {
    const el = ref.current;
    setShowShadow(el ? computeOverflowShadow(el) : false);
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;

    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(el);

    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(el, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    el.addEventListener('scroll', update, { passive: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      el.removeEventListener('scroll', update);
    };
  }, [update]);

  return { ref, showShadow, update };
}

export { computeOverflowShadow };

import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT = 768;

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot(): boolean {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

// Server snapshot is `false` — the desktop layout. Components MUST treat the
// first client render as the same shape and only opt into mobile UI after
// hydration completes, so React's hydration matcher stays happy.
function getServerSnapshot(): boolean {
  return false;
}

/**
 * Reactive `(max-width: 767px)` boolean. SSR-safe (returns `false` on the
 * server and during the first hydration tick) and powered by
 * `useSyncExternalStore`, so consumers in concurrent rendering paths don't
 * tear between commits.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Shell container chunk prefetching.
 *
 * Split out from `route-prefetch.ts` so that module stays free of any
 * `components/layout/*` import: the shells import `prefetchRoute` from
 * `route-prefetch.ts`, so warming the shells from there would form an import
 * cycle (shell → route-prefetch → shell). Shared prefetch primitives
 * (`warm`, `onIdle`) live in `route-prefetch.ts` and are reused here.
 */

import type { Thunk } from './route-prefetch.js';
import { onIdle, warm } from './route-prefetch.js';

/**
 * Shell container chunks. Warmed on idle so the cold-boot blank frame (the
 * lazy shell chunk downloading behind `Suspense fallback={null}`) is gone by
 * the time the auth loader resolves and the shell mounts.
 */
const SHELL_CHUNKS: Array<readonly [string, Thunk]> = [
  ['shell:dashboard', () => import('../components/layout/dashboard-shell.js')],
  ['shell:portal', () => import('../components/layout/portal-shell.js')],
];

/**
 * Prefetch the staff + portal shell chunks once the main thread goes idle.
 * Call after the initial render so first paint is never delayed.
 */
export function prefetchShellsOnIdle(): void {
  onIdle(() => {
    for (const [key, thunk] of SHELL_CHUNKS) warm(key, thunk);
  });
}

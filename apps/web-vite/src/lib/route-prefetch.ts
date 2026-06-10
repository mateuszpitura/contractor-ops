/**
 * Route chunk prefetching — warms `lazy()` route chunks before navigation so
 * the Suspense fallback (blank frame / shell skeleton) rarely flashes.
 *
 * Chunks dedupe by resolved module specifier, not by function identity: a
 * prefetch `import('../pages/dashboard/contractors.js')` resolves to the
 * exact same built chunk the router's `lazy()` uses, so warming here is a
 * cache hit when the route actually mounts. That's why these thunks can live
 * apart from the router declarations without a shared-registry refactor —
 * keep the specifiers in sync with `router/dashboard-routes.tsx` and
 * `router/portal-routes.tsx`.
 */

type Thunk = () => Promise<unknown>;

/** Keyed by the locale-stripped nav `href` (see `lib/navigation.ts`). */
const ROUTE_CHUNKS: Record<string, Thunk> = {
  // Staff dashboard nav destinations.
  '/': () => import('../pages/dashboard/index.js'),
  '/contractors': () => import('../pages/dashboard/contractors.js'),
  '/contracts': () => import('../pages/dashboard/contracts.js'),
  '/workflows': () => import('../pages/dashboard/workflows.js'),
  '/equipment': () => import('../pages/dashboard/equipment.js'),
  '/classification': () => import('../pages/dashboard/classification.js'),
  '/invoices': () => import('../pages/dashboard/invoices.js'),
  '/invoices/intake': () => import('../pages/dashboard/invoices/intake.js'),
  '/approvals': () => import('../pages/dashboard/approvals.js'),
  '/time': () => import('../pages/dashboard/time.js'),
  '/payments': () => import('../pages/dashboard/payments.js'),
  '/reports': () => import('../pages/dashboard/reports.js'),
  '/organization': () => import('../pages/dashboard/organization/index.js'),
  '/notifications': () => import('../pages/dashboard/notifications.js'),
  '/settings': () => import('../pages/dashboard/settings/index.js'),
  // Portal nav destinations.
  '/portal': () => import('../pages/portal/index.js'),
  '/portal/settings': () => import('../pages/portal/settings.js'),
  '/portal/equipment': () => import('../pages/portal/equipment.js'),
  '/portal/contracts': () => import('../pages/portal/contracts.js'),
  '/portal/invoices': () => import('../pages/portal/invoices.js'),
  '/portal/payments': () => import('../pages/portal/payments.js'),
  '/portal/documents': () => import('../pages/portal/documents.js'),
  '/portal/time': () => import('../pages/portal/time.js'),
  '/portal/signatures': () => import('../pages/portal/signatures.js'),
};

/**
 * Shell container chunks. Warmed on idle so the cold-boot blank frame (the
 * lazy shell chunk downloading behind `Suspense fallback={null}`) is gone by
 * the time the auth loader resolves and the shell mounts.
 */
const SHELL_CHUNKS: Array<readonly [string, Thunk]> = [
  ['shell:dashboard', () => import('../components/layout/dashboard-shell.js')],
  ['shell:portal', () => import('../components/layout/portal-shell.js')],
];

const prefetched = new Set<string>();

function warm(key: string, thunk: Thunk): void {
  if (prefetched.has(key)) return;
  prefetched.add(key);
  void thunk().catch(() => {
    // Best-effort: a failed prefetch only means the chunk loads on real
    // navigation instead. Drop the key so a later trigger can retry.
    prefetched.delete(key);
  });
}

/** Warm the chunk for a nav `href` (no-op for paths without a known chunk). */
export function prefetchRoute(href: string): void {
  const thunk = ROUTE_CHUNKS[href];
  if (thunk) warm(href, thunk);
}

function onIdle(cb: () => void): void {
  if (typeof window === 'undefined') return;
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(cb, { timeout: 2000 });
  } else {
    window.setTimeout(cb, 200);
  }
}

/**
 * Prefetch the staff + portal shell chunks once the main thread goes idle.
 * Call after the initial render so first paint is never delayed.
 */
export function prefetchShellsOnIdle(): void {
  onIdle(() => {
    for (const [key, thunk] of SHELL_CHUNKS) warm(key, thunk);
  });
}

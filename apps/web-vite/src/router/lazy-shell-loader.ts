import type { NonIndexRouteObject } from 'react-router-dom';

/**
 * RR's {@link LazyRouteFunction} omits `children` from its resolved payload, but data
 * routers merge lazily-loaded child route tables at runtime.
 *
 * @see https://github.com/remix-run/react-router/issues/12943
 */
type LazyResolvedShellFields = Omit<
  NonIndexRouteObject,
  'path' | 'id' | 'lazy' | 'caseSensitive' | 'index'
>;

/** Lazy layout route that attaches a static `children` route table after first hit. */
export function lazyShellWithChildRoutes(
  load: () => Promise<
    LazyResolvedShellFields & {
      children: NonNullable<NonIndexRouteObject['children']>;
    }
  >,
): NonIndexRouteObject['lazy'] {
  return load as NonIndexRouteObject['lazy'];
}

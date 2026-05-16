/**
 * Typed helpers for dynamic-key translation call sites.
 *
 * Together with the global `next-intl` `AppConfig.Messages` augmentation
 * (see `src/types/next-intl.d.ts`), these helpers turn previously cast-y
 * patterns like:
 *
 *   t(`status.${expr}` as Parameters<typeof t>[0])
 *
 * into:
 *
 *   tDyn(t, 'status', expr)
 *
 * with full tsc-enforced validation of both the sub-namespace and the
 * leaf key.
 */

/**
 * All sub-namespace prefixes of a dotted key union — every intermediate
 * path (head segment, head.segment, …) of every key in `K`.
 *
 * Example:
 *   SubNamespacesOf<'status.active' | 'status.archived' | 'a.b.c'>
 *   = 'status' | 'a' | 'a.b'
 */
export type SubNamespacesOf<K extends string> = K extends `${infer Head}.${infer Rest}`
  ? Rest extends `${string}.${string}`
    ? Head | `${Head}.${SubNamespacesOf<Rest>}`
    : Head
  : never;

/**
 * Leaf segments of a dotted key union that sit directly under the given
 * `Sub` prefix (no further dots allowed).
 *
 * Example:
 *   LeavesUnder<'status.active' | 'status.archived' | 'a.b.c', 'status'>
 *   = 'active' | 'archived'
 *   LeavesUnder<'a.b.c', 'a.b'> = 'c'
 */
export type LeavesUnder<K extends string, Sub extends string> = K extends `${Sub}.${infer Leaf}`
  ? Leaf extends `${string}.${string}`
    ? never
    : Leaf
  : never;

// biome-ignore lint/suspicious/noExplicitAny: structural constraint over the next-intl Translator overload set; tDyn only relies on the first call signature, so the value-level translator is invoked through the resolved key cast.
type Translator = (key: any, ...rest: any[]) => string;

/**
 * Combine a sub-namespace prefix and a leaf key into a fully-qualified
 * translation key, validating both at the type level.
 *
 * @param t      Translator returned by `useTranslations` / `getTranslations`.
 * @param subNs  Sub-namespace prefix relative to `t`'s namespace.
 * @param key    Leaf key under `subNs`.
 * @param values Optional interpolation values, typed like the second
 *               argument of the underlying translator.
 */
export function tDyn<
  T extends Translator,
  Sub extends SubNamespacesOf<Parameters<T>[0] & string>,
  Leaf extends LeavesUnder<Parameters<T>[0] & string, Sub>,
>(t: T, subNs: Sub, key: Leaf, values?: Parameters<T>[1]): string {
  const resolved = `${subNs}.${key}` as Parameters<T>[0];
  return (t as (k: Parameters<T>[0], v?: Parameters<T>[1]) => string)(resolved, values);
}

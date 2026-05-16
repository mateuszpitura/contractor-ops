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

import type { useTranslations } from 'next-intl';

// biome-ignore lint/suspicious/noExplicitAny: structural constraint over the next-intl Translator overload set; tDyn only relies on the first call signature, so the value-level translator is invoked through the resolved key cast.
type Translator = (key: any, ...rest: any[]) => string;

/**
 * Bivariant translator shape for "adapter" slots — schema validators,
 * form-state helpers, etc. that just need to forward a translated string
 * without caring about namespace specifics. Real `Translator<Messages, NS>`
 * values from `useTranslations(NS)` are assignable thanks to the `any`
 * parameter (bivariance), so callers don't need a `(key: string) => t(key)`
 * rewrapper.
 */
// biome-ignore lint/suspicious/noExplicitAny: bivariant by design — narrow translators flow in unchanged.
export type LooseTranslator = (key: any, values?: any) => string;

/**
 * Concrete shape of `useTranslations(ns)` for a given namespace. Use as a
 * function parameter type when a helper / column factory needs to accept
 * a translator scoped to one specific namespace:
 *
 *   function getColumns(t: TranslatorOf<'Contractors'>) { … }
 *
 * Callers pass the result of `useTranslations('Contractors')` directly,
 * with no `(key: string) => t(key)` re-wrapping.
 */
export type TranslatorOf<
  NS extends NonNullable<Parameters<typeof useTranslations>[0]> = NonNullable<Parameters<typeof useTranslations>[0]>,
> = ReturnType<typeof useTranslations<NS>>;

/**
 * Test-only helper — wraps a `(key) => string` mock into a structurally
 * complete `TranslatorOf<NS>` so column factories and other helpers that
 * accept a real next-intl translator can be unit-tested without spinning
 * up the full `NextIntlClientProvider`.
 */
export function createMockTranslator<
  NS extends NonNullable<Parameters<typeof useTranslations>[0]> = NonNullable<Parameters<typeof useTranslations>[0]>,
>(impl: LooseTranslator = (k) => k): TranslatorOf<NS> {
  const fn = ((key: string, values?: Record<string, unknown>) => impl(key, values)) as unknown as TranslatorOf<NS>;
  type MutableTranslator = Record<string, unknown>;
  const mut = fn as unknown as MutableTranslator;
  mut.rich = impl;
  mut.markup = impl;
  mut.raw = (k: string) => k;
  mut.has = () => true;
  return fn;
}

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

/**
 * Looser sibling of `tDyn` for sites whose leaf key comes from an enum or
 * other runtime-string source that TypeScript cannot narrow to the exact
 * leaf union (e.g. `enumKey(prisma.status)`). The sub-namespace prefix is
 * still validated at the type level; missing leaves surface at runtime
 * via `scripts/audit-i18n-code-coverage.ts`.
 *
 * Prefer `tDyn` whenever the leaf is a literal union — only reach for
 * this when narrowing the source data type is out of scope.
 */
export function tDynLoose<
  T extends Translator,
  Sub extends SubNamespacesOf<Parameters<T>[0] & string>,
>(t: T, subNs: Sub, key: string, values?: Parameters<T>[1]): string {
  const resolved = `${subNs}.${key}` as Parameters<T>[0];
  return (t as (k: Parameters<T>[0], v?: Parameters<T>[1]) => string)(resolved, values);
}

/**
 * Escape hatch for sites that receive a fully-qualified key as plain
 * `string` (e.g. an action registry indexed by a runtime label). Neither
 * the prefix nor the leaf is type-checked — coverage falls back to
 * `scripts/audit-i18n-code-coverage.ts`. Use sparingly; prefer `tDyn` /
 * `tDynLoose` whenever the source data type can be narrowed.
 */
export function tKey<T extends Translator>(
  t: T,
  key: string,
  values?: Parameters<T>[1],
): string {
  return (t as (k: Parameters<T>[0], v?: Parameters<T>[1]) => string)(
    key as Parameters<T>[0],
    values,
  );
}

/**
 * Typed helpers for dynamic-key translation call sites.
 *
 * `TranslationKey` is re-exported from the codegen output so consumers
 * can refer to the branded union without depending on the generated
 * file path directly. The helper signatures below are typed as `string`
 * rather than `TranslationKey`; the union is informational and the
 * helpers stay permissive so call sites keep compiling.
 */

export type { TranslationKey } from '../generated/i18n/keys';

// `key: any` is load-bearing, not laziness: a strict branded-key translator
// (e.g. next-intl's `t` keyed on the generated union) is only assignable to
// this `T extends LooseTranslator` constraint when the parameter is `any`.
// Narrowing `key` to `string` makes `string` incompatible with the branded
// union and rejects every real translator at the call site — verified.
// biome-ignore lint/suspicious/noExplicitAny: branded-key translators only satisfy `T extends LooseTranslator` when key/values are `any`; `string`/`unknown` reject them
export type LooseTranslator = (key: any, values?: any) => string;

/**
 * Escape hatch for sites that receive a fully-qualified key as plain
 * `string` (e.g. an action registry indexed by a runtime label). The
 * compat useTranslations hook already accepts string keys, so this
 * helper is a thin pass-through.
 */
export function tKey<T extends LooseTranslator>(
  t: T,
  key: string,
  values?: Parameters<T>[1],
): string {
  return t(key, values);
}

/**
 * Sub-namespace + leaf composition into a dotted key. The compat
 * useTranslations hook already accepts string keys, so type narrowing of
 * the leaf union is not enforced here; coverage is delegated to the
 * existing scripts/audit-i18n-code-coverage.ts gate.
 */
export function tDyn<T extends LooseTranslator>(
  t: T,
  subNs: string,
  key: string,
  values?: Parameters<T>[1],
): string {
  return t(`${subNs}.${key}`, values);
}

/** Looser sibling of `tDyn` — leaf is plain string, no narrowing. */
export function tDynLoose<T extends LooseTranslator>(
  t: T,
  subNs: string,
  key: string,
  values?: Parameters<T>[1],
): string {
  return t(`${subNs}.${key}`, values);
}

/** Runtime guard for dynamic Navigation keys in breadcrumbs. */
export function tHas<T extends LooseTranslator>(t: T, key: string): boolean {
  const result = t(key);
  return result !== key && !result.includes('MISSING_MESSAGE');
}

/**
 * Typed helpers for dynamic-key translation call sites.
 *
 * Lifted from apps/web/src/i18n/typed-keys.ts — only the
 * `LooseTranslator` export is consumed by ported hooks/components in
 * the new tree so this version ships just that surface. The full
 * generic helpers (SubNamespacesOf / LeavesUnder / tDyn) lift in a
 * follow-up alongside the components that use them.
 *
 * `TranslationKey` is re-exported from the codegen output so consumers
 * can refer to the branded union without depending on the generated
 * file path directly. Phase 3 of the i18n-system-messages goal narrows
 * the helper signatures below from `string` → `TranslationKey`; until
 * then, the union is informational and the helpers stay permissive so
 * the codemod-era call sites keep compiling.
 */

export type { TranslationKey } from '../generated/i18n/keys';

// biome-ignore lint/suspicious/noExplicitAny: contract mirrors the next-intl shape exactly
export type LooseTranslator = (key: any, values?: any) => string;

/**
 * Escape hatch for sites that receive a fully-qualified key as plain
 * `string` (e.g. an action registry indexed by a runtime label). Mirrors
 * apps/web/src/i18n/typed-keys.ts#tKey — in the new tree the compat
 * useTranslations hook already accepts string keys, so this helper is a
 * thin pass-through that callers can keep using during the codemod.
 */
export function tKey<T extends LooseTranslator>(
  t: T,
  key: string,
  values?: Parameters<T>[1],
): string {
  return t(key, values);
}

/**
 * Mirrors apps/web/src/i18n/typed-keys.ts#tDyn / #tDynLoose — sub-namespace
 * + leaf composition into a dotted key. In the new tree the compat
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

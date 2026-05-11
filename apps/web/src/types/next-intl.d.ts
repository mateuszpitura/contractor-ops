// Type helpers backed by the canonical en.json shape for focused i18n
// safety. We deliberately DO NOT augment next-intl's global `AppConfig`
// here — flipping the whole codebase onto strict typed messages would
// surface ~75 existing dynamic-key call sites that legitimately resolve
// at runtime via the source-code-vs-i18n auditor (audit-i18n-code-
// coverage.ts). That belt-and-braces split lets the auditor handle the
// general case while these helpers give specific surfaces (sidebar nav,
// route metadata, etc.) tsc-level guarantees.
//
// Usage:
//   import type messages from '@/../messages/en.json';
//   import type { LeafKeysOf } from '@/types/next-intl';
//
//   type NavKey = LeafKeysOf<typeof messages.Navigation>;

/**
 * Leaf-only keys of a namespace, constrained to string keys. JSON-derived
 * `keyof` may technically include `symbol`; we never have symbol keys in
 * a messages JSON. Filters out nested-object keys (e.g. `Navigation.groups`
 * is an object, not a string label).
 */
export type LeafKeysOf<T> = Extract<
  {
    [K in keyof T]: T[K] extends string ? K : never;
  }[keyof T],
  string
>;

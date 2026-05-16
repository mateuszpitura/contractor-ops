// Global next-intl module augmentation — binds `AppConfig.Messages` to the
// generated `Messages` type (sourced from `apps/web/messages/en.json`).
// After augmentation, `useTranslations` / `getTranslations` resolve dotted
// keys strictly at the type level; passing an unknown key or a non-leaf
// key fails `tsc`.
//
// Regenerate the underlying type with `pnpm i18n:types` (auto-wired via
// turbo `i18n:types` before `typecheck` / `build` / `dev`).

import type { Messages as GeneratedMessages } from '@/generated/i18n/messages';

declare module 'next-intl' {
  interface AppConfig {
    Messages: GeneratedMessages;
  }
}

/**
 * Leaf-only keys of a namespace, constrained to string keys. JSON-derived
 * `keyof` may technically include `symbol`; we never have symbol keys in
 * a messages JSON. Filters out nested-object keys (e.g. `Navigation.groups`
 * is an object, not a string label).
 *
 * Retained for direct namespace constraints (e.g. `NavItem.key` in
 * `lib/navigation.ts`). For dynamic-key call sites, prefer `tDyn` from
 * `@/i18n/typed-keys`.
 */
export type LeafKeysOf<T> = Extract<
  {
    [K in keyof T]: T[K] extends string ? K : never;
  }[keyof T],
  string
>;

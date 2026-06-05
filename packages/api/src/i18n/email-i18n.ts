/**
 * Server-side message resolver for transactional emails + outbound
 * notification subjects.
 *
 * The Fastify API has no React / i18next runtime, but the client locale
 * bundles in `apps/web-vite/messages/{en,de,pl,ar}.json` are the single
 * source of truth for translated copy. This module loads those bundles
 * once at boot and resolves `Api.email.*` keys plus the simple
 * ICU-MessageFormat-subset placeholders we use server-side (`{varName}`
 * only — no plural / select / number formatting yet).
 *
 * Fallback rules:
 *   1. Locale not in {en,de,pl,ar} → fall back to `en`.
 *   2. Key path missing in the locale's tree → fall back to `en`.
 *   3. Still missing in `en` → return the key string itself so an
 *      unwired path renders as e.g. `Api.email.subject.foo` in the
 *      email instead of an empty subject (and surfaces during QA).
 *
 * Param interpolation is best-effort: missing params render as empty
 * string. Param values are coerced via `String()`.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type EmailLocale = 'en' | 'pl' | 'de' | 'ar';
export const SUPPORTED_LOCALES: readonly EmailLocale[] = ['en', 'pl', 'de', 'ar'];
export const DEFAULT_LOCALE: EmailLocale = 'en';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

const HERE = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = resolve(HERE, '..', '..', '..', '..', 'apps', 'web-vite', 'messages');

function loadBundle(locale: EmailLocale): Json {
  const path = resolve(MESSAGES_DIR, `${locale}.json`);
  return JSON.parse(readFileSync(path, 'utf-8')) as Json;
}

const BUNDLES: Record<EmailLocale, Json> = {
  en: loadBundle('en'),
  pl: loadBundle('pl'),
  de: loadBundle('de'),
  ar: loadBundle('ar'),
};

export function isEmailLocale(value: string | null | undefined): value is EmailLocale {
  return value === 'en' || value === 'pl' || value === 'de' || value === 'ar';
}

export function normalizeLocale(value: string | null | undefined): EmailLocale {
  if (!value) return DEFAULT_LOCALE;
  const lower = value.toLowerCase();
  // Accept `en-US`, `de_DE`, etc. — take the language subtag only.
  const lang = lower.split(/[-_]/, 1)[0];
  return isEmailLocale(lang) ? lang : DEFAULT_LOCALE;
}

function readPath(root: Json, path: string): string | undefined {
  const parts = path.split('.');
  let cur: Json | undefined = root;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return;
    cur = (cur as { [k: string]: Json })[p];
    if (cur === undefined) return;
  }
  if (typeof cur === 'string') return cur;
  if (typeof cur === 'number' || typeof cur === 'boolean') return String(cur);
  return;
}

const PLACEHOLDER_RE = /\{(\w+)\}/g;

function interpolate(template: string, params: Record<string, unknown> | undefined): string {
  // Always strip unfilled `{var}`s — a literal placeholder in a shipped
  // subject line or label is more confusing than a clipped string.
  return template.replace(PLACEHOLDER_RE, (_match, name: string) => {
    const value = params?.[name];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

/**
 * Resolve an `Api.email.*` (or any other) dotted message path against the
 * requested locale, returning the interpolated string ready to ship in
 * an email subject, label, or React template prop.
 */
export function resolveMessage(
  key: string,
  locale: EmailLocale,
  params?: Record<string, unknown>,
): string {
  const found = readPath(BUNDLES[locale], key);
  if (found !== undefined) return interpolate(found, params);
  if (locale !== DEFAULT_LOCALE) {
    const fallback = readPath(BUNDLES[DEFAULT_LOCALE], key);
    if (fallback !== undefined) return interpolate(fallback, params);
  }
  return key;
}

/**
 * Resolve every key in a map against the requested locale. Useful for the
 * `labels` prop on each React Email template — one call per render.
 */
export function resolveMessages<T extends Record<string, string>>(
  keyMap: T,
  locale: EmailLocale,
  params?: Record<string, unknown>,
): { [K in keyof T]: string } {
  const out = {} as { [K in keyof T]: string };
  for (const [name, key] of Object.entries(keyMap) as [keyof T, string][]) {
    out[name] = resolveMessage(key, locale, params);
  }
  return out;
}

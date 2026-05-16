'use client';

import { useEffect } from 'react';

interface LocaleHtmlAttributesProps {
  lang: string;
  dir: 'ltr' | 'rtl';
  isArabic: boolean;
}

/**
 * Client-only effect that sets `<html lang>` and `<html dir>` based on the
 * current locale, plus toggles the Arabic font class.
 *
 * Phase C.1.a (production-hardening): replaces the previous
 * `<script dangerouslySetInnerHTML>` bootstrap in `apps/landing/src/app/layout.tsx`.
 * That inline script forced `script-src 'unsafe-inline'` in CSP; eliminating
 * it unlocks a nonce-based CSP roll-out (see plan step C.1.b).
 *
 * Trade-off: pre-hydration HTML carries the root layout defaults
 * (`lang="en" dir="ltr"`). Search engines and screen readers see the
 * correct lang/dir after hydration. Per-locale metadata (`og:locale`,
 * `alternates.languages`) ensures crawlers still pick up the right locale
 * via `<head>` regardless of the runtime mutation here.
 *
 * Static export note: `apps/landing` uses `output: 'export'`, so each
 * `/[locale]/*` route is pre-rendered as a separate HTML file with this
 * component already wired — no server runtime is required.
 */
export function LocaleHtmlAttributes({ lang, dir, isArabic }: LocaleHtmlAttributesProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dir;
    if (isArabic) {
      root.classList.add('font-arabic');
      root.classList.remove('font-sans');
    } else {
      root.classList.add('font-sans');
      root.classList.remove('font-arabic');
    }
  }, [lang, dir, isArabic]);

  return null;
}

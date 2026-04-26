// Phase 70 D-03 structured-diff formatter for i18n-parity offences.

import type { I18nParityOffence } from './run-guard.js';

export function formatI18nParityOffences(offences: readonly I18nParityOffence[]): string {
  if (offences.length === 0) return '';
  const lines: string[] = [];

  // Group by locale for readability.
  const byLocale = new Map<string, I18nParityOffence[]>();
  for (const o of offences) {
    if (!byLocale.has(o.locale)) byLocale.set(o.locale, []);
    byLocale.get(o.locale)?.push(o);
  }

  lines.push(
    `[i18n:parity] FAIL: ${offences.length} missing translation key(s) across ${byLocale.size} locale(s)`,
  );
  lines.push('');

  for (const [locale, locOffences] of [...byLocale.entries()].sort()) {
    lines.push(`  locale ${locale}: missing ${locOffences.length} key(s)`);
    for (const o of locOffences.slice(0, 25)) {
      lines.push(`    - ${o.missingKey}`);
    }
    if (locOffences.length > 25) {
      lines.push(`    ... and ${locOffences.length - 25} more`);
    }
    lines.push('');
  }

  lines.push(`  remediation: ${offences[0]?.remediation ?? ''}`);
  return lines.join('\n');
}

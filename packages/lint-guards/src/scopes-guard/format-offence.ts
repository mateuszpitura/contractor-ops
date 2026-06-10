// Structured-diff formatter for scopes-guard offences.
// Same shape as schema-guard / logs-guard / i18n-parity outputs.

import type { ScopesGuardOffence } from './run-guard';

export function formatScopesOffences(offences: readonly ScopesGuardOffence[]): string {
  if (offences.length === 0) return '';
  const lines: string[] = [];
  lines.push(`[lint:scopes] FAIL: ${offences.length} untyped write-scope(s) in IdP adapters`);
  lines.push('');
  for (const o of offences) {
    lines.push(`  offending:   adapter ${o.adapter}`);
    lines.push(`  scope:       ${o.scope}`);
    lines.push(`  remediation: ${o.remediation}`);
    lines.push('');
  }
  return lines.join('\n');
}

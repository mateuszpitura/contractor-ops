// Phase 70 D-03 structured-diff formatter for logs-guard offences.

import type { LogsGuardOffence } from './run-guard';

export function formatLogsOffences(offences: readonly LogsGuardOffence[]): string {
  if (offences.length === 0) return '';
  const lines: string[] = [];
  lines.push(`[lint:logs] FAIL: ${offences.length} unredacted-body log site(s) detected`);
  lines.push('');
  for (const o of offences) {
    lines.push(`  offending:   ${o.file}:${o.line}  (procedure: ${o.procedure})`);
    lines.push(`  snippet:     ${o.snippet}`);
    lines.push(
      '  expected:    omit `body` from log payload OR add procedure prefix to LOG_BODY_INCLUDE_PREFIXES with a // reason: comment',
    );
    lines.push(`  remediation: ${o.remediation}`);
    lines.push('');
  }
  return lines.join('\n');
}

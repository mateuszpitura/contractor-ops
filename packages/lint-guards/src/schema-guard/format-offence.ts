// Structured-diff formatter for schema-guard offences.
// Same shape as `lint:logs` and `i18n:parity` outputs.

import type { SchemaGuardOffence } from './run-guard';

export function formatSchemaOffences(offences: readonly SchemaGuardOffence[]): string {
  if (offences.length === 0) return '';
  const lines: string[] = [];
  lines.push(`[lint:schema] FAIL: ${offences.length} multi-tenant model(s) missing organizationId`);
  lines.push('');
  for (const o of offences) {
    lines.push(`  offending:   model ${o.model}`);
    lines.push(`  file:        ${o.file}:${o.line}`);
    lines.push(
      `  expected:    field "organizationId String" OR add "${o.model}" to GLOBAL_LOOKUP_MODELS_ALLOWLIST`,
    );
    lines.push(`  remediation: ${o.remediation}`);
    lines.push('');
  }
  return lines.join('\n');
}

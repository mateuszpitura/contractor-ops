import type { ArchitectureGuardOffence } from './run-guard.js';

export function formatArchitectureOffences(offences: ArchitectureGuardOffence[]): string {
  return offences.map(o => `${o.file}:${o.line} [${o.rule}] ${o.detail}`).join('\n');
}

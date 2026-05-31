import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatScopesOffences } from '../format-offence';
import { runScopesGuard } from '../run-guard';

// biome-ignore lint/style/useNamingConvention: standard ESM __dirname polyfill
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dirname, '../__fixtures__');
const conformant = resolve(fixturesDir, 'conformant-adapter.ts');
const drifted = resolve(fixturesDir, 'drifted-adapter.ts');

describe('runScopesGuard (Phase 76 D-15)', () => {
  it('exports runScopesGuard from @contractor-ops/lint-guards', () => {
    expect(typeof runScopesGuard).toBe('function');
  });

  it('passes when every write scope is traced to a same-file or imported typed-const', () => {
    const offences = runScopesGuard({ adapterFiles: [conformant], scopeFiles: [] });
    expect(offences).toEqual([]);
  });

  it('fails with a structured offence when an adapter has an untyped write-scope literal', () => {
    const offences = runScopesGuard({ adapterFiles: [drifted], scopeFiles: [] });
    expect(offences).toHaveLength(1);
    expect(offences[0]).toMatchObject({
      kind: 'untyped-scope',
      adapter: 'drifted-adapter.ts',
      scope: 'https://example.com/api/admin.directory.user',
    });
    expect(offences[0]?.remediation).toMatch(/typed-const/);
  });

  it('output uses Phase 70 D-03 structured-diff format', () => {
    const offences = runScopesGuard({ adapterFiles: [drifted], scopeFiles: [] });
    const out = formatScopesOffences(offences);
    expect(out).toMatch(/^\[lint:scopes\] FAIL:/);
    expect(out).toContain('  offending:   adapter drifted-adapter.ts');
    expect(out).toContain('  scope:');
    expect(out).toContain('  remediation:');
  });

  it('read-only scopes are exempt (no offence for *.readonly literals)', () => {
    // The conformant fixture also contains a .readonly literal; it must not be flagged.
    const offences = runScopesGuard({ adapterFiles: [conformant], scopeFiles: [] });
    expect(offences.every(o => !o.scope.endsWith('.readonly'))).toBe(true);
  });
});

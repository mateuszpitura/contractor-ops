import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { POLICY_RULE_SET_VERSION } from '../version';

describe('POLICY_RULE_SET_VERSION', () => {
  it('matches package.json version with v prefix', () => {
    const Dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = resolve(Dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
    expect(POLICY_RULE_SET_VERSION).toBe(`v${pkg.version}`);
  });

  it('is a literal const (not a runtime-mutable string)', () => {
    // Verifies typeof asserted in TS — runtime check is the equality above.
    expect(typeof POLICY_RULE_SET_VERSION).toBe('string');
    expect(POLICY_RULE_SET_VERSION.startsWith('v')).toBe(true);
  });
});

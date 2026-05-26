/**
 * Codegen + type contract for the branded `TranslationKey` union emitted by
 * scripts/generate-i18n-types.ts. Locks two guarantees:
 *
 *  1. Running the generator a second time against the same `en.json` produces
 *     byte-identical output (deterministic — turbo caches it cleanly).
 *  2. A literal that does not match the union fails at the type level; a
 *     literal that does match compiles. The `@ts-expect-error` directives in
 *     this file are themselves the assertion — if they ever stop firing,
 *     `tsc` flags the directive as unused and the build breaks.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { TranslationKey } from '../../generated/i18n/keys.js';

const REPO_ROOT = resolve(import.meta.dirname, '../../../../..');
const KEYS_FILE = resolve(REPO_ROOT, 'apps/web-vite/src/generated/i18n/keys.d.ts');

describe('TranslationKey codegen', () => {
  it('is deterministic across two consecutive runs', () => {
    const before = readFileSync(KEYS_FILE, 'utf8');
    execFileSync('pnpm', ['i18n:types'], { cwd: REPO_ROOT, stdio: 'pipe' });
    const after = readFileSync(KEYS_FILE, 'utf8');
    expect(after).toBe(before);
  });

  it('emits the expected branded shape and leaf keys', () => {
    const content = readFileSync(KEYS_FILE, 'utf8');
    expect(content).toContain('export type TranslationKey');
    expect(content).toContain("'Errors.contractorNotFound'");
    expect(content).toContain("'Errors.generic'");
    expect(content).toContain('translationKeyBrand');
  });
});

describe('TranslationKey type contract', () => {
  it('accepts a matching literal and rejects a non-matching literal', () => {
    const good: TranslationKey = 'Errors.contractorNotFound';
    expect(typeof good).toBe('string');

    // @ts-expect-error — plain string that is not part of the codegen union.
    const bad: TranslationKey = 'definitely.not.a.real.key.path';
    expect(typeof bad).toBe('string');

    // @ts-expect-error — `string` is not assignable to the branded union.
    const fromString: TranslationKey = String('Errors.generic');
    expect(typeof fromString).toBe('string');
  });
});

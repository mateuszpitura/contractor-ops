// Test scaffold for the body-redaction logger guard.
// `runLogsGuard` performs a ts-morph AST scan.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runLogsGuard } from '../logs-guard/run-guard';

const FX = join(__dirname, '..', '__fixtures__');
const INCLUDE_PREFIXES: readonly string[] = []; // empty default

describe('logs-guard (FOUND6-02)', () => {
  it('returns 0 offences for a router with no body logs', async () => {
    const offences = await runLogsGuard({
      files: [join(FX, 'clean-router.ts')],
      includePrefixes: INCLUDE_PREFIXES,
    });
    expect(offences).toEqual([]);
  });

  it('flags a router that logs body without an include-prefix', async () => {
    const offences = await runLogsGuard({
      files: [join(FX, 'leaky-router.ts')],
      includePrefixes: INCLUDE_PREFIXES,
    });
    expect(offences).toHaveLength(1);
    expect(offences[0]?.kind).toBe('unredacted-body-log');
    expect(offences[0]?.file).toContain('leaky-router.ts');
  });

  it('does not flag a body log when its router prefix is in includePrefixes', async () => {
    const offences = await runLogsGuard({
      files: [join(FX, 'leaky-router.ts')],
      includePrefixes: ['contractor.create'],
    });
    expect(offences).toEqual([]);
  });
});

// Phase 70-01 · FOUND6-02 (D-05) — failing test scaffold for default body
// redaction on the root logger. Plan 70-03 makes this PASS by adding `body`
// (and nested wildcards) to the default `redact.paths` set in
// packages/logger/src/index.ts.

import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../index.js';

describe('default body redaction (FOUND6-02 — D-05)', () => {
  it('redacts top-level `body` field by default in any child logger', () => {
    const captured: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      captured.push(typeof chunk === 'string' ? chunk : String(chunk));
      return true;
    });

    const log = createLogger({ service: 'test' });
    // The plain payload `secret-payload` MUST be redacted in the serialized
    // JSON line. The current logger does NOT redact `body` so this assertion
    // fails until Plan 70-03 lands.
    log.info({ body: { ssn: 'secret-payload' } }, 'hi');
    writeSpy.mockRestore();

    const joined = captured.join('');
    expect(joined).not.toContain('secret-payload');
    expect(joined).toContain('[REDACTED]');
  });
});

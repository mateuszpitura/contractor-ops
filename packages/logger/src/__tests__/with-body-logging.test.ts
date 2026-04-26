// Phase 70-01 · FOUND6-02 (D-05/D-06) — failing test scaffold for the
// opt-in `withBodyLogging` factory. Plan 70-03 implements + exports it.

import { describe, expect, it, vi } from 'vitest';
// biome-ignore lint/correctness/noUnresolvedImports: target of Plan 70-03
import { createTrpcLogger, withBodyLogging } from '../index.js';

describe('withBodyLogging opt-in (FOUND6-02 — D-05/D-06)', () => {
  it('child returned by withBodyLogging emits plaintext body for matching procedure prefix', () => {
    const captured: string[] = [];
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      captured.push(typeof chunk === 'string' ? chunk : String(chunk));
      return true;
    });

    const base = createTrpcLogger({ procedure: 'contractor.create', type: 'mutation' });
    const log = withBodyLogging(base, ['contractor.create']);
    log.info({ body: { name: 'Acme' } }, 'created');
    writeSpy.mockRestore();

    const joined = captured.join('');
    expect(joined).toContain('Acme');
    expect(joined).not.toContain('[REDACTED]');
  });
});

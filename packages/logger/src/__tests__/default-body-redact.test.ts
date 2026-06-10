// Default body redaction on the root logger. `body` and `*.body` are in the
// default redact.paths so any log.info({ body: ... }) call site emits
// `[REDACTED]` for the body field.
//
// Implementation note: the global root logger is created with multistream
// (pino-pretty + axiom) which buffers writes. To assert redact behaviour
// deterministically we mount a fresh pino instance with the SAME baseOptions
// (PII_MASK_PATHS) into an in-memory Writable. Redact is computed in pino's
// formatter before it reaches the destination — so any destination, including
// our buffer, sees the redacted output.

import { Writable } from 'node:stream';

import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { PII_MASK_PATHS } from '../pii-mask.js';

describe('default body redaction (FOUND6-02 — D-05)', () => {
  it('redacts top-level `body` field by default', () => {
    const chunks: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, cb) {
        chunks.push(chunk.toString());
        cb();
      },
    });
    const log = pino(
      {
        level: 'debug',
        redact: { paths: [...PII_MASK_PATHS], censor: '[REDACTED]' },
      },
      sink,
    ).child({ service: 'test' });

    log.info({ body: { ssn: 'secret-payload' } }, 'hi');

    const joined = chunks.join('');
    expect(joined).not.toContain('secret-payload');
    expect(joined).toContain('[REDACTED]');
  });

  it('redacts nested *.body inside an outer key', () => {
    const chunks: string[] = [];
    const sink = new Writable({
      write(chunk, _encoding, cb) {
        chunks.push(chunk.toString());
        cb();
      },
    });
    const log = pino(
      {
        level: 'debug',
        redact: { paths: [...PII_MASK_PATHS], censor: '[REDACTED]' },
      },
      sink,
    );

    log.info({ req: { body: { ssn: 'nested-secret-payload' } } }, 'received');

    const joined = chunks.join('');
    expect(joined).not.toContain('nested-secret-payload');
    expect(joined).toContain('[REDACTED]');
  });
});

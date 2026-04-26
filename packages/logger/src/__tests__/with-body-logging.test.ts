// Phase 70-01 · FOUND6-02 (D-05/D-06) — opt-in `withBodyLogging` factory.
// Plan 70-03 implements + exports it.
//
// As with default-body-redact.test.ts, we mount a fresh pino instance into
// an in-memory Writable to assert redact behaviour without depending on the
// global root's multistream destination.

import { Writable } from 'node:stream';

import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { PII_MASK_PATHS } from '../pii-mask.js';
import { withBodyLogging } from '../with-body-logging.js';

function setup() {
  const chunks: string[] = [];
  const sink = new Writable({
    write(chunk, _encoding, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  const root = pino(
    {
      level: 'debug',
      redact: { paths: [...PII_MASK_PATHS], censor: '[REDACTED]' },
    },
    sink,
  );
  return { chunks, root };
}

describe('withBodyLogging opt-in (FOUND6-02 — D-05/D-06)', () => {
  it('child returned by withBodyLogging emits plaintext body for matching procedure prefix', () => {
    const { chunks, root } = setup();
    const base = root.child({
      service: 'trpc',
      procedure: 'contractor.create',
      type: 'mutation',
    });
    const log = withBodyLogging(base, ['contractor.create']);
    log.info({ body: { name: 'Acme' } }, 'created');

    const joined = chunks.join('');
    expect(joined).toContain('Acme');
    expect(joined).not.toContain('[REDACTED]');
  });

  it('returns parent unchanged when no procedure binding present', () => {
    const { chunks, root } = setup();
    const log = withBodyLogging(root, ['contractor.create']);
    log.info({ body: { name: 'Acme' } }, 'created');

    const joined = chunks.join('');
    // Body is redacted because no procedure binding → no opt-in.
    expect(joined).not.toContain('Acme');
    expect(joined).toContain('[REDACTED]');
  });

  it('returns parent unchanged when procedure does not match any prefix', () => {
    const { chunks, root } = setup();
    const base = root.child({
      service: 'trpc',
      procedure: 'invoice.list',
      type: 'query',
    });
    const log = withBodyLogging(base, ['contractor.create']);
    log.info({ body: { name: 'Acme' } }, 'queried');

    const joined = chunks.join('');
    expect(joined).not.toContain('Acme');
    expect(joined).toContain('[REDACTED]');
  });
});

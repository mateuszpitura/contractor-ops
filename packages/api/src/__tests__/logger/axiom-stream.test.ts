import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createAxiomStream } from '../../../../logger/src/axiom-stream.js';

describe('@contractor-ops/logger createAxiomStream', () => {
  it('returns a Writable stream', () => {
    const stream = createAxiomStream({ dataset: 'd', token: 't' });
    expect(stream).toBeInstanceOf(Writable);
  });

  it('completes write callback for valid JSON lines', async () => {
    const stream = createAxiomStream({ dataset: 'd', token: 't' });
    await new Promise<void>((resolve, reject) => {
      stream.write(JSON.stringify({ level: 30, msg: 'ok' }), err =>
        err ? reject(err) : resolve(),
      );
    });
  });

  it('completes write callback for invalid JSON without throwing', async () => {
    const stream = createAxiomStream({ dataset: 'd', token: 't' });
    await new Promise<void>((resolve, reject) => {
      stream.write('not-json{', err => (err ? reject(err) : resolve()));
    });
  });
});

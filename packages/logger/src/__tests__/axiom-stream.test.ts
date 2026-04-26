import { Writable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @axiomhq/js before importing the module under test
// ---------------------------------------------------------------------------

const mockIngest = vi.fn();
const mockFlush = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

vi.mock('@axiomhq/js', () => ({
  Axiom: class MockAxiom {
    ingest = mockIngest;
    flush = mockFlush;
  },
}));

import { createAxiomStream } from '../axiom-stream.js';

describe('createAxiomStream', () => {
  const opts = { dataset: 'test-dataset', token: 'test-token' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up process listeners registered by createAxiomStream
    process.removeAllListeners('beforeExit');
    process.removeAllListeners('SIGTERM');
  });

  // ── Stream creation ─────────────────────────────────────────────────
  it('returns a Writable stream in objectMode', () => {
    const stream = createAxiomStream(opts);
    expect(stream).toBeInstanceOf(Writable);
    expect(stream.writableObjectMode).toBe(true);
  });

  // ── Write behavior ──────────────────────────────────────────────────
  it('parses JSON string chunks and ingests them into Axiom', () =>
    new Promise<void>((resolve, reject) => {
      const stream = createAxiomStream(opts);
      const payload = { level: 'info', msg: 'hello' };

      stream.write(JSON.stringify(payload), err => {
        try {
          expect(err).toBeFalsy();
          expect(mockIngest).toHaveBeenCalledOnce();
          expect(mockIngest).toHaveBeenCalledWith('test-dataset', [payload]);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }));

  it('handles Buffer chunks by converting to string first', () =>
    new Promise<void>((resolve, reject) => {
      const stream = createAxiomStream(opts);
      const payload = { level: 'warn', msg: 'buffer test' };

      stream.write(Buffer.from(JSON.stringify(payload)), err => {
        try {
          expect(err).toBeFalsy();
          expect(mockIngest).toHaveBeenCalledWith('test-dataset', [payload]);
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }));

  // ── Error handling (write) ──────────────────────────────────────────
  it('does not propagate errors for invalid JSON — calls callback without error', () =>
    new Promise<void>((resolve, reject) => {
      const stream = createAxiomStream(opts);

      stream.write('not-valid-json', err => {
        try {
          expect(err).toBeFalsy();
          expect(mockIngest).not.toHaveBeenCalled();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }));

  it('does not propagate errors when axiom.ingest throws', () =>
    new Promise<void>((resolve, reject) => {
      mockIngest.mockImplementationOnce(() => {
        throw new Error('Axiom SDK error');
      });

      const stream = createAxiomStream(opts);

      stream.write(JSON.stringify({ msg: 'boom' }), err => {
        try {
          expect(err).toBeFalsy();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }));

  // ── Flush on stream end (final callback) ────────────────────────────
  it('flushes the Axiom client when the stream ends', () =>
    new Promise<void>((resolve, reject) => {
      const stream = createAxiomStream(opts);

      stream.end(() => {
        try {
          expect(mockFlush).toHaveBeenCalled();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }));

  it('does not error when axiom.flush rejects during final', () =>
    new Promise<void>((resolve, reject) => {
      mockFlush.mockRejectedValueOnce(new Error('flush failed'));
      const stream = createAxiomStream(opts);

      stream.end(() => {
        try {
          // Callback is still invoked (no error propagated)
          expect(mockFlush).toHaveBeenCalled();
          resolve();
        } catch (e) {
          reject(e);
        }
      });
    }));
});
